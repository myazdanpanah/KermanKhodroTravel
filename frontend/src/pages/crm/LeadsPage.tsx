/**
 * Leads Page
 */

import { useState, useEffect } from 'react';
import { Plus, Search, Users, ChevronDown, ArrowLeftRight } from 'lucide-react';
import { crmApi, Lead } from '../../api/crm';
import { useToast } from '../../components/Toast';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: 'جدید', color: 'bg-nx-blue/10 text-nx-blue' },
  contacted: { label: 'تماس گرفته شده', color: 'bg-nx-blue/10 text-nx-blue' },
  qualified: { label: 'تایید شده', color: 'bg-nx-teal/10 text-nx-teal' },
  unqualified: { label: 'تایید نشده', color: 'bg-nx-mist/10 text-nx-navy' },
  converted: { label: 'تبدیل شده', color: 'bg-nx-blue/10 text-nx-blue' },
  lost: { label: 'از دست رفته', color: 'bg-nx-danger-100 text-nx-danger-700' },
};

const SOURCE_MAP: Record<string, string> = {
  website: 'وبسایت', referral: 'ارجاع', campaign: 'کمپین',
  social_media: 'شبکه اجتماعی', phone: 'تلفن', email: 'ایمیل', event: 'رویداد', other: 'سایر',
};

export default function LeadsPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', company_name: '', email: '', phone: '', source: 'other', priority: 'medium', notes: '' });

  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    crmApi.getLeads(params).then(r => setLeads(r.data.data)).catch(() => toast('خطا در دریافت سرنخ‌ها', 'error')).finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = leads.filter(l => !search || l.name.includes(search) || l.company_name.includes(search));

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      const res = await crmApi.createLead(form);
      setLeads(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', company_name: '', email: '', phone: '', source: 'other', priority: 'medium', notes: '' });
      toast('سرنخ با موفقیت ایجاد شد', 'success');
    } catch { toast('خطا در ایجاد سرنخ', 'error'); }
  };

  const handleConvert = async (id: number) => {
    if (!window.confirm('آیا می‌خواهید این سرنخ را به مشتری تبدیل کنید؟')) return;
    try {
      await crmApi.convertLead(id);
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: 'converted' } : l));
      toast('سرنخ با موفقیت تبدیل شد', 'success');
    } catch { toast('خطا در تبدیل سرنخ', 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <Users className="h-6 w-6 text-nx-blue" /> سرنخ‌ها
          </h1>
          <p className="text-sm text-slate-300 mt-1">{filtered.length} سرنخ</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue transition-colors">
          <Plus className="h-4 w-4" /> سرنخ جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-6">
          <h3 className="text-lg font-semibold text-nx-navy dark:text-white mb-4">سرنخ جدید</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">نام *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">شرکت</label>
              <input type="text" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">ایمیل</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">تلفن</label>
              <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">منبع</label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm">
                {Object.entries(SOURCE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-nx-navy dark:text-nx-mist mb-1">اولویت</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm">
                <option value="low">کم</option><option value="medium">متوسط</option><option value="high">زیاد</option>
              </select></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-nx-mist">انصراف</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue text-sm">ایجاد</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nx-mist" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
            className="w-full pr-10 pl-4 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pr-8 pl-4 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm">
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-nx-mist pointer-events-none" />
        </div>
      </div>

      <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-600 dark:text-slate-200"><Users className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ سرنخی یافت نشد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">نام</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">شرکت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">ایمیل</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">منبع</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => (
                  <tr key={lead.id} className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy">
                    <td className="px-4 py-3 font-medium">{lead.name}</td>
                    <td className="px-4 py-3 text-nx-mist">{lead.company_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-nx-mist">{lead.email || '—'}</td>
                    <td className="px-4 py-3 text-xs">{SOURCE_MAP[lead.source] || lead.source}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${(STATUS_MAP[lead.status] || STATUS_MAP.new).color}`}>
                        {(STATUS_MAP[lead.status] || STATUS_MAP.new).label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.status !== 'converted' && (
                        <button onClick={() => handleConvert(lead.id)}
                          className="flex items-center gap-1 text-xs text-nx-teal hover:text-nx-teal">
                          <ArrowLeftRight className="h-3.5 w-3.5" /> تبدیل
                        </button>
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
