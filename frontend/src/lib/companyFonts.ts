/**
 * Organization fonts uploaded in Settings, injected as @font-face rules so
 * DOCX files that reference "B Nazanin"/"B Titr" render with the real font.
 *
 * The family name is the uploaded name (default: the file name without its
 * extension), which must match the font name used inside the document.
 */
import api from '../api/client';

export interface CompanyFont {
  id: number;
  name: string;
  url: string;
}

let cached: CompanyFont[] | null = null;

export function getCachedFonts(): CompanyFont[] {
  return cached || [];
}

export async function loadCompanyFonts(force = false): Promise<CompanyFont[]> {
  if (cached && !force) return cached;
  try {
    const response = await api.get<CompanyFont[]>('/auth/fonts/');
    cached = response.data || [];
  } catch {
    cached = cached || [];
  }
  applyCompanyFonts(cached);
  return cached;
}

/** Rewrite the injected stylesheet; harmless when nothing is uploaded. */
export function applyCompanyFonts(fonts: CompanyFont[]) {
  const id = 'nx-company-fonts';
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = id;
    document.head.appendChild(style);
  }
  const faces = fonts.map((font) => {
    const extension = font.url.split('.').pop()?.toLowerCase() || 'ttf';
    const format = extension === 'otf' ? 'opentype' : extension === 'woff2' ? 'woff2' : extension === 'woff' ? 'woff' : 'truetype';
    return `@font-face { font-family: '${font.name.replace(/'/g, "\\'")}'; src: url('${font.url}') format('${format}'); font-display: swap; }`;
  });
  const families = fonts.map((font) => `'${font.name.replace(/'/g, "\\'")}'`).join(', ');
  style.textContent = [
    ...faces,
    // Fallback stack for previews without an explicit font (XLSX, CSV, TXT).
    `.nx-uploaded-fonts { font-family: ${families ? `${families}, ` : ''}Vazirmatn, Tahoma, sans-serif; }`,
  ].join('\n');
}
