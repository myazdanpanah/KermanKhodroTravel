/**
 * KPIs Page — View and manage Key Performance Indicators
 */
import { useState, useEffect } from 'react';
import { Plus, Search, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { reportingApi, KPI, KPISummary } from '../../api/reporting';

const MODULE_LABELS: Record<string, string> = {
  finance: 'مالی', inventory: 'انبار', purchasing: 'خرید', sales: 'فروش',
  manufacturing: 'تولید', trading: 'بازرگانی', crm: 'CRM', hr: 'منابع انسانی', cross_module: 'بین‌ماژولی',
};

const TREND_ICONS: Record<string, React.ElementType> = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

const STATUS_COLORS: Record<string, string> = {
  good: 'text-green-500 bg-green-50',
  warning: 'text-yellow-500 bg-yellow-50',
  critical: 'text-red-500 bg-red-50',
  neutral: 'text-gray-500 bg-gray-50',
};

export default function KPIsPage() {
  const [kpis, setKPIs] = useState<KPI[]>([]);
  const [summary, setSummary] = useState<KPISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', module: 'finance', formula: '', target_value: 0, unit: '' });

  useEffect(() => {
    Promise.all([reportingApi.getKPIs(), reportingApi.getKPISummary()])
      .then(([r1, r2]) => { setKPIs(r1.data.data); setSummary(r2.data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = kpis.filter(k => {
    const matchSearch = !search || k.name.includes(search) || k.code.includes(search);
    const matchModule = !filterModule || k.module === filterModule;
    return matchSearch && matchModule;
  });

  const handleCreate = async () => {
    if (!form.name || !form.code) return;
    try {
      const res = await reportingApi.createKPI(form);
      setKPIs(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', code: '', module: 'finance', formula: '', target_value: 0, unit: '' });
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Target className="h-6 w-6 text-amber-500" /> شاخص‌های کلیدی
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{kpis.length} شاخص فعال</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
          <Plus className="h-4 w-4" /> شاخص جدید
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'کل شاخص‌ها', value: summary.total_kpis, color: 'text-blue-500 bg-blue-50' },
            { label: 'در هدف', value: summary.on_target, color: 'text-green-500 bg-green-50' },
            { label: 'زیر هدف', value: summary.below_target, color: 'text-red-500 bg-red-50' },
            { label: 'رو به بهبود', value: summary.improving, color: 'text-teal-500 bg-teal-50' },
            { label: 'رو به افول', value: summary.declining, color: 'text-orange-500 bg-orange-50' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl p-4 border border-gray-200 dark:border-gray-700 ${color.split(' ')[1]}`}>
              <p className={`text-2xl font-bold ${color.split(' ')[0]}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs text-gray-500 mb-1">نام *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">کد *</label><input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">ماژول</label>
              <select value={form.module} onChange={e => setForm({ ...form, module: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm">
                {Object.entries(MODULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">فرمول</label><input type="text" value={form.formula} onChange={e => setForm({ ...form, formula: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">هدف</label><input type="number" value={form.target_value} onChange={e => setForm({ ...form, target_value: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">واحد</label><input type="text" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">انصراف</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm">ایجاد</button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
            className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
        </div>
        <select value={filterModule} onChange={e => setFilterModule(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
          <option value="">همه ماژول‌ها</option>
          {Object.entries(MODULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="col-span-3 text-center py-8 text-gray-500 text-sm">هیچ شاخصی یافت نشد</div>
        ) : (
          filtered.map(k => {
            const TrendIcon = TREND_ICONS[k.trend] || Minus;
            const progress = k.target_value > 0 ? Math.min((Number(k.current_value) / Number(k.target_value)) * 100, 100) : 0;
            return (
              <div key={k.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">{k.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{MODULE_LABELS[k.module] || k.module}</p>
                  </div>
                  <div className={`p-1.5 rounded-lg ${STATUS_COLORS[k.status]}`}>
                    <TrendIcon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mb-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{Number(k.current_value).toLocaleString('fa-IR')}</span>
                    {k.unit && <span className="text-xs text-gray-400">{k.unit}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">هدف: {Number(k.target_value).toLocaleString('fa-IR')}</p>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${k.status === 'good' ? 'bg-green-500' : k.status === 'warning' ? 'bg-yellow-500' : k.status === 'critical' ? 'bg-red-500' : 'bg-gray-400'}`} style={{ width: `${progress}%` }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">{progress.toFixed(0)}%</span>
                  <span className={`text-xs ${k.trend === 'up' ? 'text-green-500' : k.trend === 'down' ? 'text-red-500' : 'text-gray-400'}`}>
                    {k.variance > 0 ? '+' : ''}{k.variance.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
