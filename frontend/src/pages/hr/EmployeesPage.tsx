/**
 * Employees Page
 */
import { useState, useEffect } from 'react';
import { Plus, Search, Users, ChevronDown, Trash2 } from 'lucide-react';
import { hrApi, Employee } from '../../api/hr';
import { useToast } from '../../components/Toast';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: 'فعال', color: 'bg-nx-teal/10 text-nx-teal' },
  on_leave: { label: 'در مرخصی', color: 'bg-nx-warning-100 text-nx-warning-700' },
  terminated: { label: 'منتشر شده', color: 'bg-nx-danger-100 text-nx-danger-700' },
  retired: { label: 'بازنشسته', color: 'bg-nx-mist/10 text-nx-navy' },
};

export default function EmployeesPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', employee_id: '', position: '', phone: '', email: '', base_salary: 0, hire_date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    hrApi.getEmployees(params).then(r => setEmployees(r.data.data)).catch(() => toast('خطا در دریافت کارکنان', 'error')).finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = employees.filter(e => !search || e.first_name.includes(search) || e.last_name.includes(search) || e.employee_id.includes(search));

  const handleCreate = async () => {
    if (!form.first_name || !form.last_name || !form.employee_id) return;
    try {
      const res = await hrApi.createEmployee(form);
      setEmployees(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ first_name: '', last_name: '', employee_id: '', position: '', phone: '', email: '', base_salary: 0, hire_date: new Date().toISOString().split('T')[0] });
      toast('کارمند با موفقیت ایجاد شد', 'success');
    } catch { toast('خطا در ایجاد کارمند', 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا از حذف این کارمند اطمینان دارید؟')) return;
    try {
      await hrApi.deleteEmployee(id);
      setEmployees(prev => prev.filter(e => e.id !== id));
      toast('کارمند حذف شد', 'success');
    } catch { toast('خطا در حذف کارمند', 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <Users className="h-6 w-6 text-nx-blue" /> کارکنان
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-200 mt-1">{filtered.length} کارمند</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue">
          <Plus className="h-4 w-4" /> کارمند جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><label className="block text-xs text-nx-mist mb-1">نام *</label><input type="text" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">نام خانوادگی *</label><input type="text" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">شماره کارمندی *</label><input type="text" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">سمت</label><input type="text" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">تلفن</label><input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">ایمیل</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">حقوق پایه</label><input type="number" value={form.base_salary} onChange={e => setForm({ ...form, base_salary: Number(e.target.value) })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">تاریخ استخدام</label><input type="date" value={form.hire_date} onChange={e => setForm({ ...form, hire_date: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
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
          <div className="text-center py-12 text-nx-mist"><Users className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ کارمندی یافت نشد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">کد</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">نام</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">سمت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">تاریخ استخدام</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id} className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy">
                    <td className="px-4 py-3 font-mono text-xs">{emp.employee_id}</td>
                    <td className="px-4 py-3 font-medium">{emp.full_name}</td>
                    <td className="px-4 py-3 text-nx-mist">{emp.position || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${(STATUS_MAP[emp.status] || STATUS_MAP.active).color}`}>
                        {(STATUS_MAP[emp.status] || STATUS_MAP.active).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{emp.hire_date}</td>
                    <td className="px-4 py-3">
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }} className="p-1.5 text-nx-mist hover:text-nx-danger-500"><Trash2 className="h-4 w-4" /></button>
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
