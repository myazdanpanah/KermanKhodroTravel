/**
 * PDF preview via the browser's built-in PDF viewer.
 *
 * The file arrives as an authenticated Blob, so it is shown from a `blob:`
 * URL: no network request, nothing for download managers (IDM) to intercept,
 * and no PDF.js worker to boot. Embedded fonts (including Vazirmatn/B-series)
 * render exactly as the browser prints them, so Persian text is not reshaped.
 */
import { useEffect, useState } from 'react';

export default function PdfPreview({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl('');
    };
  }, [blob]);

  if (!url) {
    return <p className="py-16 text-center text-sm text-slate-500 dark:text-nx-mist">در حال آماده‌سازی PDF…</p>;
  }

  return (
    <iframe
      src={url}
      title="پیش‌نمایش PDF"
      className="h-full min-h-[70vh] w-full border-0 bg-white"
    />
  );
}
