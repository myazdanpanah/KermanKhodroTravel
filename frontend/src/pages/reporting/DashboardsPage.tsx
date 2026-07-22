/**
 * Dashboards Page — View and manage analytics dashboards
 */
import { useState, useEffect } from 'react';
import { Plus, Search, LayoutDashboard, Trash2, Settings } from 'lucide-react';
import { reportingApi, Dashboard } from '../../api/reporting';

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  useEffect(() => {
    reportingApi.getDashboards()
      .then(r => setDashboards(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = dashboards.filter(d => !search || d.name.includes(search));

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      const res = await reportingApi.createDashboard(form);
      setDashboards(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', description: '' });
    } catch {}
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا از حذف اطمینان دارید؟')) return;
    try {
      await reportingApi.deleteDashboard(id);
      setDashboards(prev => prev.filter(d => d.id !== id));
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6 text-cyan-500" /> داشبوردها
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{dashboards.length} داشبورد</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
          <Plus className="h-4 w-4" /> داشبورد جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs text-gray-500 mb-1">نام *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">توضیحات</label><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">انصراف</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 text-sm">ایجاد</button>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
          className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="col-span-3 text-center py-8 text-gray-500 text-sm">هیچ داشبوردی یافت نشد</div>
        ) : (
          filtered.map(d => (
            <div key={d.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{d.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{d.description || 'بدون توضیح'}</p>
                </div>
                {d.is_default && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">پیش‌فرض</span>}
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-gray-400">{d.widgets?.length || 0} ویجت</span>
                <div className="flex gap-2">
                  <button className="p-1.5 text-gray-400 hover:text-gray-600"><Settings className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(d.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
