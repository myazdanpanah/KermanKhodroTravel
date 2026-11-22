"""
Import a SQL Server (MSSQL) export into the Nexivo PostgreSQL schema.

The command works in two phases:

1. ``--analyze``
   Reads a folder of CSV files exported from SQL Server (SSMS 22 -> Export
   Data / Flat File Destination) and/or a ``.sql`` file produced by
   "Generate Scripts -> Schema only".  It auto-matches each source table and
   column to Django models/fields using name similarity and writes:

   * ``mssql_mapping.yaml``  - editable mapping (source -> target)
   * ``mssql_analysis.md``   - human readable report of matches + gaps

2. ``--apply``
   Reads the mapping YAML and loads the CSV rows into PostgreSQL through the
   Django ORM, resolving foreign keys, converting SQL Server values to Django
   field types, and reporting per-table counts / rejected rows.

Examples
--------
    python manage.py mssql_import --source .\\mssql_export --analyze
    python manage.py mssql_import --source .\\mssql_export --apply --dry-run
    python manage.py mssql_import --source .\\mssql_export --apply

The mapping file is the contract: nothing is written to the database until a
mapping exists, so a human can review where every table/column goes.
"""

from __future__ import annotations

import csv
import difflib
import json
import os
import re
import sys
import traceback
from collections import OrderedDict, defaultdict
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation

import yaml
from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import AutoField, BigAutoField, SmallAutoField
from django.utils import timezone

# ---------------------------------------------------------------------------
# Name helpers
# ---------------------------------------------------------------------------

_SINGULAR_SUFFIXES = ("ies", "ses", "xes", "zes", "ches", "shes", "s")


def normalize(name: str) -> str:
    """Lowercase and keep only ascii letters/digits (handles dbo. prefixes)."""
    if name is None:
        return ""
    name = str(name)
    if "]" in name:
        name = name.replace("[", "").replace("]", "")
    if "." in name:
        name = name.split(".")[-1]
    name = re.sub(r"[^0-9A-Za-z_]", "", name)
    return name.lower()


def singular(word: str) -> str:
    for suffix in _SINGULAR_SUFFIXES:
        if word.endswith(suffix) and len(word) > len(suffix) + 2:
            if suffix == "ies":
                return word[:-3] + "y"
            return word[: -len(suffix)]
    return word


