/**
 * Opportunities Page
 */

import { useRef, useState, useEffect } from 'react';
import { LayoutGrid, List, Plus, Search, TrendingUp } from 'lucide-react';
import { crmApi, Opportunity } from '../../api/crm';
import OpportunityRecordPanel from './OpportunityRecordPanel';
import { useToast } from '../../components/Toast';
import { useAuthStore } from '../../store/authStore';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  prospecting: { label: 'جستجو', color: 'bg-nx-blue/10 text-nx-blue' },
  qualification: { label: 'تایید', color: 'bg-nx-blue/10 text-nx-blue' },
  proposal: { label: 'پیشنهاد', color: 'bg-nx-warning-100 text-nx-warning-700' },
  negotiation: { label: 'مذاکره', color: 'bg-nx-blue/10 text-nx-blue' },
  closed_won: { label: 'برده شده', color: 'bg-nx-teal/10 text-nx-teal' },
  closed_lost: { label: 'از دست رفته', color: 'bg-nx-danger-100 text-nx-danger-700' },
};

// Twenty-style pipeline: the four open funnel stages, left to right.
const BOARD_COLUMNS = [
  { key: 'prospecting', label: 'جستجو' },
  { key: 'qualification', label: 'تایید' },
  { key: 'proposal', label: 'پیشنهاد' },
  { key: 'negotiation', label: 'مذاکره' },
];

const STAGE_LABELS: Record<string, string> = {
  lead: 'سرنخ', qualified: 'تایید شده', proposal_sent: 'پیشنهاد ارسال شده',
  verbal_agreement: 'توافق شفاهی', contract_sent: 'قرارداد ارسال شده', closed: 'بسته شده',
};

