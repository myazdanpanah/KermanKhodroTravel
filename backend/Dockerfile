# PDF generation needs a real browser, so the runtime image ships Chromium and
# the Pango stack (WeasyPrint's fallback) plus the Persian/Latin fonts. The
# compiler toolchain stays in the builder stage, which keeps the shipped image
# to the runtime libraries only.
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Only needed to install the Python dependencies; none of this ships.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt


FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Chromium drives the invoice PDF path (headless, one process per request) and
# Pango from the WeasyPrint fallback libraries renders the same HTML when no
# browser is found. Persian glyphs come from Vazirmatn/Noto, otherwise letters
# print as empty boxes. --no-install-recommends plus the apt lists cleanup keep
# the layer to what these packages actually need.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libffi8 \
    libpq5 \
    libjpeg62-turbo \
    libopenjp2-7 \
    fonts-vazirmatn \
    fonts-noto-core \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
COPY . .

EXPOSE 8000

CMD ["gunicorn", "nexivo.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]