def score(a: str, b: str) -> float:
    """Name similarity in [0, 1], tolerant of plural/prefix noise."""
    na, nb = normalize(a), normalize(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if singular(na) == singular(nb):
        return 0.97
    return difflib.SequenceMatcher(None, singular(na), singular(nb)).ratio()


def best_match(source: str, candidates, threshold: float = 0.62):
    """Return (name, score) of the best candidate or (None, 0)."""
    best, best_score = None, 0.0
    for candidate in candidates:
        s = score(source, candidate)
        if s > best_score:
            best, best_score = candidate, s
    if best_score >= threshold:
        return best, best_score
    return None, best_score


# ---------------------------------------------------------------------------
# Source discovery
# ---------------------------------------------------------------------------

_ENCODINGS = ("utf-8-sig", "utf-16", "cp1256", "cp1252", "latin-1")
_NULL_TOKENS = {"", "null", "\\n", "none", "nan", "nat"}


def detect_encoding(path: str) -> str:
    with open(path, "rb") as fh:
        raw = fh.read(65536)
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        return "utf-16"
    for enc in ("utf-8-sig", "cp1256", "cp1252"):
        try:
            raw.decode(enc)
            return enc
        except UnicodeDecodeError:
            continue
    return "latin-1"


def detect_delimiter(sample: str) -> str:
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        return dialect.delimiter
    except csv.Error:
        return ","


def read_csv_header(path: str):
    encoding = detect_encoding(path)
    with open(path, "r", encoding=encoding, errors="replace", newline="") as fh:
        sample = fh.read(65536)
    if not sample.strip():
        return [], None, encoding
    delimiter = detect_delimiter(sample)
    reader = csv.reader(sample.splitlines(), delimiter=delimiter)
    try:
        header = next(reader)
    except StopIteration:
        return [], delimiter, encoding
    return [h.strip() for h in header], delimiter, encoding


def count_rows(path: str, encoding: str) -> int:
    try:
        with open(path, "rb") as fh:
            total = sum(1 for _ in fh)
        return max(total - 1, 0)
    except OSError:
        return 0


_CREATE_TABLE_RE = re.compile(
    r"CREATE\s+TABLE\s+(?:\[?(\w+)\]?\s*\.\s*)?\[?(\w+)\]?\s*\(",
    re.IGNORECASE,
)
_COLUMN_RE = re.compile(r"^\s*\[?([A-Za-z_][\w ]*?)\]?\s+\[?([A-Za-z]+)\]?")


def parse_schema_sql(path: str):
    """Parse ``CREATE TABLE`` statements from a SSMS schema-only script."""
    with open(path, "r", encoding=detect_encoding(path), errors="replace") as fh:
        text = fh.read()
    tables = OrderedDict()
    for match in _CREATE_TABLE_RE.finditer(text):
        schema, table = match.group(1) or "dbo", match.group(2)
        depth, i = 1, match.end()
        while i < len(text) and depth > 0:
            if text[i] == "(":
                depth += 1
            elif text[i] == ")":
                depth -= 1
            i += 1
        body = text[match.end() : i - 1]
        columns = []
        chunk, depth = [], 0
        for char in body:
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
            if char == "," and depth == 0:
                columns.append("".join(chunk))
                chunk = []
            else:
                chunk.append(char)
        if chunk:
            columns.append("".join(chunk))
        parsed = []
        for column in columns:
            column = column.strip()
            if not column or column.upper().startswith(("CONSTRAINT", "PRIMARY KEY", "UNIQUE", "FOREIGN KEY", "CHECK", "INDEX")):
                continue
            col = _COLUMN_RE.match(column)
            if col:
                parsed.append({"name": col.group(1).strip(), "sql_type": col.group(2)})
        tables[table] = {"schema": schema, "columns": parsed, "file": path}
    return tables


def discover_sources(source: str):
    """Return ``{table_name: {columns, rows, kind, file}}`` for CSV/SQL inputs."""
    if not os.path.exists(source):
        raise CommandError(f"Source path does not exist: {source}")

    tables = OrderedDict()
    if os.path.isdir(source):
        for name in sorted(os.listdir(source)):
            path = os.path.join(source, name)
            lower = name.lower()
            if lower.endswith(".csv"):
                header, delimiter, encoding = read_csv_header(path)
                if not header:
                    continue
                table = os.path.splitext(name)[0]
                tables[table] = {
                    "columns": [{"name": c} for c in header],
                    "rows": count_rows(path, encoding),
                    "kind": "csv",
                    "file": path,
                    "encoding": encoding,
                    "delimiter": delimiter,
                }
            elif lower.endswith(".sql"):
                for table, info in parse_schema_sql(path).items():
                    info.update({"rows": 0, "kind": "sql"})
                    tables.setdefault(table, info)
    else:
        lower = source.lower()
        if lower.endswith(".csv"):
            header, delimiter, encoding = read_csv_header(source)
            table = os.path.splitext(os.path.basename(source))[0]
            tables[table] = {
                "columns": [{"name": c} for c in header],
                "rows": count_rows(source, encoding),
                "kind": "csv",
                "file": source,
                "encoding": encoding,
                "delimiter": delimiter,
            }
        elif lower.endswith(".sql"):
            for table, info in parse_schema_sql(source).items():
                info.update({"rows": 0, "kind": "sql"})
                tables[table] = info
        else:
            raise CommandError("--source must be a folder, a .csv file or a .sql file")
    return tables


# ---------------------------------------------------------------------------
# Target model helpers
# ---------------------------------------------------------------------------

_SYSTEM_APPS = {"admin", "auth", "contenttypes", "sessions", "db_manager"}


def target_models():
    models = []
    for model in apps.get_models():
        meta = model._meta
        if meta.app_label in _SYSTEM_APPS or meta.proxy or meta.abstract:
            continue
        models.append(model)
    return models


def concrete_fields(model):
    return [f for f in model._meta.concrete_fields]


def field_signature(field):
    names = {field.name, field.column}
    return names


# ---------------------------------------------------------------------------
# Auto mapping
# ---------------------------------------------------------------------------

def build_target_index():
    index = {}
    for model in target_models():
        label = f"{model._meta.app_label}.{model.__name__}"
        names = [
            model.__name__,
            model._meta.db_table,
            model._meta.verbose_name,
            model._meta.verbose_name_plural,
        ]
        index[label] = {"model": model, "names": names}
    return index


def auto_map_column(source_column, model):
    fields = concrete_fields(model)
    candidates = {}
    for field in fields:
        candidates[field.name] = field
        candidates[field.column] = field
    named = []
    for field in fields:
        named.extend([field.name, field.column])
    match, confidence = best_match(source_column, named)
    if match is None:
        compact = normalize(source_column)
        for field in fields:
            if normalize(field.name) in compact or compact in normalize(field.name):
                return field.name, 0.55
        return None, 0.0
    return candidates[match].name, confidence


def auto_mapping(sources):
    index = build_target_index()
    labels = list(index.keys())
    mapping = {"version": 1, "defaults": {}, "tables": []}
    report = []

    for table, info in sources.items():
        source_names = [label.split(".")[-1] for label in labels] + [index[l]["model"]._meta.db_table for l in labels]
        best, confidence = best_match(table, source_names)
        target_label = None
        if best is not None:
            for label in labels:
                if normalize(best) in {normalize(n) for n in index[label]["names"]}:
                    target_label = label
                    break
        entry = {
            "source": table,
            "rows": info.get("rows", 0),
            "match": None,
            "confidence": round(confidence, 2),
            "target": None,
            "fields": {},
            "unmapped_source_columns": [],
            "unmapped_required_target_fields": [],
            "notes": [],
        }
        if target_label:
            model = index[target_label]["model"]
            entry["target"] = target_label
            entry["match"] = target_label
            for column in info["columns"]:
                field_name, col_confidence = auto_map_column(column["name"], model)
                if field_name:
                    field_spec = {
                        "source": column["name"],
                        "confidence": round(col_confidence, 2),
                    }
                    if model._meta.get_field(field_name).is_relation:
                        field_spec["needs_fk"] = True
                        entry["notes"].append(
                            f"{field_name} is a foreign key; add an fk: block for {column['name']}"
                        )
                    entry["fields"][field_name] = field_spec
                else:
                    entry["unmapped_source_columns"].append(column["name"])
            mapped_targets = set(entry["fields"].keys())
            for field in concrete_fields(model):
                if field.name in mapped_targets or field.auto_created:
                    continue
                if isinstance(field, (AutoField, BigAutoField, SmallAutoField)):
                    continue
                if getattr(field, "auto_now", False) or getattr(field, "auto_now_add", False):
                    continue
                if not field.null and not field.has_default() and not field.is_relation:
                    entry["unmapped_required_target_fields"].append(field.name)
                if field.is_relation and not field.null:
                    entry["unmapped_required_target_fields"].append(f"{field.name} (FK -> {field.related_model._meta.label})")
            mapping["tables"].append(entry)
        else:
            entry["notes"].append("No confident model match; assign target manually.")
            entry["fields"] = {c["name"].lower(): {"source": c["name"]} for c in info["columns"]}
            mapping["tables"].append(entry)
        report.append(entry)
    return mapping, report


# ---------------------------------------------------------------------------
# Value conversion
# ---------------------------------------------------------------------------

_DATE_FORMATS = (
    "%Y-%m-%d %H:%M:%S.%f",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y",
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M",
    "%m/%d/%Y",
    "%m/%d/%Y %I:%M:%S %p",
    "%m/%d/%Y %I:%M %p",
    "%d/%m/%Y %I:%M:%S %p",
    "%Y/%m/%d",
)
_TRUE = {"1", "true", "yes", "y", "t", "on", "بله", "درست"}
_FALSE = {"0", "false", "no", "n", "f", "off", "خیر", "غلط"}


def is_null(value) -> bool:
    return value is None or str(value).strip().lower() in _NULL_TOKENS


def to_bool(value):
    text = str(value).strip().lower()
    if text in _TRUE:
        return True
    if text in _FALSE:
        return False
    raise ValueError(f"Invalid boolean: {value!r}")


def to_datetime(value, want_date=False):
    if isinstance(value, datetime):
        return value.date() if want_date else value
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        raise ValueError("empty date")
    text = text.replace("Z", "+00:00")
    for fmt in _DATE_FORMATS:
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.date() if want_date else parsed
        except ValueError:
            continue
    try:
        from django.utils.dateparse import parse_date, parse_datetime

        parsed = parse_date(text) if want_date else parse_datetime(text)
        if parsed:
            return parsed
    except ValueError:
        pass
    raise ValueError(f"Unrecognised date: {value!r}")


def to_decimal(value):
    text = str(value).strip().replace(",", "").replace(" ", "")
    if text == "":
        raise ValueError("empty decimal")
    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid decimal: {value!r}") from exc


def to_int(value):
    text = str(value).strip().replace(",", "")
    if text == "":
        raise ValueError("empty integer")
    return int(float(text))


def to_json(value):
    if isinstance(value, (dict, list)):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def jalali_to_gregorian(value, want_date=False):
    """Convert a Jalali date/datetime string (1405/02/26[ 13:45]) to Gregorian."""
    import jdatetime

    text = str(value).strip()
    match = re.match(
        r"^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?",
        text,
    )
    if not match:
        raise ValueError(f"Unrecognised Jalali date: {value!r}")
    year = int(match.group(1))
    if year > 1700:  # already Gregorian
        return to_datetime(text, want_date=want_date)
    jdate = jdatetime.date(year, int(match.group(2)), int(match.group(3)))
    gdate = jdate.togregorian()
    if want_date or match.group(4) is None:
        return gdate
    return datetime.combine(
        gdate,
        time(int(match.group(4)), int(match.group(5)), int(match.group(6) or 0)),
    )


def apply_transform(value, transform):
    if value is None:
        return None
    text = "" if value is None else str(value)
    transform = (transform or "").strip().lower()
    if transform in ("", "none", "raw"):
        return value
    if transform in ("strip", "trim"):
        return text.strip()
    if transform == "upper":
        return text.strip().upper()
    if transform == "lower":
        return text.strip().lower()
    if transform in ("digits", "phone", "mobile"):
        return re.sub(r"\D", "", text)
    if transform == "national_id":
        return re.sub(r"\D", "", text)
    if transform in ("bool", "to_boolean"):
        return to_bool(text)
    if transform in ("password", "django_password", "password_hash", "manual_reset"):
        from django.contrib.auth.hashers import make_password
        _KNOWN_PASSWORDS = {
            "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918": "admin",
            "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92": "123456",
            "c196451df88696ab27f6f6e7a6d5eae46bd7a0827aec128294fbc9721ba36bd4": "4551",
        }
        pw = _KNOWN_PASSWORDS.get(text.strip().lower())
        if pw:
            return make_password(pw)
        return make_password(None)
    if transform == "int":
        return to_int(text)
    if transform == "float":
        return float(to_decimal(text))
    if transform == "decimal":
        return to_decimal(text)
    if transform == "date":
        return to_datetime(text, want_date=True)
    if transform == "datetime":
        return to_datetime(text)
    if transform in ("jalali", "jalali_date"):
        return jalali_to_gregorian(text, want_date=True)
    if transform == "jalali_datetime":
        return jalali_to_gregorian(text, want_date=False)
    if transform == "json":
        return to_json(text)
    return value


def convert_for_field(field, value, spec):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        if value == "" and field.null:
            return None
    internal = field.get_internal_type()
    try:
        if internal in ("BooleanField", "NullBooleanField"):
            return to_bool(value)
        if internal in ("IntegerField", "BigIntegerField", "SmallIntegerField", "PositiveIntegerField",
                        "PositiveSmallIntegerField", "PositiveBigIntegerField"):
            return to_int(value)
        if internal in ("FloatField",):
            return float(to_decimal(value))
        if internal in ("DecimalField",):
            return to_decimal(value)
        if internal in ("DateField",):
            if isinstance(value, str):
                val_str = value.strip()
                m = re.match(r"^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})", val_str)
                if m and int(m.group(1)) < 1700:
                    return jalali_to_gregorian(val_str, want_date=True)
            return to_datetime(value, want_date=True)
        if internal in ("DateTimeField",):
            dt = to_datetime(value)
            if timezone.is_naive(dt):
                dt = timezone.make_aware(dt, timezone.get_current_timezone())
            return dt
        if internal in ("JSONField",):
            return to_json(value)
        if internal in ("TimeField",):
            return str(value)
        return str(value)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"{field.name} ({internal}): {exc}") from exc


