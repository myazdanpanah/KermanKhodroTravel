FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# PDF generation needs both backends present in the image: Chromium drives the
# invoice path (headless, one process per request) and Pango - pulled in with
# the WeasyPrint fallback libraries - renders the same HTML when no browser is
# found. Persian glyphs come from Vazirmatn/Noto, otherwise letters print as
# empty boxes.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    chromium \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libffi8 \
    libjpeg62-turbo \
    libopenjp2-7 \
    fonts-vazirmatn \
    fonts-noto-core \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["gunicorn", "nexivo.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]
