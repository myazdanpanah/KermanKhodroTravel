import { useToast } from "../../components/Toast";
/**
 * Technicians List Page
 * Per UI_UX_GUIDELINES.md §7: Table design.
 */

import { useState, useEffect } from 'react';
import { Plus, Search, Users, Trash2, Star } from 'lucide-react';
import { serviceManagementApi, Technician } from '../../api/serviceManagement';

export default function TechniciansPage() {
  const { toast } = useToast();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', employee_id: '', department: '', phone: '', skills: '', hourly_rate: 0 });

  useEffect(() => {
    serviceManagementApi.getTechnicians()
      .then(res => setTechnicians(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = technicians.filter(t =>
    !search || t.name.includes(search) || t.employee_id.includes(search) ||
    t.skills.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      const res = await serviceManagementApi.createTechnician(form);
      setTechnicians(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', employee_id: '', department: '', phone: '', skills: '', hourly_rate: 0 });
    } catch { toast("خطا", "error"); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا از حذف این تکنسین اطمینان دارید؟')) return;
    try {
      await serviceManagementApi.deleteTechnician(id);
      setTechnicians(prev => prev.filter(t => t.id !== id));
    } catch { toast("خطا", "error"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Users className="h-6 w-6 text-purple-500" />
            تکنسین‌ها
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filtered.length} تکنسین
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          تکنسین جدید
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">تکنسین جدید</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نام *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">شماره کارمندی</label>
              <input
                type="text"
                value={form.employee_id}
                onChange={e => setForm({ ...form, employee_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">بخش</label>
              <input
                type="text"
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">تلفن</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">مهارت‌ها (با کاما)</label>
              <input
                type="text"
                value={form.skills}
                onChange={e => setForm({ ...form, skills: e.target.value })}
                placeholder="الکتریکی, مکانیک"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نرخ ساعتی (ریال)</label>
              <input
                type="number"
                value={form.hourly_rate}
                onChange={e => setForm({ ...form, hourly_rate: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800">
              انصراف
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
            >
              ایجاد
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="جستجو..."
          className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>هیچ تکنسینی یافت نشد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tech => (
            <div
              key={tech.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{tech.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tech.employee_id}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(tech.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {tech.department && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">بخش: {tech.department}</p>
                )}
                {tech.phone && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">تلفن: {tech.phone}</p>
                )}
                {tech.skills && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tech.skills.split(',').map(skill => (
                      <span key={skill} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500">
                    {tech.hourly_rate.toLocaleString('fa-IR')} ریال/ساعت
                  </span>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs text-gray-600 dark:text-gray-300">{tech.performance_score}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
