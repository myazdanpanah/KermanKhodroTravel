/**
 * Leave Management Page
 */
import { useState, useEffect } from 'react';
import { Plus, Search, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { hrApi, LeaveRequest, LeaveType } from '../../api/hr';
import { useToast } from '../../components/Toast';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'در انتظار', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'تأیید شده', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'رد شده', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'لغو شده', color: 'bg-gray-100 text-gray-700' },
};

export default function LeavePage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employee_id: 0, leave_type_id: 0, start_date: '', end_date: '', reason: '' });

  useEffect(() => {
    Promise.all([hrApi.getLeaveRequests(), hrApi.getLeaveTypes()])
      .then(([r1, r2]) => { setRequests(r1.data.data); setLeaveTypes(r2.data.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = requests.filter(r => !search || r.employee_name.includes(search));

  const handleCreate = async () => {
    if (!form.employee_id || !form.leave_type_id || !form.start_date || !form.end_date) return;
    try {
      const res = await hrApi.createLeaveRequest(form);
      setRequests(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ employee_id: 0, leave_type_id: 0, start_date: '', end_date: '', reason: '' });
    } catch {}
  };

  const handleApprove = async (id: number) => {
    try {
      await hrApi.approveLeave(id);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
    } catch {}
  };

  const handleReject = async (id: number) => {
    try {
      await hrApi.rejectLeave(id, 'Rejected by manager');
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Calendar className="h-6 w-6 text-purple-500" /> مرخصی‌ها
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filtered.length} درخواست</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
          <Plus className="h-4 w-4" /> درخواست جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs text-gray-500 mb-1">شناسه کارمند *</label><input type="number" value={form.employee_id || ''} onChange={e => setForm({ ...form, employee_id: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">نوع مرخصی *</label><select value={form.leave_type_id} onChange={e => setForm({ ...form, leave_type_id: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"><option value={0}>انتخاب...</option>{leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">تاریخ شروع *</label><input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">تاریخ پایان *</label><input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">دلیل</label><input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">انصراف</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm">ایجاد</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
            className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ درخواستی یافت نشد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="text-right px-4 py-3 font-medium text-gray-500">کارمند</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">نوع مرخصی</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">از</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">تا</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">روز</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lr => (
                  <tr key={lr.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 font-medium">{lr.employee_name}</td>
                    <td className="px-4 py-3 text-xs">{lr.leave_type_name}</td>
                    <td className="px-4 py-3 text-xs">{lr.start_date}</td>
                    <td className="px-4 py-3 text-xs">{lr.end_date}</td>
                    <td className="px-4 py-3 text-xs">{lr.days}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${(STATUS_MAP[lr.status] || STATUS_MAP.pending).color}`}>
                        {(STATUS_MAP[lr.status] || STATUS_MAP.pending).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      {lr.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(lr.id)} className="text-green-500 hover:text-green-700 text-xs flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />تأیید</button>
                          <button onClick={() => handleReject(lr.id)} className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />رد</button>
                        </>
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
