/**
 * Leave Types Page
 */
import { useState, useEffect } from 'react';
import { Plus, Search, Tag } from 'lucide-react';
import { hrApi, LeaveType } from '../../api/hr';
import { useToast } from '../../components/Toast';

export default function LeaveTypesPage() {
  const { toast } = useToast();
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', default_days: 0, is_paid: true });

  useEffect(() => {
    hrApi.getLeaveTypes()
      .then(r => setTypes(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = types.filter(t => !search || t.name.includes(search) || t.code.includes(search));

  const handleCreate = async () => {
    if (!form.name || !form.code) return;
    try {
      const res = await hrApi.createLeaveType(form);
      setTypes(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', code: '', default_days: 0, is_paid: true });
    } catch { toast("خطا", "error"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Tag className="h-6 w-6 text-purple-500" /> انواع مرخصی
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{types.length} نوع مرخصی</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600">
          <Plus className="h-4 w-4" /> نوع جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">نام *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">کد *</label>
              <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">روزهای پیش‌فرض</label>
              <input type="number" value={form.default_days} onChange={e => setForm({ ...form, default_days: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 px-3 py-2">
                <input type="checkbox" checked={form.is_paid} onChange={e => setForm({ ...form, is_paid: e.target.checked })}
                  className="rounded border-gray-300 text-purple-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">مرخصی استحقاقی</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">انصراف</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm">ایجاد</button>
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
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">هیچ نوع مرخصی یافت نشد</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filtered.map(t => (
              <div key={t.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{t.name}</p>
                    <p className="text-xs text-gray-500 mt-1">کد: {t.code}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.is_paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {t.is_paid ? 'استحقاقی' : 'بدون حقوق'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t.default_days} روز در سال</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
