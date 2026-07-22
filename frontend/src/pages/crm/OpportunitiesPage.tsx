/**
 * Opportunities Page
 */

import { useState, useEffect } from 'react';
import { Plus, Search, TrendingUp } from 'lucide-react';
import { crmApi, Opportunity } from '../../api/crm';
import { useToast } from '../../components/Toast';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  prospecting: { label: 'جستجو', color: 'bg-blue-100 text-blue-700' },
  qualification: { label: 'تایید', color: 'bg-purple-100 text-purple-700' },
  proposal: { label: 'پیشنهاد', color: 'bg-yellow-100 text-yellow-700' },
  negotiation: { label: 'مذاکره', color: 'bg-orange-100 text-orange-700' },
  closed_won: { label: 'برده شده', color: 'bg-green-100 text-green-700' },
  closed_lost: { label: 'از دست رفته', color: 'bg-red-100 text-red-700' },
};

const STAGE_LABELS: Record<string, string> = {
  lead: 'سرنخ', qualified: 'تایید شده', proposal_sent: 'پیشنهاد ارسال شده',
  verbal_agreement: 'توافق شفاهی', contract_sent: 'قرارداد ارسال شده', closed: 'بسته شده',
};

export default function OpportunitiesPage() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', estimated_value: 0, probability: 0, description: '' });

  useEffect(() => {
    crmApi.getOpportunities().then(r => setOpps(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = opps.filter(o => !search || o.name.includes(search));

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      const res = await crmApi.createOpportunity(form);
      setOpps(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', estimated_value: 0, probability: 0, description: '' });
    } catch {}
  };

  const handleCloseWon = async (id: number) => {
    try {
      const res = await crmApi.closeWon(id);
      setOpps(prev => prev.map(o => o.id === id ? res.data.data : o));
    } catch {}
  };

  const handleCloseLost = async (id: number) => {
    const reason = window.confirm('دلیل از دست رفتن؟');
    try {
      const res = await crmApi.closeLost(id, reason ? 'User confirmed' : '');
      setOpps(prev => prev.map(o => o.id === id ? res.data.data : o));
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-green-500" /> فرصت‌ها
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filtered.length} فرصت</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
          <Plus className="h-4 w-4" /> فرصت جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نام *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ارزش تخمینی</label>
              <input type="number" value={form.estimated_value} onChange={e => setForm({ ...form, estimated_value: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">احتمال %</label>
              <input type="number" value={form.probability} onChange={e => setForm({ ...form, probability: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">انصراف</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm">ایجاد</button>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
          className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400"><TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ فرصتی یافت نشد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="text-right px-4 py-3 font-medium text-gray-500">نام</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">مشتری</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">مرحله</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">ارزش</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">احتمال</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(opp => (
                  <tr key={opp.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 font-medium">{opp.name}</td>
                    <td className="px-4 py-3 text-gray-500">{opp.customer_name || '—'}</td>
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
                          <button onClick={() => handleCloseWon(opp.id)} className="text-green-500 hover:text-green-700 text-xs">برد</button>
                          <button onClick={() => handleCloseLost(opp.id)} className="text-red-500 hover:text-red-700 text-xs">باخت</button>
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