# ---------------------------------------------------------------------------
# Row reader
# ---------------------------------------------------------------------------

def read_rows(info):
    path = info["file"]
    if info.get("kind") != "csv":
        raise CommandError(f"{path} is a schema script; export the data as CSV to import rows.")
    encoding = info.get("encoding") or detect_encoding(path)
    delimiter = info.get("delimiter") or ","
    with open(path, "r", encoding=encoding, errors="replace", newline="") as fh:
        reader = csv.DictReader(fh, delimiter=delimiter)
        for row in reader:
            yield { (k or "").strip(): v for k, v in row.items() }


def resolve_model(label):
    if "." in label:
        app_label, model_name = label.split(".", 1)
        try:
            return apps.get_model(app_label, model_name)
        except LookupError as exc:
            raise CommandError(f"Unknown model '{label}' in mapping") from exc
    matches = [m for m in target_models() if m.__name__.lower() == label.lower()]
    if len(matches) != 1:
        raise CommandError(f"Ambiguous or unknown model '{label}'")
    return matches[0]


# ---------------------------------------------------------------------------
# Apply engine
# ---------------------------------------------------------------------------

class RefStore:
    """In-memory legacy PK -> imported object map, per source table."""

    def __init__(self):
        self.data = defaultdict(dict)

    def put(self, table, legacy_pk, obj):
        self.data[table][str(legacy_pk)] = obj

    def get(self, table, legacy_pk):
        return self.data[table].get(str(legacy_pk))


