/**
 * Service Management Dashboard
 * Per UI_UX_GUIDELINES.md §5: Dashboard design.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Headphones, Wrench, Shield, Users, FileText, Clock,
  AlertTriangle, CheckCircle, XCircle, ArrowLeft,
} from 'lucide-react';
import { serviceManagementApi, ServiceSummary } from '../../api/serviceManagement';

const STATUSES = [
  { key: 'new', label: 'جدید', icon: Clock, color: 'text-nx-blue', bg: 'bg-nx-blue/10 dark:bg-nx-blue' },
  { key: 'assigned', label: 'تخصیص یافته', icon: Users, color: 'text-nx-blue', bg: 'bg-nx-blue/10 dark:bg-nx-blue' },
  { key: 'in_progress', label: 'در حال انجام', icon: Wrench, color: 'text-nx-blue', bg: 'bg-nx-blue/10 dark:bg-nx-warning-950' },
  { key: 'waiting_parts', label: 'در انتظار قطعات', icon: AlertTriangle, color: 'text-nx-warning-500', bg: 'bg-nx-warning-50 dark:bg-nx-warning-950' },
  { key: 'completed', label: 'تکمیل شده', icon: CheckCircle, color: 'text-nx-teal', bg: 'bg-nx-teal/10 dark:bg-nx-teal' },
  { key: 'closed', label: 'بسته شده', icon: XCircle, color: 'text-nx-mist', bg: 'bg-white dark:bg-nx-navy' },
];

export default function ServiceManagementDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ServiceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    serviceManagementApi.getSummary()
      .then(res => setSummary(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nx-navy dark:text-white flex items-center gap-3">
            <Headphones className="h-7 w-7 text-nx-blue" />
            مدیریت خدمات پس از فروش
          </h1>
          <p className="text-sm text-nx-mist dark:text-nx-mist mt-1">
            گارانتی، تعمیرات، قراردادهای خدماتی، SLA و نگهداری پیشگیرانه
          </p>
        </div>
        <button
          onClick={() => navigate('/erp')}
          className="flex items-center gap-2 text-sm text-nx-mist hover:text-nx-navy dark:text-nx-mist dark:hover:text-nx-mist/20"
        >
          <ArrowLeft className="h-4 w-4" />
          بازگشت
        </button>
      </div>

      {/* SLA Alerts */}
      {summary?.sla && summary.sla.breach_count > 0 && (
        <div className="bg-nx-danger-50 dark:bg-nx-danger-950 border border-nx-danger-200 dark:border-nx-danger-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-nx-danger-500" />
            <div>
              <h3 className="text-sm font-semibold text-nx-danger-700 dark:text-nx-danger-300">
                نقض SLA — {summary.sla.breach_count} مورد
              </h3>
              <p className="text-xs text-nx-danger-600 dark:text-nx-danger-400 mt-1">
                {summary.sla.breaches.slice(0, 3).map(b =>
                  `درخواست ${b.request} — ${b.type === 'response' ? 'زمان پاسخ' : 'زمان حل مشکل'}`
                ).join(' | ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {STATUSES.map(({ key, label, icon: Icon, color, bg }) => (
          <button
            key={key}
            onClick={() => navigate(`/erp/service-management/requests?status=${key}`)}
            className={`${bg} rounded-xl p-4 border border-nx-border dark:border-nx-navy-border hover:shadow-md transition-all text-center`}
          >
            <Icon className={`h-6 w-6 mx-auto ${color}`} />
            <p className="text-2xl font-bold text-nx-navy dark:text-white mt-2">
              {(summary as any)?.[key] as number ?? 0}
            </p>
            <p className="text-xs text-nx-mist dark:text-nx-mist mt-1">{label}</p>
          </button>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'درخواست جدید', desc: 'ایجاد درخواست خدمات جدید', path: '/erp/service-management/requests', icon: Headphones, color: 'text-nx-blue bg-nx-blue/10 dark:bg-nx-blue' },
          { label: 'دستور کار', desc: 'مدیریت دستور کارها', path: '/erp/service-management/work-orders', icon: Wrench, color: 'text-nx-blue bg-nx-blue/10 dark:bg-nx-warning-950' },
          { label: 'گارانتی', desc: 'بررسی و ثبت گارانتی', path: '/erp/service-management/warranties', icon: Shield, color: 'text-nx-teal bg-nx-teal/10 dark:bg-nx-teal' },
          { label: 'تکنسین‌ها', desc: 'مدیریت تکنسین‌ها', path: '/erp/service-management/technicians', icon: Users, color: 'text-nx-blue bg-nx-blue/10 dark:bg-nx-blue' },
        ].map(({ label, desc, path, icon: Icon, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="bg-white dark:bg-nx-navy rounded-xl p-4 border border-nx-border dark:border-nx-navy-border hover:shadow-md transition-all text-right"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.split(' ')[1]}`}>
              <Icon className={`h-5 w-5 ${color.split(' ')[0]}`} />
            </div>
            <h3 className="text-sm font-semibold text-nx-navy dark:text-white mt-3">{label}</h3>
            <p className="text-xs text-nx-mist dark:text-nx-mist mt-1">{desc}</p>
          </button>
        ))}
      </div>

      {/* More Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'قراردادها', desc: 'قراردادهای خدماتی', path: '/erp/service-management/contracts', icon: FileText, color: 'text-nx-teal bg-nx-teal/10 dark:bg-nx-teal' },
          { label: 'SLA', desc: 'قوانین سطح خدمات', path: '/erp/service-management/sla', icon: Clock, color: 'text-nx-warning-500 bg-nx-warning-50 dark:bg-nx-warning-950' },
          { label: 'نگهداری', desc: 'برنامه‌های نگهداری پیشگیرانه', path: '/erp/service-management/maintenance', icon: Wrench, color: 'text-nx-blue bg-nx-blue/10 dark:bg-nx-blue' },
          { label: 'داشبورد', desc: 'نمای کلی عملکرد', path: '/erp/service-management/dashboard', icon: Headphones, color: 'text-nx-danger-500 bg-nx-danger-50 dark:bg-nx-danger-950' },
        ].map(({ label, desc, path, icon: Icon, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="bg-white dark:bg-nx-navy rounded-xl p-4 border border-nx-border dark:border-nx-navy-border hover:shadow-md transition-all text-right"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color.split(' ')[1]}`}>
              <Icon className={`h-5 w-5 ${color.split(' ')[0]}`} />
            </div>
            <h3 className="text-sm font-semibold text-nx-navy dark:text-white mt-3">{label}</h3>
            <p className="text-xs text-nx-mist dark:text-nx-mist mt-1">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
