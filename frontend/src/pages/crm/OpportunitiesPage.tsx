/**
 * Opportunities Page
 */

import { useState, useEffect } from 'react';
import { Plus, Search, TrendingUp } from 'lucide-react';
import { crmApi, Opportunity } from '../../api/crm';
import { useToast } from '../../components/Toast';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  prospecting: { label: 'جستجو', color: 'bg-nx-blue/10 text-nx-blue' },
  qualification: { label: 'تایید', color: 'bg-nx-blue/10 text-nx-blue' },
  proposal: { label: 'پیشنهاد', color: 'bg-nx-warning-100 text-nx-warning-700' },
  negotiation: { label: 'مذاکره', color: 'bg-nx-blue/10 text-nx-blue' },
  closed_won: { label: 'برده شده', color: 'bg-nx-teal/10 text-nx-teal' },
  closed_lost: { label: 'از دست رفته', color: 'bg-nx-danger-100 text-nx-danger-700' },
};

const STAGE_LABELS: Record<string, string> = {
  lead: 'سرنخ', qualified: 'تایید شده', proposal_sent: 'پیشنهاد ارسال شده',
  verbal_agreement: 'توافق شفاهی', contract_sent: 'قرارداد ارسال شده', closed: 'بسته شده',
};

export default function OpportunitiesPage() {
  const { toast } = useToast();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', estimated_value: 0, probability: 0, description: '' });

  useEffect(() => {
    crmApi.getOpportunities().then(r => setOpps(r.data.data)).catch(() => toast('خطا در دریافت فرصت‌ها', 'error')).finally(() => setLoading(false));
  }, []);

  const filtered = opps.filter(o => !search || o.name.includes(search));

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
          <p className="text-sm text-nx-mist dark:text-nx-mist mt-1">{filtered.length} فرصت</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue transition-colors">
          <Plus className="h-4 w-4" /> فرصت جدید
        </button>
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

      <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-nx-mist dark:text-nx-mist"><TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ فرصتی یافت نشد</p></div>
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
                    <td className="px-4 py-3 font-medium">{opp.name}</td>
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
    </div>
  );
}
