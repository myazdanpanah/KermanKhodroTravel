/**
 * Attendance Page
 */
import { useState, useEffect } from 'react';
import { Search, Calendar, Clock } from 'lucide-react';
import { hrApi, Attendance } from '../../api/hr';
import { useToast } from '../../components/Toast';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  present: { label: 'حاضر', color: 'bg-nx-teal/10 text-nx-teal' },
  absent: { label: 'غایب', color: 'bg-nx-danger-100 text-nx-danger-700' },
  late: { label: 'دیر رسیده', color: 'bg-nx-warning-100 text-nx-warning-700' },
  half_day: { label: 'نیم روز', color: 'bg-nx-blue/10 text-nx-blue' },
  holiday: { label: 'تعطیل', color: 'bg-nx-mist/10 text-nx-navy' },
};

export default function AttendancePage() {
  const { toast } = useToast();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  useEffect(() => {
    hrApi.getAttendance().then(r => setRecords(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = records.filter(r => !search || r.employee_name.includes(search));

  const handleCheckInOut = async (action: string) => {
    if (!employeeId) return;
    try {
      const res = await hrApi.checkInOut(Number(employeeId), action);
      setRecords(prev => [res.data.data, ...prev]);
      setEmployeeId('');
    } catch { toast('خطا در ثبت ورود/خروج', 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
            <Calendar className="h-6 w-6 text-nx-teal" /> حضور و غیاب
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-200 mt-1">{filtered.length} رکورد</p>
        </div>
      </div>

      <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-4">
        <div className="flex items-center gap-3">
          <input type="number" placeholder="شناسه کارمند" value={employeeId} onChange={e => setEmployeeId(e.target.value)}
            className="px-3 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm w-40" />
          <button onClick={() => handleCheckInOut('check_in')} className="flex items-center gap-2 px-4 py-2 bg-nx-teal text-white rounded-lg hover:bg-nx-teal text-sm">
            <Clock className="h-4 w-4" /> ورود
          </button>
          <button onClick={() => handleCheckInOut('check_out')} className="flex items-center gap-2 px-4 py-2 bg-nx-danger-500 text-white rounded-lg hover:bg-nx-danger-600 text-sm">
            <Clock className="h-4 w-4" /> خروج
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nx-mist" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
          className="w-full pr-10 pl-4 py-2 border border-nx-mist dark:border-nx-muted rounded-lg bg-white dark:bg-nx-navy text-nx-navy dark:text-white text-sm" />
      </div>

      <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-nx-mist"><Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>هیچ رکوردی یافت نشد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nx-border dark:border-nx-navy-border bg-white dark:bg-nx-navy">
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">کارمند</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">تاریخ</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">ورود</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">خروج</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">وضعیت</th>
                  <th className="text-right px-4 py-3 font-medium text-nx-mist">اضافه کاری</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rec => (
                  <tr key={rec.id} className="border-b border-nx-border dark:border-nx-navy-border hover:bg-white dark:hover:bg-nx-navy">
                    <td className="px-4 py-3 font-medium">{rec.employee_name}</td>
                    <td className="px-4 py-3 text-xs">{rec.date}</td>
                    <td className="px-4 py-3 text-xs">{rec.check_in ? new Date(rec.check_in).toLocaleTimeString('fa-IR') : '—'}</td>
                    <td className="px-4 py-3 text-xs">{rec.check_out ? new Date(rec.check_out).toLocaleTimeString('fa-IR') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${(STATUS_MAP[rec.status] || STATUS_MAP.present).color}`}>
                        {(STATUS_MAP[rec.status] || STATUS_MAP.present).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{rec.overtime_hours}h</td>
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
