/** Image viewer: fit-to-container, zoom, drag-to-pan and 90° rotation. */
import { useEffect, useRef, useState } from 'react';
import { RotateCw, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

const TOOL = 'rounded-lg border border-nx-border px-2 py-1.5 text-[11px] text-nx-navy dark:border-nx-navy-border dark:text-white';

export default function ImagePreview({ blob, fileName }: { blob: Blob; fileName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    setScale(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  const reset = () => {
    setScale(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-nx-border px-3 py-2 dark:border-nx-navy-border">
        <button className={TOOL} onClick={() => setScale((value) => Math.min(5, value + 0.25))} title="بزرگ‌نمایی">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button className={TOOL} onClick={() => setScale((value) => Math.max(0.25, value - 0.25))} title="کوچک‌نمایی">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button className={TOOL} onClick={() => setRotation((value) => (value + 90) % 360)} title="چرخش راست">
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button className={TOOL} onClick={() => setRotation((value) => (value + 270) % 360)} title="چرخش چپ">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button className={TOOL} onClick={reset}>بازنشانی</button>
        <span className="text-[10px] text-slate-500 dark:text-nx-mist">
          {Math.round(scale * 100).toLocaleString('fa-IR')}٪
          {dimensions ? ` · ${dimensions.w.toLocaleString('fa-IR')}×${dimensions.h.toLocaleString('fa-IR')}` : ''}
        </span>
      </div>
      <div
        className="flex-1 overflow-hidden p-4"
        style={{
          backgroundImage:
            'linear-gradient(45deg, rgba(148,163,184,.18) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,.18) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,.18) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,.18) 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
          cursor: scale > 1 ? 'grab' : 'default',
        }}
        onPointerDown={(event) => {
          if (scale <= 1) return;
          dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          setOffset({ x: drag.ox + event.clientX - drag.x, y: drag.oy + event.clientY - drag.y });
        }}
        onPointerUp={() => { dragRef.current = null; }}
      >
        {url && (
          <img
            src={url}
            alt={fileName}
            draggable={false}
            onLoad={(event) => setDimensions({
              w: event.currentTarget.naturalWidth,
              h: event.currentTarget.naturalHeight,
            })}
            className="mx-auto max-h-full max-w-full select-none object-contain"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)` }}
          />
        )}
      </div>
    </div>
  );
}
