/**
 * Campaigns Page
 */

import { useState, useEffect } from 'react';
import { Plus, Search, Target } from 'lucide-react';
import { crmApi, Campaign } from '../../api/crm';

const TYPE_MAP: Record<string, string> = {
  email: 'ایمیل', social_media: 'شبکه اجتماعی', content: 'محتوا',
  event: 'رویداد', advertising: 'تبلیغات', referral: 'ارجاع', other: 'سایر',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'پیش‌نویس', color: 'bg-gray-100 text-gray-700' },
  planned: { label: 'برنامه‌ریزی شده', color: 'bg-blue-100 text-blue-700' },
  active: { label: 'فعال', color: 'bg-green-100 text-green-700' },
  paused: { label: 'متوقف', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'تکمیل شده', color: 'bg-teal-100 text-teal-700' },
  cancelled: { label: 'لغو شده', color: 'bg-red-100 text-red-700' },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', campaign_type: 'email', budget: 0, description: '' });

  useEffect(() => {
    crmApi.getCampaigns().then(r => setCampaigns(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = campaigns.filter(c => !search || c.name.includes(search));

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      const res = await crmApi.createCampaign(form);
      setCampaigns(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', campaign_type: 'email', budget: 0, description: '' });
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Target className="h-6 w-6 text-orange-500" /> کمپین‌ها
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filtered.length} کمپین</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
          <Plus className="h-4 w-4" /> کمپین جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نام *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع</label>
              <select value={form.campaign_type} onChange={e => setForm({ ...form, campaign_type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm">
                {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">بودجه</label>
              <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
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
          <div className="text-center py-12 text-gray-500"><Target className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ کمپینی یافت نشد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="text-right px-4 py-3 font-medium text-gray-500">نام</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">نوع</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">بودجه</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">سرنخ‌ها</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">ROI</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-xs">{TYPE_MAP[c.campaign_type] || c.campaign_type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${(STATUS_MAP[c.status] || STATUS_MAP.draft).color}`}>
                        {(STATUS_MAP[c.status] || STATUS_MAP.draft).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{c.budget.toLocaleString('fa-IR')}</td>
                    <td className="px-4 py-3 text-xs">{c.actual_leads}/{c.expected_leads}</td>
                    <td className="px-4 py-3 text-xs">{c.roi.toFixed(1)}%</td>
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