def table_dependencies(mapping):
    deps = {}
    refs = {}
    for entry in mapping["tables"]:
        source = entry["source"]
        deps[source] = set()
        for spec in entry.get("fields", {}).values():
            if not isinstance(spec, dict):
                continue
            fk = spec.get("fk")
            if fk and fk.get("ref"):
                refs.setdefault(fk["ref"], set()).add(source)
        if entry.get("key_source_table"):
            refs.setdefault(entry["key_source_table"], set()).add(source)
    # A table that others reference must be imported first.
    for ref, users in refs.items():
        for user in users:
            if ref != user:
                deps.setdefault(user, set()).add(ref)
    return deps


def topological_order(mapping):
    deps = table_dependencies(mapping)
    ordered, pending = [], OrderedDict((e["source"], e) for e in mapping["tables"])
    guard = 0
    while pending and guard < len(pending) + 5:
        progress = False
        for source in list(pending.keys()):
            if not (deps.get(source, set()) & set(pending.keys())):
                ordered.append(pending.pop(source))
                progress = True
        if not progress:
            break
        guard += 1
    ordered.extend(pending.values())  # cycles: keep declared order
    return ordered


def build_value(row, spec, field=None):
    """Return (value, fk_meta) for a field spec."""
    if not isinstance(spec, dict):
        spec = {"source": spec}
    if "constant" in spec:
        return spec["constant"], None
    source = spec.get("source")
    value = row.get(source) if source else None
    if spec.get("required", False) and is_null(value):
        raise ValueError(f"required value missing for '{source}'")
    if is_null(value):
        value = None
    else:
        if isinstance(spec, dict) and spec.get("map"):
            lookup = spec["map"]
            value = lookup.get(str(value), lookup.get(value, spec.get("default")))
        value = apply_transform(value, spec.get("transform"))
    if value is None and "default" in spec:
        value = spec["default"]
    elif (value is None and field and not getattr(field, "null", False)
          and getattr(field, "get_internal_type", lambda: "")() in ("CharField", "TextField")):
        value = ""
    return value, spec.get("fk")


