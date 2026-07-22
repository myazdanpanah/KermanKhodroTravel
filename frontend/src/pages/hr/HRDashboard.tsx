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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Users className="h-7 w-7 text-orange-500" />
          مدیریت منابع انسانی
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">کارکنان، حضور و غیاب، مرخصی، حقوق و استخدام</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { key: 'active', label: 'کارکنان فعال', icon: Users, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950' },
          { key: 'departments', label: 'بخش‌ها', icon: Building2, color: 'text-green-500 bg-green-50 dark:bg-green-950' },
          { key: 'on_leave', label: 'در مرخصی', icon: Calendar, color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-950' },
          { key: 'terminated', label: 'منتشر شده', icon: Users, color: 'text-red-500 bg-red-50 dark:bg-red-950' },
          { key: 'total', label: 'کل کارکنان', icon: Users, color: 'text-gray-500 bg-gray-50 dark:bg-gray-950' },
        ].map(({ key, label, icon: Icon, color }) => (
          <button key={key} onClick={() => navigate('/erp/hr/employees')}
            className={`${color} rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all text-center`}>
            <Icon className={`h-6 w-6 mx-auto ${color.split(' ')[0]}`} />
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{(summary as any)?.[key] ?? 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'کارکنان', path: '/erp/hr/employees', icon: Users, color: 'text-blue-500 bg-blue-50' },
          { label: 'حضور و غیاب', path: '/erp/hr/attendance', icon: Calendar, color: 'text-green-500 bg-green-50' },
          { label: 'مرخصی', path: '/erp/hr/leave', icon: Calendar, color: 'text-purple-500 bg-purple-50' },
          { label: 'حقوق', path: '/erp/hr/payroll', icon: DollarSign, color: 'text-orange-500 bg-orange-50' },
          { label: 'ارزیابی', path: '/erp/hr/evaluations', icon: TrendingUp, color: 'text-teal-500 bg-teal-50' },
          { label: 'استخدام', path: '/erp/hr/recruitment', icon: Briefcase, color: 'text-indigo-500 bg-indigo-50' },
          { label: 'بخش‌ها', path: '/erp/hr/departments', icon: Building2, color: 'text-pink-500 bg-pink-50' },
          { label: 'انواع مرخصی', path: '/erp/hr/leave-types', icon: GraduationCap, color: 'text-amber-500 bg-amber-50' },
        ].map(({ label, path, icon: Icon, color }) => (
          <button key={path} onClick={() => navigate(path)}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all text-right">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.split(' ')[1]}`}>
              <Icon className={`h-5 w-5 ${color.split(' ')[0]}`} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-3">{label}</h3>
          </button>
        ))}
      </div>
    </div>
  );
}
