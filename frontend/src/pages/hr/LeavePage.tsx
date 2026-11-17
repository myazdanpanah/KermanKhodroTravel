/**
 * Leave Management Page
 */
import { useState, useEffect } from 'react';
import { Plus, Search, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { hrApi, LeaveRequest, LeaveType } from '../../api/hr';
import { useToast } from '../../components/Toast';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'در انتظار', color: 'bg-nx-warning-100 text-nx-warning-700' },
  approved: { label: 'تأیید شده', color: 'bg-nx-teal/10 text-nx-teal' },
  rejected: { label: 'رد شده', color: 'bg-nx-danger-100 text-nx-danger-700' },
  cancelled: { label: 'لغو شده', color: 'bg-nx-mist/10 text-nx-navy' },
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
      .catch(() => toast('خطا در دریافت مرخصی‌ها', 'error')).finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = requests.filter(r => !search || r.employee_name.includes(search));

  const handleCreate = async () => {
    if (!form.employee_id || !form.leave_type_id || !form.start_date || !form.end_date) return;
    try {
      const res = await hrApi.createLeaveRequest(form);
      setRequests(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ employee_id: 0, leave_type_id: 0, start_date: '', end_date: '', reason: '' });
      toast('درخواست مرخصی ایجاد شد', 'success');
    } catch { toast('خطا در ایجاد درخواست', 'error'); }
  };

  const handleApprove = async (id: number) => {
    try {
      await hrApi.approveLeave(id);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
      toast('مرخصی تأیید شد', 'success');
    } catch { toast('خطا در تأیید مرخصی', 'error'); }
  };

  const handleReject = async (id: number) => {
    try {
      await hrApi.rejectLeave(id, 'Rejected by manager');
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
      toast('مرخصی رد شد', 'success');
    } catch { toast('خطا در رد مرخصی', 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <Calendar className="h-6 w-6 text-nx-blue" /> مرخصی‌ها
          </h1>
          <p className="text-sm text-nx-mist dark:text-nx-mist mt-1">{filtered.length} درخواست</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-nx-blue text-white rounded-lg hover:bg-nx-blue">
          <Plus className="h-4 w-4" /> درخواست جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs text-nx-mist mb-1">شناسه کارمند *</label><input type="number" value={form.employee_id || ''} onChange={e => setForm({ ...form, employee_id: Number(e.target.value) })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">نوع مرخصی *</label><select value={form.leave_type_id} onChange={e => setForm({ ...form, leave_type_id: Number(e.target.value) })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm"><option value={0}>انتخاب...</option>{leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}</select></div>
            <div><label className="block text-xs text-nx-mist mb-1">تاریخ شروع *</label><input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">تاریخ پایان *</label><input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-nx-mist mb-1">دلیل</label><input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="w-full px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" /></div>
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
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm">
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-nx-mist"><Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ درخواستی یافت نشد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">کارمند</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">نوع مرخصی</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">از</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">تا</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">روز</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lr => (
                  <tr key={lr.id} className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy">
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
                          <button onClick={() => handleApprove(lr.id)} className="text-nx-teal hover:text-nx-teal text-xs flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />تأیید</button>
                          <button onClick={() => handleReject(lr.id)} className="text-nx-danger-500 hover:text-nx-danger-700 text-xs flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />رد</button>
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