def apply_mapping(mapping, sources, options, stdout):
    refs = RefStore()
    report = []
    defaults = mapping.get("defaults") or {}
    models_by_source = {}
    total = {"created": 0, "updated": 0, "skipped": 0, "failed": 0}

    ordered = topological_order(mapping)

    only = options.get("only")
    only_set = {x.strip() for x in only.split(",")} if only else None

    for entry in ordered:
        source = entry["source"]
        if only_set and source not in only_set:
            continue
        if not entry.get("target"):
            stdout.write(f"SKIP  {source}: no target model assigned")
            continue
        model = resolve_model(entry["target"])
        models_by_source[source] = model
        info = sources.get(source)
        if info is None:
            report.append({"source": source, "status": "missing_source",
                           "created": 0, "updated": 0, "failed": 0})
            continue
        if info.get("kind") != "csv":
            stdout.write(f"SKIP  {source}: schema-only (no CSV data)")
            continue

        key = entry.get("key")
        key_fields = [key] if isinstance(key, str) else list(key or [])
        memo_pk_source = entry.get("key_source") or find_pk_column(info, source)
        constants = {**defaults, **(entry.get("constants") or {})}
        limit = options.get("limit")
        created = updated = skipped = failed = 0
        errors = []

        line_no = 0
        for row in read_rows(info):
            line_no += 1
            if limit and line_no - 1 >= limit:
                break
            try:
                with transaction.atomic():
                    kwargs = {}
                    for field_name, constant in constants.items():
                        kwargs[field_name] = constant
                    for field_name, spec in entry.get("fields", {}).items():
                        field = model._meta.get_field(field_name) if field_name != "id" else model._meta.pk
                        value, fk = build_value(row, spec, field)
                        if fk:
                            if value is None:
                                if fk.get("required", False):
                                    raise ValueError(f"FK {field_name}: required foreign key is null")
                                value = None
                            else:
                                if fk.get("ref"):
                                    related = refs.get(fk["ref"], value)
                                else:
                                    related_model = resolve_model(fk["model"])
                                    lookup = fk.get("lookup", "pk")
                                    related = related_model.objects.filter(**{lookup: value}).first() if value is not None else None
                                if related is None:
                                    if fk.get("required", True):
                                        raise ValueError(f"FK {field_name}: no match for {value!r}")
                                    value = None
                                else:
                                    value = related
                        elif isinstance(value, str) and field.is_relation:
                            raise ValueError(
                                f"FK {field_name} got raw value {value!r}; add an fk: block "
                                "(model/lookup or ref) to the mapping"
                            )
                        elif value is None:
                            if not field.is_relation and not getattr(field, "null", False):
                                if getattr(field, "has_default", lambda: False)():
                                    val_def = field.get_default() if callable(field.get_default) else field.default
                                    value = val_def if val_def is not None else ""
                                elif field.get_internal_type() in ("CharField", "TextField"):
                                    value = ""
                        elif not field.is_relation:
                            value = convert_for_field(field, value, spec)
                        kwargs[field_name] = value

                    if model.__name__ == "User" and kwargs.get("username") == "admin" and model.objects.filter(username="admin").exists():
                        kwargs.pop("password", None)

                    if key_fields:
                        lookup = {f: kwargs[f] for f in key_fields}
                        if any(v is None for v in lookup.values()):
                            skipped += 1
                            continue
                        obj, was_created = model.objects.update_or_create(defaults=kwargs, **lookup)
                    else:
                        obj, was_created = model.objects.create(**kwargs), True
                    if was_created:
                        created += 1
                    else:
                        updated += 1
                    if memo_pk_source and entry.get("remember", True):
                        refs.put(source, row.get(memo_pk_source), obj)
            except Exception as exc:  # noqa: BLE001 - report and continue
                failed += 1
                if len(errors) < 50:
                    errors.append(f"row {line_no}: {exc}")
                if options.get("stop_on_error"):
                    raise CommandError(f"{source} row {line_no}: {exc}") from exc

        total["created"] += created
        total["updated"] += updated
        total["skipped"] += skipped
        total["failed"] += failed
        status = "ok" if failed == 0 else "partial"
        report.append({"source": source, "target": entry["target"], "status": status,
                       "created": created, "updated": updated, "skipped": skipped,
                       "failed": failed, "errors": errors})
        stdout.write(f"{'DRY' if options.get('dry_run') else 'OK '}  {source} -> {entry['target']}: "
                     f"created={created} updated={updated} skipped={skipped} failed={failed}")
        for err in errors[:5]:
            stdout.write(f"      ! {err}")
    return report, total


