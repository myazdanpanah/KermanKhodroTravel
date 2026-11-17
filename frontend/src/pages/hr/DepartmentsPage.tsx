/**
 * Departments Page
 */
import { useState, useEffect } from 'react';
import { Plus, Search, Building2, Trash2 } from 'lucide-react';
import { hrApi, Department } from '../../api/hr';
import { useToast } from '../../components/Toast';

export default function DepartmentsPage() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '' });

  useEffect(() => {
    hrApi.getDepartments().then(r => setDepartments(r.data.data)).catch(() => toast("خطا", "error")).finally(() => setLoading(false));
  }, []);

  const filtered = departments.filter(d => !search || d.name.includes(search) || d.code.includes(search));

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      const res = await hrApi.createDepartment(form);
      setDepartments(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', code: '', description: '' });
    } catch { toast("خطا", "error"); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا از حذف این بخش اطمینان دارید؟')) return;
    try {
      await hrApi.deleteDepartment(id);
      setDepartments(prev => prev.filter(d => d.id !== id));
    } catch { toast("خطا", "error"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <Building2 className="h-6 w-6 text-nx-teal" /> بخش‌ها
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-200 mt-1">{filtered.length} بخش</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue">
          <Plus className="h-4 w-4" /> بخش جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs text-nx-mist mb-1">نام *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">کد</label><input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">توضیحات</label><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
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
          <div className="text-center py-12 text-nx-mist"><Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ بخشی یافت نشد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">نام</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">کد</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">توضیحات</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(dept => (
                  <tr key={dept.id} className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy">
                    <td className="px-4 py-3 font-medium">{dept.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{dept.code || '—'}</td>
                    <td className="px-4 py-3 text-nx-mist">{dept.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${dept.is_active ? 'bg-nx-teal/10 text-nx-teal' : 'bg-nx-danger-100 text-nx-danger-700'}`}>
                        {dept.is_active ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(dept.id); }} className="p-1.5 text-nx-mist hover:text-nx-danger-500"><Trash2 className="h-4 w-4" /></button>
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
