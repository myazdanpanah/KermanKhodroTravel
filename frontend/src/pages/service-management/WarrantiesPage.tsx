import { useToast } from '../../components/Toast';
const { toast } = useToast();
/**
 * Warranties Page
 * Per UI_UX_GUIDELINES.md §7: Table design.
 */

import { useState, useEffect } from 'react';
import { Plus, Search, Shield, CheckCircle, XCircle } from 'lucide-react';
import { serviceManagementApi, Warranty } from '../../api/serviceManagement';

const TYPE_MAP: Record<string, string> = {
  manufacturer: 'گارانتی تولیدکننده',
  dealer: 'گارانتی فروشنده',
  extended: 'گارانتی تمدیدی',
  contract: 'گارانتی قراردادی',
};

export default function WarrantiesPage() {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_id: 0, product_name: '', product_code: '', serial_number: '',
    warranty_type: 'manufacturer', start_date: '', end_date: '',
  });

  useEffect(() => {
    serviceManagementApi.getWarranties()
      .then(res => setWarranties(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = warranties.filter(w =>
    !search || w.serial_number.includes(search) ||
    w.product_name.toLowerCase().includes(search.toLowerCase()) ||
    w.customer_name?.includes(search)
  );

  const handleCreate = async () => {
    if (!form.customer_id || !form.product_name || !form.start_date || !form.end_date) return;
    try {
      const res = await serviceManagementApi.createWarranty(form as any);
      setWarranties(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ customer_id: 0, product_name: '', product_code: '', serial_number: '', warranty_type: 'manufacturer', start_date: '', end_date: '' });
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Shield className="h-6 w-6 text-green-500" />
            گارانتی‌ها
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filtered.length} گارانتی</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
          <Plus className="h-4 w-4" /> ثبت گارانتی جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">گارانتی جدید</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">شناسه مشتری *</label>
              <input type="number" value={form.customer_id || ''} onChange={e => setForm({ ...form, customer_id: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نام محصول *</label>
              <input type="text" value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">شماره سریال</label>
              <input type="text" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نوع گارانتی</label>
              <select value={form.warranty_type} onChange={e => setForm({ ...form, warranty_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm">
                {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تاریخ شروع *</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تاریخ پایان *</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
            </div>
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
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>هیچ گارانتی یافت نشد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="text-right px-4 py-3 font-medium text-gray-500">محصول</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">مشتری</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">شماره سریال</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">نوع</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">شروع</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">پایان</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => (
                  <tr key={w.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3">{w.product_name}</td>
                    <td className="px-4 py-3">{w.customer_name || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{w.serial_number || '—'}</td>
                    <td className="px-4 py-3 text-xs">{TYPE_MAP[w.warranty_type] || w.warranty_type}</td>
                    <td className="px-4 py-3">
                      {w.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          <CheckCircle className="h-3 w-3" /> فعال
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                          <XCircle className="h-3 w-3" /> غیرفعال
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">{w.start_date}</td>
                    <td className="px-4 py-3 text-xs">{w.end_date}</td>
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