class _Rollback(Exception):
    pass


def find_pk_column(info, table):
    names = [c["name"] for c in info["columns"]]
    hints = [f"{table}id", "id", f"{singular(table)}id", "pk", "code"]
    for hint in hints:
        for name in names:
            if normalize(name) == normalize(hint):
                return name
    return None


def reset_sequences(models, stdout):
    """Advance PostgreSQL identity sequences after inserting explicit ids."""
    from django.db import connection

    for model in {m for m in models if m is not None}:
        table = model._meta.db_table
        pk = model._meta.pk
        if isinstance(pk, (AutoField, BigAutoField, SmallAutoField)):
            column = pk.column
        else:
            continue
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_get_serial_sequence(%s, %s)", [table, column])
                row = cursor.fetchone()
                sequence = row[0] if row else None
                if not sequence:
                    continue
                cursor.execute(f'SELECT COALESCE(MAX("{column}"), 0) FROM "{table}"')
                max_id = cursor.fetchone()[0] or 0
                if max_id > 0:
                    cursor.execute("SELECT setval(%s, %s)", [sequence, max_id])
                else:
                    cursor.execute("SELECT setval(%s, 1, false)", [sequence])
        except Exception as exc:  # noqa: BLE001
            stdout.write(f"      ! sequence reset failed for {table}: {exc}")


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def write_analysis(path, report):
    lines = ["# MSSQL import analysis", ""]
    lines.append(f"Source tables: **{len(report)}**")
    lines.append("")
    lines.append("| Source table | Rows | Target model | Confidence | Unmapped cols | Missing required |")
    lines.append("|---|---:|---|---:|---|---|")
    for entry in report:
        lines.append(
            f"| `{entry['source']}` | {entry.get('rows', 0)} | `{entry.get('target') or '-'}` | "
            f"{entry.get('confidence', 0)} | {len(entry.get('unmapped_source_columns', []))} | "
            f"{len(entry.get('unmapped_required_target_fields', []))} |"
        )
    lines.append("")
    for entry in report:
        lines.append(f"## {entry['source']}")
        if entry.get("target"):
            lines.append(f"Target: `{entry['target']}`")
        else:
            lines.append("Target: **needs manual assignment**")
        if entry.get("unmapped_source_columns"):
            lines.append(f"\nUnmapped source columns: {', '.join(entry['unmapped_source_columns'])}")
        if entry.get("unmapped_required_target_fields"):
            lines.append(f"\nRequired target fields not filled: {', '.join(entry['unmapped_required_target_fields'])}")
        if entry.get("notes"):
            lines.append(f"\nNotes: {'; '.join(entry['notes'])}")
        lines.append("")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def write_mapping(path, mapping):
    with open(path, "w", encoding="utf-8") as fh:
        yaml.safe_dump(mapping, fh, allow_unicode=True, sort_keys=False, width=120)


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

