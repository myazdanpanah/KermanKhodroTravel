/**
 * Shared document preview shell.
 *
 * Files are fetched as blobs through the caller's authenticated API, turned
 * into a short-lived object URL and revoked on close. The original file is
 * never modified and no permanent public URL exists.
 */
import { useEffect, useRef, useState } from 'react';
import { Download, Maximize2, Minimize2, X } from 'lucide-react';
import { detectPreviewKind, formatBytes, type PreviewSource } from './types';
import PdfPreview from './PdfPreview';
import ImagePreview from './ImagePreview';
import TablePreview from './TablePreview';
import TextPreview from './TextPreview';
import DocxPreview from './DocxPreview';
import XlsxPreview from './XlsxPreview';

type Status = 'loading' | 'ready' | 'error' | 'unsupported';

export default function DocumentPreviewModal({
  source,
  onClose,
}: {
  source: PreviewSource;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>('loading');
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const urlRef = useRef<string | null>(null);

  const kind = detectPreviewKind(source.file.mimeType, source.file.name);

  useEffect(() => {
    let cancelled = false;
    setStatus(kind === 'unsupported' ? 'unsupported' : 'loading');
    setBlob(null);
    setError('');

    source.getBlob()
      .then((fileBlob) => {
        if (cancelled) return;
        const typed = fileBlob.type
          ? fileBlob
          : new Blob([fileBlob], { type: source.file.mimeType || 'application/octet-stream' });
        const objectUrl = URL.createObjectURL(typed);
        urlRef.current = objectUrl;
        setBlob(typed);
        setUrl(objectUrl);
        if (kind !== 'unsupported') setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setError('دریافت فایل انجام نشد. دسترسی خود یا اتصال شبکه را بررسی کنید.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [source.file.name, source.file.mimeType, kind]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const download = () => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = source.file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const renderBody = () => {
    if (status === 'loading') {
      return <p className="py-16 text-center text-sm text-slate-500 dark:text-nx-mist">در حال بارگذاری پیش‌نمایش…</p>;
    }
    if (status === 'error') {
      return <p className="py-16 text-center text-sm text-nx-danger">{error}</p>;
    }
    if (status === 'unsupported' || !blob) {
      return (
        <div className="py-16 text-center">
          <p className="text-sm text-nx-navy dark:text-white">پیش‌نمایش این قالب در سیستم پشتیبانی نمی‌شود.</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-nx-mist">می‌توانید فایل اصلی را دانلود کنید.</p>
        </div>
      );
    }
    switch (kind) {
      case 'pdf':
        return <PdfPreview blob={blob} />;
      case 'image':
        return <ImagePreview blob={blob} fileName={source.file.name} />;
      case 'table':
        return <TablePreview blob={blob} />;
      case 'text':
        return <TextPreview blob={blob} />;
      case 'docx':
        return <DocxPreview blob={blob} />;
      case 'xlsx':
        return <XlsxPreview blob={blob} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-2 sm:p-4" onClick={onClose}>
      <div
        className={`flex w-full flex-col overflow-hidden rounded-xl border border-nx-border bg-white shadow-2xl dark:border-nx-navy-border dark:bg-nx-navy ${
          fullscreen ? 'h-full max-w-none' : 'h-[90vh] max-w-6xl'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-nx-border p-3 dark:border-nx-navy-border">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-nx-navy dark:text-white">{source.file.name}</p>
            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-nx-mist">
              {kind === 'unsupported' ? 'قالب ناشناخته' : kind.toUpperCase()} · {formatBytes(source.file.sizeBytes)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={download} disabled={!url}
              className="flex items-center gap-1 rounded-lg border border-nx-border px-2 py-1.5 text-[11px] text-nx-navy disabled:opacity-40 dark:border-nx-navy-border dark:text-white"
              title="دانلود فایل اصلی">
              <Download className="h-3.5 w-3.5" /> دانلود
            </button>
            <button onClick={() => setFullscreen((value) => !value)}
              className="rounded-lg border border-nx-border p-1.5 text-nx-navy dark:border-nx-navy-border dark:text-white"
              title={fullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}>
              {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onClose} className="p-1.5 text-nx-mist hover:text-nx-danger" title="بستن">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-slate-100 dark:bg-nx-navy-elevated">
          {renderBody()}
        </div>
      </div>
    </div>
  );
}
