/** CSV/TSV viewer: delimiter detection, sticky header, search, sort, paging. */
import { useEffect, useMemo, useState } from 'react';

function detectDelimiter(line: string): string {
  const counts: Record<string, number> = {
    ',': (line.match(/,/g) || []).length,
    ';': (line.match(/;/g) || []).length,
    '\t': (line.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ',';
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === delimiter) { row.push(cell); cell = ''; continue; }
    if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    if (char !== '\r') cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const PAGE_SIZE = 50;

export default function TablePreview({ blob }: { blob: Blob }) {
  const [rows, setRows] = useState<string[][]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ column: number; direction: 1 | -1 } | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    setRows([]);
    setPage(1);
    setSort(null);
    blob.text()
      .then((text) => {
        const clean = text.replace(/^\uFEFF/, '');
        const firstLine = clean.split(/\r?\n/).find((line) => line.trim()) || '';
        setRows(parseDelimited(clean, detectDelimiter(firstLine)));
      })
      .catch(() => setError('خواندن فایل جدولی ممکن نشد.'));
  }, [blob]);

  const header = rows[0] || [];
  const body = useMemo(() => {
    let data = rows.slice(1);
    const term = query.trim();
    if (term) data = data.filter((row) => row.some((cell) => cell.includes(term)));
    if (sort) {
      data = [...data].sort((a, b) => {
        const left = a[sort.column] || '';
        const right = b[sort.column] || '';
        const leftNumber = Number(left.replace(/[,\s]/g, ''));
        const rightNumber = Number(right.replace(/[,\s]/g, ''));
        if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && left && right) {
          return (leftNumber - rightNumber) * sort.direction;
        }
        return left.localeCompare(right, 'fa') * sort.direction;
      });
    }
    return data;
  }, [rows, query, sort]);

  const pageCount = Math.max(1, Math.ceil(body.length / PAGE_SIZE));
  const visible = body.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (error) return <p className="py-16 text-center text-sm text-nx-danger">{error}</p>;
  if (!rows.length) return <p className="py-16 text-center text-sm text-slate-500 dark:text-nx-mist">در حال خواندن جدول…</p>;

  return (
    <div className="nx-uploaded-fonts flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-nx-border px-3 py-2 dark:border-nx-navy-border">
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }}
          placeholder="جستجو در جدول…"
          className="w-44 rounded-lg border border-nx-border bg-transparent px-2 py-1 text-[11px] dark:border-nx-navy-border dark:text-white" />
        <span className="text-[10px] text-slate-500 dark:text-nx-mist">
          {body.length.toLocaleString('fa-IR')} ردیف · {header.length.toLocaleString('fa-IR')} ستون
        </span>
        <div className="ms-auto flex items-center gap-2 text-[11px] text-slate-600 dark:text-nx-mist">
          <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}
            className="rounded border border-nx-border px-2 py-1 disabled:opacity-40 dark:border-nx-navy-border">قبلی</button>
          <span>{page.toLocaleString('fa-IR')} / {pageCount.toLocaleString('fa-IR')}</span>
          <button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}
            className="rounded border border-nx-border px-2 py-1 disabled:opacity-40 dark:border-nx-navy-border">بعدی</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 bg-slate-100 dark:bg-nx-navy">
            <tr>
              {header.map((cell, index) => (
                <th key={index}
                  onClick={() => setSort((prev) => prev?.column === index ? { column: index, direction: prev.direction === 1 ? -1 : 1 } : { column: index, direction: 1 })}
                  className="cursor-pointer whitespace-nowrap border-b border-nx-border px-3 py-2 text-right font-medium text-nx-navy dark:border-nx-navy-border dark:text-white">
                  {cell || '—'}{sort?.column === index ? (sort.direction === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-nx-border/60 dark:border-nx-navy-border/60">
                {header.map((_, cellIndex) => (
                  <td key={cellIndex} className="whitespace-nowrap px-3 py-1.5 text-slate-700 dark:text-slate-200">
                    {row[cellIndex] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