class Command(BaseCommand):
    help = "Analyze a SQL Server export and import it into the Nexivo PostgreSQL schema."

    def add_arguments(self, parser):
        parser.add_argument("--source", required=True,
                            help="Folder containing CSV files and/or a schema .sql file.")
        parser.add_argument("--analyze", action="store_true",
                            help="Analyze the source and write mssql_mapping.yaml + mssql_analysis.md.")
        parser.add_argument("--apply", action="store_true",
                            help="Import rows using the mapping file.")
        parser.add_argument("--mapping", default=None,
                            help="Path to the mapping YAML (default: <source>/mssql_mapping.yaml).")
        parser.add_argument("--out", default=None,
                            help="Folder for mapping/analysis output (default: source folder).")
        parser.add_argument("--dry-run", action="store_true",
                            help="Validate and count without keeping any row.")
        parser.add_argument("--limit", type=int, default=None,
                            help="Import at most N rows per table (testing).")
        parser.add_argument("--stop-on-error", action="store_true",
                            help="Abort on the first rejected row.")
        parser.add_argument("--only", default=None,
                            help="Comma-separated source table names to import.")
        parser.add_argument("--report", default=None,
                            help="Write a JSON import report to this path.")
        parser.add_argument("--no-reset-sequences", action="store_true",
                            help="Do not advance PostgreSQL id sequences after import.")

    def handle(self, *args, **options):
        source = options["source"]
        out_dir = options["out"] or (source if os.path.isdir(source) else os.path.dirname(source) or ".")
        os.makedirs(out_dir, exist_ok=True)
        mapping_path = options["mapping"] or os.path.join(out_dir, "mssql_mapping.yaml")

        if not options["analyze"] and not options["apply"]:
            options["analyze"] = True

        if options["analyze"]:
            sources = discover_sources(source)
            if not sources:
                raise CommandError("No .csv or .sql files found in the source path.")
            mapping, report = auto_mapping(sources)
            write_mapping(mapping_path, mapping)
            analysis_path = os.path.join(out_dir, "mssql_analysis.md")
            write_analysis(analysis_path, report)
            matched = sum(1 for e in report if e.get("target"))
            self.stdout.write(self.style.SUCCESS(
                f"Analyzed {len(report)} source tables ({matched} auto-matched)."))
            self.stdout.write(f"Mapping:  {mapping_path}")
            self.stdout.write(f"Report:   {analysis_path}")
            self.stdout.write("Review the mapping, fix targets/FKs, then run with --apply.")
            if not options["apply"]:
                return

        if not os.path.exists(mapping_path):
            raise CommandError(f"Mapping not found: {mapping_path}. Run --analyze first.")
        with open(mapping_path, "r", encoding="utf-8") as fh:
            mapping = yaml.safe_load(fh) or {}
        if not mapping.get("tables"):
            raise CommandError("Mapping has no 'tables' section.")

        sources = discover_sources(source)
        from django.conf import settings as django_settings
        target = django_settings.DATABASES["default"]
        self.stdout.write(
            f"Target database: {target.get('NAME')} @ {target.get('HOST')}:{target.get('PORT')}"
            + ("  (dry-run, nothing will be committed)" if options.get("dry_run") else "")
        )
        try:
            with transaction.atomic():
                report, total = apply_mapping(mapping, sources, options, self.stdout)
                if options.get("dry_run"):
                    raise _Rollback()
        except _Rollback:
            pass
        if not options.get("dry_run") and not options.get("no_reset_sequences"):
            models = [resolve_model(e["target"]) for e in mapping["tables"] if e.get("target")]
            reset_sequences(models, self.stdout)
            try:
                from apps.billing.services.backup import sync_letter_numbering
                sync_res = sync_letter_numbering()
                self.stdout.write(
                    f"Synced letter sequences: bumped={sync_res.get('sequences_bumped', 0)}, "
                    f"recycled_cleaned={sync_res.get('recycled_numbers_removed', 0)}"
                )
            except Exception as exc:  # noqa: BLE001
                self.stdout.write(f"      ! letter sequence sync notice: {exc}")
        if options.get("report"):
            with open(options["report"], "w", encoding="utf-8") as fh:
                json.dump({"tables": report, "total": total}, fh, ensure_ascii=False, indent=2)
        summary = (f"Done: created={total['created']} updated={total['updated']} "
                   f"skipped={total['skipped']} failed={total['failed']}")
        if options.get("dry_run"):
            self.stdout.write(self.style.WARNING("Dry run - nothing was committed. " + summary))
        elif total["failed"]:
            self.stdout.write(self.style.WARNING(summary))
        else:
            self.stdout.write(self.style.SUCCESS(summary))
