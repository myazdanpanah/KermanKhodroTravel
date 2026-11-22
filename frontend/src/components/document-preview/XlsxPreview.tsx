/** XLSX preview: sheet tabs and read-only cell tables (SheetJS, Apache-2.0). */
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

const MAX_ROWS = 500;

export default function XlsxPreview({ blob }: { blob: Blob }) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [active, setActive] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setWorkbook(null);
    setError('');
    blob.arrayBuffer()
      .then((buffer) => {
        const parsed = XLSX.read(buffer, { type: 'array' });
        setWorkbook(parsed);
        setActive(parsed.SheetNames[0] || '');
      })
      .catch(() => setError('خواندن فایل Excel ممکن نشد.'));
  }, [blob]);

  if (error) return <p className="py-16 text-center text-sm text-nx-danger">{error}</p>;
  if (!workbook) return <p className="py-16 text-center text-sm text-slate-500 dark:text-nx-mist">در حال خواندن فایل Excel…</p>;

  const sheet = active ? workbook.Sheets[active] : null;
  const raw = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' }) : [];
  const visible = raw.slice(0, MAX_ROWS);
  const width = visible.reduce((max, row) => Math.max(max, row.length), 0);

  return (
    <div className="nx-uploaded-fonts flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-nx-border px-3 py-2 dark:border-nx-navy-border">
        {workbook.SheetNames.map((name) => (
          <button key={name} onClick={() => setActive(name)}
            className={`rounded-lg px-2.5 py-1 text-[11px] ${
              name === active
                ? 'bg-nx-teal/10 text-nx-teal dark:bg-nx-blue/15 dark:text-nx-blue'
                : 'text-slate-600 hover:bg-black/5 dark:text-nx-mist dark:hover:bg-white/5'
            }`}>
            {name}
          </button>
        ))}
        <span className="ms-auto text-[10px] text-slate-500 dark:text-nx-mist">
          {raw.length.toLocaleString('fa-IR')} ردیف
          {raw.length > MAX_ROWS ? ` · نمایش ${MAX_ROWS.toLocaleString('fa-IR')} ردیف اول` : ''}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="min-w-full text-xs">
          <tbody>
            {visible.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-nx-border/60 dark:border-nx-navy-border/60">
                {Array.from({ length: width }).map((_, cellIndex) => (
                  <td key={cellIndex}
                    className={`whitespace-nowrap border-e border-nx-border/40 px-2 py-1 dark:border-nx-navy-border/40 ${
                      rowIndex === 0
                        ? 'bg-slate-100 font-medium text-nx-navy dark:bg-nx-navy dark:text-white'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}>
                    {row[cellIndex] === '' || row[cellIndex] == null ? '' : String(row[cellIndex])}
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
