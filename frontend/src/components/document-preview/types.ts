/** Shared types for the secure in-app document preview subsystem. */

export type PreviewKind =
  | 'pdf'
  | 'image'
  | 'docx'
  | 'xlsx'
  | 'table'
  | 'text'
  | 'unsupported';

export interface PreviewFile {
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/** Blob loaders keep the file authenticated: no public URL is ever created. */
export interface PreviewSource {
  file: PreviewFile;
  getBlob: () => Promise<Blob>;
}

const IMAGE_MIME = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp',
]);

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_MIME = 'application/vnd.ms-excel';

/** Decide the preview renderer from the backend MIME plus the file name. */
export function detectPreviewKind(mimeType: string, name: string): PreviewKind {
  const mime = (mimeType || '').toLowerCase();
  const extension = (name.split('.').pop() || '').toLowerCase();

  if (mime === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (IMAGE_MIME.has(mime) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(extension)) {
    return 'image';
  }
  if (mime === DOCX_MIME || extension === 'docx') return 'docx';
  if (mime === XLSX_MIME || mime === XLS_MIME || ['xlsx', 'xls'].includes(extension)) return 'xlsx';
  // SVG can carry active content; it is not rendered inline.
  if (['csv', 'tsv'].includes(extension) || mime === 'text/csv') return 'table';
  if (['txt', 'log'].includes(extension) || mime === 'text/plain') return 'text';
  return 'unsupported';
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '۰ بایت';
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} ${units[index]}`;
}
