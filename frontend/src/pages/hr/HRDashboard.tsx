/**
 * HR Dashboard
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building2, Calendar, DollarSign, TrendingUp, GraduationCap, Briefcase } from 'lucide-react';
import { hrApi, HRSummary } from '../../api/hr';

export default function HRDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<HRSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hrApi.getSummary().then(r => setSummary(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white dark:text-white flex items-center gap-3">
          <Users className="h-7 w-7 text-nx-blue" />
          مدیریت منابع انسانی
        </h1>
        <p className="text-sm text-nx-mist dark:text-nx-mist mt-1">کارکنان، حضور و غیاب، مرخصی، حقوق و استخدام</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { key: 'active', label: 'کارکنان فعال', icon: Users, color: 'text-nx-blue bg-nx-blue/10 dark:bg-nx-blue' },
          { key: 'departments', label: 'بخش‌ها', icon: Building2, color: 'text-nx-teal bg-nx-teal/10 dark:bg-nx-teal' },
          { key: 'on_leave', label: 'در مرخصی', icon: Calendar, color: 'text-nx-warning-500 bg-nx-warning-50 dark:bg-nx-warning-950' },
          { key: 'terminated', label: 'منتشر شده', icon: Users, color: 'text-nx-danger-500 bg-nx-danger-50 dark:bg-nx-danger-950' },
          { key: 'total', label: 'کل کارکنان', icon: Users, color: 'text-nx-mist bg-white dark:bg-nx-navy' },
        ].map(({ key, label, icon: Icon, color }) => (
          <button key={key} onClick={() => navigate('/erp/hr/employees')}
            className={`${color} rounded-xl p-4 border border-nx-border dark:border-nx-navy-border hover:shadow-md transition-all text-center`}>
            <Icon className={`h-6 w-6 mx-auto ${color.split(' ')[0]}`} />
            <p className="text-2xl font-bold text-nx-navy dark:text-white mt-2">{(summary as any)?.[key] ?? 0}</p>
            <p className="text-xs text-nx-mist dark:text-nx-mist mt-1">{label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'کارکنان', path: '/erp/hr/employees', icon: Users, color: 'text-nx-blue bg-nx-blue/10' },
          { label: 'حضور و غیاب', path: '/erp/hr/attendance', icon: Calendar, color: 'text-nx-teal bg-nx-teal/10' },
          { label: 'مرخصی', path: '/erp/hr/leave', icon: Calendar, color: 'text-nx-blue bg-nx-blue/10' },
          { label: 'حقوق', path: '/erp/hr/payroll', icon: DollarSign, color: 'text-nx-blue bg-nx-blue/10' },
          { label: 'ارزیابی', path: '/erp/hr/evaluations', icon: TrendingUp, color: 'text-nx-teal bg-nx-teal/10' },
          { label: 'استخدام', path: '/erp/hr/recruitment', icon: Briefcase, color: 'text-nx-blue bg-nx-blue/10' },
          { label: 'بخش‌ها', path: '/erp/hr/departments', icon: Building2, color: 'text-nx-blue bg-nx-blue/10' },
          { label: 'انواع مرخصی', path: '/erp/hr/leave-types', icon: GraduationCap, color: 'text-nx-warning-500 bg-nx-warning-50' },
        ].map(({ label, path, icon: Icon, color }) => (
          <button key={path} onClick={() => navigate(path)}
            className="bg-white dark:bg-nx-navy rounded-xl p-4 border border-nx-border dark:border-nx-navy-border hover:shadow-md transition-all text-right">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.split(' ')[1]}`}>
              <Icon className={`h-5 w-5 ${color.split(' ')[0]}`} />
            </div>
            <h3 className="text-sm font-semibold text-nx-navy dark:text-white mt-3">{label}</h3>
          </button>
        ))}
      </div>
    </div>
  );
}
