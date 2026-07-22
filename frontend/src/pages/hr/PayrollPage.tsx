/**
 * Payroll Page
 */
import { useState, useEffect } from 'react';
import { Plus, Search, DollarSign, Play } from 'lucide-react';
import { hrApi, PayrollPeriod, PayrollRecord } from '../../api/hr';
import { useToast } from '../../components/Toast';

export default function PayrollPage() {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([hrApi.getPayrollPeriods(), hrApi.getPayrollRecords()])
      .then(([r1, r2]) => { setPeriods(r1.data.data); setRecords(r2.data.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filteredRecords = records.filter(r => {
    const matchesSearch = !search || r.employee_name.includes(search);
    const matchesPeriod = !selectedPeriod || r.period === selectedPeriod;
    return matchesSearch && matchesPeriod;
  });

  const handleCreate = async () => {
    if (!form.name || !form.start_date || !form.end_date) return;
    try {
      const res = await hrApi.createPayrollPeriod(form);
      setPeriods(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', start_date: '', end_date: '' });
    } catch {}
  };

  const handleGenerate = async (periodId: number) => {
    if (!window.confirm('آیا از تولید لیست حقوق اطمینان دارید؟')) return;
    try {
      await hrApi.generatePayroll(periodId);
      const res = await hrApi.getPayrollRecords({ period: String(periodId) });
      setRecords(prev => [...prev, ...res.data.data.filter(r => !prev.some(p => p.id === r.id))]);
    } catch {}
  };

  const filteredPeriods = periods.filter(p => !search || p.name.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-orange-500" /> حقوق و دستمزد
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{periods.length} دوره پرداخت</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
          <Plus className="h-4 w-4" /> دوره جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs text-gray-500 mb-1">نام *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">تاریخ شروع *</label><input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">تاریخ پایان *</label><input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
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

      {/* Periods */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">دوره‌های پرداخت</h3>
        {loading ? (
          <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {filteredPeriods.map(p => (
              <div key={p.id} onClick={() => setSelectedPeriod(p.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedPeriod === p.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-950' : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'}`}>
                <p className="font-medium text-gray-900 dark:text-white text-sm">{p.name}</p>
                <p className="text-xs text-gray-500 mt-1">{p.start_date} — {p.end_date}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'closed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span>
                  {p.status === 'open' && (
                    <button onClick={(e) => { e.stopPropagation(); handleGenerate(p.id); }}
                      className="text-xs text-orange-500 hover:text-orange-700 flex items-center gap-1"><Play className="h-3 w-3" />تولید</button>
                  )}
                </div>
              </div>
            ))}
            {filteredPeriods.length === 0 && <p className="text-sm text-gray-500 col-span-3 text-center py-4">هیچ دوره‌ای یافت نشد</p>}
          </div>
        )}
      </div>

      {/* Records */}
      {selectedPeriod && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">رکوردهای حقوقی</h3>
          </div>
          {filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">هیچ رکوردی یافت نشد</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <th className="text-right px-4 py-3 font-medium text-gray-500">کارمند</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">حقوق پایه</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">جمع دریافتی</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">جمع کسورات</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">خالص پرداختی</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map(rec => (
                    <tr key={rec.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3 font-medium">{rec.employee_name}</td>
                      <td className="px-4 py-3 text-xs">{rec.base_salary.toLocaleString('fa-IR')}</td>
                      <td className="px-4 py-3 text-xs text-green-600">{rec.total_earnings.toLocaleString('fa-IR')}</td>
                      <td className="px-4 py-3 text-xs text-red-600">{rec.total_deductions.toLocaleString('fa-IR')}</td>
                      <td className="px-4 py-3 text-xs font-semibold">{rec.net_pay.toLocaleString('fa-IR')}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${rec.status === 'paid' ? 'bg-green-100 text-green-700' : rec.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
