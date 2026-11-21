/**
 * Desktop quick-add: a round button that bursts into a corner menu.
 *
 * The panel grows out of the button's corner (scale from bottom-left) and
 * collapses back into the circle on close. It only exists inside the ERP
 * shell, so the launcher and BI dashboards stay untouched.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useQuickActions } from '../lib/quickActions';

export default function QuickCreateButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const actions = useQuickActions();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <>
      {open && <div className="fixed inset-0 z-30 hidden lg:block" onClick={() => setOpen(false)} />}
      {/* RTL: items-end is the physical left edge, matching the page gutter. */}
      <div className="fixed bottom-7 left-8 z-40 hidden flex-col items-end lg:flex">
        <div
          className={`mb-3 w-64 origin-bottom-left rounded-2xl border border-nx-border bg-white p-2 shadow-2xl transition-all duration-300 ease-out dark:border-nx-navy-border dark:bg-nx-navy-elevated ${
            open ? 'scale-100 opacity-100' : 'pointer-events-none scale-0 opacity-0'
          }`}
          style={{ transformOrigin: 'left bottom' }}
        >
          <p className="px-2 pb-1 pt-0.5 text-[11px] text-slate-500 dark:text-nx-mist">ثبت جدید</p>
          {actions.map((action, index) => (
            <button
              key={action.to}
              onClick={() => { setOpen(false); navigate(action.to); }}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-right text-sm text-nx-navy transition hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/5"
              style={{
                transitionDelay: open ? `${60 + index * 45}ms` : '0ms',
                transitionProperty: 'opacity, transform',
                transitionDuration: '200ms',
                opacity: open ? 1 : 0,
                transform: open ? 'translateX(0)' : 'translateX(-6px)',
              }}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-nx-teal/15 text-nx-teal">
                <action.icon className="h-4 w-4" />
              </span>
              <span className="flex-1">{action.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setOpen((value) => !value)}
          aria-label="ثبت جدید"
          aria-expanded={open}
          className="grid h-14 w-14 place-items-center rounded-full bg-nx-teal text-white shadow-xl ring-4 ring-white transition-transform duration-300 hover:scale-105 active:scale-95 dark:ring-nx-navy"
        >
          <Plus className={`h-7 w-7 transition-transform duration-300 ${open ? 'rotate-45' : ''}`} />
        </button>
      </div>
    </>
  );
}
