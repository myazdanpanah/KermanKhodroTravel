/** TXT/LOG viewer with line numbers, search and a size guard. */
import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_LINES = 5000;

export default function TextPreview({ blob }: { blob: Blob }) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [truncated, setTruncated] = useState(false);
  const matchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText('');
    setNote('');
    if (blob.size > MAX_BYTES) {
      setTruncated(true);
      blob.slice(0, MAX_BYTES).text().then(setText);
      return;
    }
    setTruncated(false);
    blob.text().then(setText).catch(() => setNote('خواندن فایل ممکن نشد.'));
  }, [blob]);

  const lines = useMemo(() => {
    const all = text.replace(/\r\n/g, '\n').split('\n');
    return all.length > MAX_LINES ? all.slice(0, MAX_LINES) : all;
  }, [text]);

  const matchIndex = useMemo(() => {
    const term = query.trim();
    if (!term) return -1;
    return lines.findIndex((line) => line.includes(term));
  }, [lines, query]);

  useEffect(() => {
    if (matchIndex >= 0) matchRef.current?.scrollIntoView({ block: 'center' });
  }, [matchIndex]);

  return (
    <div className="nx-uploaded-fonts flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-nx-border px-3 py-2 dark:border-nx-navy-border">
        <input value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="جستجو در متن…"
          className="w-48 rounded-lg border border-nx-border bg-transparent px-2 py-1 text-[11px] dark:border-nx-navy-border dark:text-white" />
        {query.trim() && (
          <span className="text-[10px] text-slate-500 dark:text-nx-mist">
            {matchIndex >= 0 ? `خط ${(matchIndex + 1).toLocaleString('fa-IR')}` : 'یافت نشد'}
          </span>
        )}
        <span className="text-[10px] text-slate-500 dark:text-nx-mist">
          {lines.length.toLocaleString('fa-IR')} خط
          {truncated ? ' · نمایش بخشی از فایل بزرگ' : ''}
        </span>
      </div>
      <div className="flex-1 overflow-auto bg-white p-2 dark:bg-nx-navy">
        {note ? (
          <p className="py-10 text-center text-sm text-nx-danger">{note}</p>
        ) : (
          <div className="font-mono text-[11px] leading-5" dir="auto">
            {lines.map((line, index) => (
              <div key={index} ref={index === matchIndex ? matchRef : undefined}
                className={`flex gap-2 px-1 ${index === matchIndex ? 'bg-amber-200/50 dark:bg-amber-500/20' : ''}`}>
                <span className="w-10 shrink-0 select-none text-right text-slate-400" data-digits="latin">
                  {(index + 1).toLocaleString('fa-IR')}
                </span>
                <span className="whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200">{line || ' '}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
