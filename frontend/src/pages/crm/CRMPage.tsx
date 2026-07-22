/**
 * CRM Dashboard
 * Per IMPLEMENTATION_ROADMAP.md §18: CRM APIs.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, TrendingUp, Target, Calendar, BarChart3,
} from 'lucide-react';
import { crmApi, CRMSummary } from '../../api/crm';

const STAGE_LABELS: Record<string, string> = {
  lead: 'سرنخ',
  qualified: 'تایید شده',
  proposal_sent: 'پیشنهاد ارسال شده',
  verbal_agreement: 'توافق شفاهی',
  contract_sent: 'قرارداد ارسال شده',
  closed: 'بسته شده',
};

export default function CRMPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CRMSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmApi.getSummary()
      .then(res => setSummary(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Users className="h-7 w-7 text-orange-500" />
            مدیریت ارتباط با مشتری
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            سرنخ‌ها، فرصت‌ها، فعالیت‌ها و کمپین‌ها
          </p>
        </div>
      </div>

      {/* Lead Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { key: 'total', label: 'کل سرنخ‌ها', color: 'text-gray-900 bg-gray-50 dark:bg-gray-900' },
          { key: 'new', label: 'جدید', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950' },
          { key: 'contacted', label: 'تماس گرفته شده', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950' },
          { key: 'qualified', label: 'تایید شده', color: 'text-green-600 bg-green-50 dark:bg-green-950' },
          { key: 'converted', label: 'تبدیل شده', color: 'text-orange-600 bg-orange-50 dark:bg-orange-950' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => navigate(`/erp/crm/leads?status=${key === 'total' ? '' : key}`)}
            className={`${color} rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all text-center`}
          >
            <p className="text-2xl font-bold">{(summary?.leads as any)?.[key] ?? 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
          </button>
        ))}
      </div>

      {/* Pipeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-orange-500" />
          قیف فروش
        </h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {Object.entries(STAGE_LABELS).map(([stage, label]) => (
            <div key={stage} className="text-center">
              <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-3 mb-2">
                <p className="text-xl font-bold text-orange-600">{summary?.pipeline?.by_stage?.[stage] ?? 0}</p>
              </div>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-around mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="text-center">
            <p className="text-lg font-bold text-green-600">{summary?.pipeline?.won_count ?? 0}</p>
            <p className="text-xs text-gray-500">برده شده</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-red-500">{summary?.pipeline?.lost_count ?? 0}</p>
            <p className="text-xs text-gray-500">از دست رفته</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-orange-600">{(summary?.pipeline?.weighted_value ?? 0).toLocaleString('fa-IR')}</p>
            <p className="text-xs text-gray-500">ارزش وزنی</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'سرنخ جدید', path: '/erp/crm/leads', icon: Users, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950' },
          { label: 'فرصت جدید', path: '/erp/crm/opportunities', icon: TrendingUp, color: 'text-green-500 bg-green-50 dark:bg-green-950' },
          { label: 'فعالیت', path: '/erp/crm/activities', icon: Calendar, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950' },
          { label: 'کمپین', path: '/erp/crm/campaigns', icon: Target, color: 'text-orange-500 bg-orange-50 dark:bg-orange-950' },
        ].map(({ label, path, icon: Icon, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all text-right"
          >
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
