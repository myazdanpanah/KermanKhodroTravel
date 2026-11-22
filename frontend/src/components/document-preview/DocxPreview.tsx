/** DOCX preview in viewing mode (Casual Docs / DocxEditor, MIT). */
import { Component, Suspense, lazy, type ReactNode } from 'react';
import '@casualoffice/docs/styles.css';

const DocxEditor = lazy(() =>
  import('@casualoffice/docs/react').then((module) => ({ default: module.DocxEditor })),
);

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div className="py-16 text-center">
          <p className="text-sm text-nx-navy dark:text-white">نمایش این فایل Word ممکن نشد.</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-nx-mist">فایل را دانلود کنید یا نسخهٔ سالم آن را بارگذاری کنید.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DocxPreview({ blob }: { blob: Blob }) {
  return (
    <div className="nx-uploaded-fonts h-full overflow-auto bg-white">
      <PreviewBoundary>
        <Suspense fallback={<p className="py-16 text-center text-sm text-slate-500">در حال آماده‌سازی نمایشگر Word…</p>}>
          <DocxEditor documentBuffer={blob} mode="viewing" />
        </Suspense>
      </PreviewBoundary>
    </div>
  );
}