export default function OpportunitiesPage() {
  const { toast } = useToast();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const userId = useAuthStore(state => state.user?.id);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', estimated_value: 0, probability: 0, description: '' });
  const [view, setView] = useState<'board' | 'list'>('board');
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    crmApi.getOpportunities().then(r => setOpps(r.data.data)).catch(() => toast('خطا در دریافت فرصت‌ها', 'error')).finally(() => setLoading(false));
  }, []);

  const filtered = opps.filter(o =>
    (!search || o.name.includes(search)) && (!onlyMine || o.assigned_to === userId),
  );

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      const res = await crmApi.createOpportunity(form);
      setOpps(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', estimated_value: 0, probability: 0, description: '' });
      toast('فرصت ایجاد شد', 'success');
    } catch { toast('خطا در ایجاد فرصت', 'error'); }
  };

  const moveCard = async (opp: Opportunity, status: string) => {
    if (opp.status === status || opp.status.startsWith('closed_')) return;
    const previous = opp.status;
    setOpps(prev => prev.map(o => (o.id === opp.id ? { ...o, status } : o)));
    try {
      const res = await crmApi.moveOpportunity(opp.id, status);
      setOpps(prev => prev.map(o => (o.id === opp.id ? res.data.data : o)));
      toast('مرحلهٔ فرصت به‌روزرسانی شد', 'success');
    } catch {
      // Put the card back where it came from; the server refused the move.
      setOpps(prev => prev.map(o => (o.id === opp.id ? { ...o, status: previous } : o)));
      toast('جابه‌جایی فرصت انجام نشد', 'error');
    }
  };

  const handleCloseWon = async (id: number) => {
    try {
      const res = await crmApi.closeWon(id);
      setOpps(prev => prev.map(o => o.id === id ? res.data.data : o));
      toast('فرصت بسته شد (برد)', 'success');
    } catch { toast('خطا در بستن فرصت', 'error'); }
  };

  const handleCloseLost = async (id: number) => {
    const reason = window.confirm('دلیل از دست رفتن؟');
    try {
      const res = await crmApi.closeLost(id, reason ? 'User confirmed' : '');
      setOpps(prev => prev.map(o => o.id === id ? res.data.data : o));
      toast('فرصت بسته شد (باخت)', 'success');
    } catch { toast('خطا در بستن فرصت', 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-nx-teal" /> فرصت‌ها
          </h1>
          <p className="text-sm text-slate-300 mt-1">{filtered.length} فرصت</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-nx-border dark:border-nx-navy-border overflow-hidden">
            <button
              onClick={() => setView('board')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm ${view === 'board' ? 'bg-nx-blue text-white' : 'text-slate-600 dark:text-slate-200 hover:bg-nx-mist/40'}`}
            >
              <LayoutGrid className="h-4 w-4" /> برد
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm ${view === 'list' ? 'bg-nx-blue text-white' : 'text-slate-600 dark:text-slate-200 hover:bg-nx-mist/40'}`}
            >
              <List className="h-4 w-4" /> فهرست
            </button>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue transition-colors">
            <Plus className="h-4 w-4" /> فرصت جدید
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">نام *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">ارزش تخمینی</label>
              <input type="number" value={form.estimated_value} onChange={e => setForm({ ...form, estimated_value: Number(e.target.value) })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">احتمال %</label>
              <input type="number" value={form.probability} onChange={e => setForm({ ...form, probability: Number(e.target.value) })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-nx-mist">انصراف</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue text-sm">ایجاد</button>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nx-mist" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
          className="w-full pr-10 pl-4 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
      </div>

      <button
        onClick={() => setOnlyMine(value => !value)}
        className={`px-3 py-2 rounded-lg text-sm border ${
          onlyMine
            ? 'bg-nx-blue text-white border-nx-blue'
            : 'bg-white dark:bg-nx-navy text-nx-navy dark:text-white border-nx-mist dark:border-nx-muted'
        }`}
      >
        فقط فرصت‌های من
      </button>

      {view === 'board' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {BOARD_COLUMNS.map(col => {
              const cards = filtered.filter(o => o.status === col.key);
              const total = cards.reduce((sum, o) => sum + Number(o.estimated_value || 0), 0);
              return (
                <div
                  key={col.key}
                  onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
                  onDragLeave={() => setDragOver(current => (current === col.key ? null : current))}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(null);
                    const id = Number(e.dataTransfer.getData('text/plain') || draggingId || 0);
                    const card = opps.find(o => o.id === id);
                    setDraggingId(null);
                    if (card) void moveCard(card, col.key);
                  }}
                  className={`rounded-xl border bg-white dark:bg-nx-navy p-3 min-h-[8rem] transition-shadow ${
                    dragOver === col.key
                      ? 'border-nx-blue ring-2 ring-nx-blue/30'
                      : 'border-nx-border dark:border-nx-navy-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-nx-navy dark:text-white">{col.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-nx-mist/50 dark:bg-nx-navy-border text-slate-600 dark:text-slate-200">
                      {cards.length.toLocaleString('fa-IR')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-300 mb-3">
                    {total.toLocaleString('fa-IR')} ریال
                  </p>
                  <div className="space-y-2">
                    {cards.map(opp => (
                      <div
                        key={opp.id}
                        draggable
                        onMouseDown={() => { draggedRef.current = false; }}
                        onDragStart={e => {
                          draggedRef.current = true;
                          setDraggingId(opp.id);
                          e.dataTransfer.setData('text/plain', String(opp.id));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={() => {
                          // A drop can end with a click in some browsers; it must
                          // not also open the record panel.
                          if (draggedRef.current) {
                            draggedRef.current = false;
                            return;
                          }
                          setSelected(opp);
                        }}
                        className={`rounded-lg border border-nx-border dark:border-nx-navy-border bg-nx-mist/20 dark:bg-nx-navy-border/40 p-3 cursor-pointer active:cursor-grabbing hover:border-nx-blue/60 ${
                          draggingId === opp.id ? 'opacity-50' : ''
                        }`}
                      >
                        <p className="text-sm font-medium text-nx-navy dark:text-white">{opp.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{opp.customer_name || 'بدون مشتری'}</p>
                        <div className="flex items-center justify-between mt-2 text-xs text-slate-600 dark:text-slate-200">
                          <span>{Number(opp.estimated_value).toLocaleString('fa-IR')} ریال</span>
                          <span>{opp.probability.toLocaleString('fa-IR')}٪</span>
                        </div>
                      </div>
                    ))}
                    {cards.length === 0 && (
                      <p className="text-xs text-center text-slate-400 dark:text-slate-400 py-6">کارت را اینجا رها کنید</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['closed_won', 'closed_lost'] as const).map(key => {
              const cards = filtered.filter(o => o.status === key);
              const total = cards.reduce((sum, o) => sum + Number(o.estimated_value || 0), 0);
              return (
                <div key={key} className="rounded-xl border border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-nx-navy dark:text-white">{STATUS_MAP[key].label}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-300">
                    {cards.length.toLocaleString('fa-IR')} فرصت · {total.toLocaleString('fa-IR')} ریال
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'list' && (
      <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-200"><TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ فرصتی یافت نشد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">نام</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">مشتری</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">مرحله</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">ارزش</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">احتمال</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(opp => (
                  <tr key={opp.id} className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy">
                    <td className="px-4 py-3 font-medium">
                      <button onClick={() => setSelected(opp)} className="hover:text-nx-blue">{opp.name}</button>
                    </td>
                    <td className="px-4 py-3 text-nx-mist">{opp.customer_name || '—'}</td>
                    <td className="px-4 py-3 text-xs">{STAGE_LABELS[opp.stage] || opp.stage}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${(STATUS_MAP[opp.status] || STATUS_MAP.prospecting).color}`}>
                        {(STATUS_MAP[opp.status] || STATUS_MAP.prospecting).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{opp.estimated_value.toLocaleString('fa-IR')}</td>
                    <td className="px-4 py-3 text-xs">{opp.probability}%</td>
                    <td className="px-4 py-3 flex gap-2">
                      {opp.status !== 'closed_won' && opp.status !== 'closed_lost' && (
                        <>
                          <button onClick={() => handleCloseWon(opp.id)} className="text-nx-teal hover:text-nx-teal text-xs">برد</button>
                          <button onClick={() => handleCloseLost(opp.id)} className="text-nx-danger-500 hover:text-nx-danger-700 text-xs">باخت</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {selected && (
        <OpportunityRecordPanel opportunity={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
