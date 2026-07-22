/**
 * Work Order Detail Page
 * Per UI_UX_GUIDELINES.md §9: Detail views.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Play, CheckCircle, XCircle, Clock,
  DollarSign, Users, FileText,
} from 'lucide-react';
import { serviceManagementApi, WorkOrder } from '../../api/serviceManagement';

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  created: { label: 'ایجاد شده', color: 'bg-gray-100 text-gray-700', icon: Clock },
  assigned: { label: 'تخصیص یافته', color: 'bg-purple-100 text-purple-700', icon: Users },
  started: { label: 'شروع شده', color: 'bg-blue-100 text-blue-700', icon: Play },
  paused: { label: 'متوقف', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  completed: { label: 'تکمیل شده', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  approved: { label: 'تأیید شده', color: 'bg-teal-100 text-teal-700', icon: CheckCircle },
  closed: { label: 'بسته شده', color: 'bg-gray-100 text-gray-700', icon: XCircle },
};

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [showCostForm, setShowCostForm] = useState(false);
  const [costs, setCosts] = useState({
    actual_labor_cost: 0,
    actual_parts_cost: 0,
    actual_external_cost: 0,
    actual_overhead: 0,
    actual_hours: 0,
  });

  useEffect(() => {
    if (!id) return;
    serviceManagementApi.getWorkOrder(Number(id))
      .then(res => {
        const wo = res.data.data;
        setOrder(wo);
        setCosts({
          actual_labor_cost: wo.actual_labor_cost,
          actual_parts_cost: wo.actual_parts_cost,
          actual_external_cost: wo.actual_external_cost,
          actual_overhead: wo.actual_overhead,
          actual_hours: wo.actual_hours,
        });
      })
      .catch(() => navigate('/erp/service-management/work-orders'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = async (action: string) => {
    if (!order) return;
    setTransitioning(true);
    try {
      let res;
      if (action === 'start') res = await serviceManagementApi.startWorkOrder(order.id);
      else if (action === 'complete') res = await serviceManagementApi.completeWorkOrder(order.id);
      else if (action === 'approve') res = await serviceManagementApi.approveWorkOrder(order.id);
      if (res) setOrder(res.data.data);
    } catch {}
    setTransitioning(false);
  };

  const handleCostUpdate = async () => {
    if (!order) return;
    try {
      const res = await serviceManagementApi.updateWorkOrder(order.id, costs);
      setOrder(res.data.data);
      setShowCostForm(false);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!order) return null;

  const status = STATUS_MAP[order.status] || STATUS_MAP.created;
  const StatusIcon = status.icon;

  const costBreakdown = [
    { label: 'هزینه نیروی کار', value: order.actual_labor_cost, color: 'text-blue-600' },
    { label: 'هزینه قطعات', value: order.actual_parts_cost, color: 'text-green-600' },
    { label: 'هزینه خارجی', value: order.actual_external_cost, color: 'text-purple-600' },
    { label: 'هزینه سربار', value: order.actual_overhead, color: 'text-orange-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/erp/service-management/work-orders')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {order.work_order_number}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              درخواست: {order.service_request_number} — {order.technician_name || 'بدون تکنسین'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
            <StatusIcon className="h-4 w-4" />
            {status.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem & Diagnosis */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">مشکل و تشخیص</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-1">مشکل گزارش شده</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">{order.problem || '—'}</p>
              </div>
              {order.diagnosis && (
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                  <h4 className="text-xs font-medium text-gray-500 mb-1">تشخیص</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{order.diagnosis}</p>
                </div>
              )}
              {order.resolution && (
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                  <h4 className="text-xs font-medium text-gray-500 mb-1">راه حل</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{order.resolution}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">عملیات</h3>
            <div className="flex flex-wrap gap-2">
              {order.status === 'created' && (
                <button onClick={() => handleAction('start')} disabled={transitioning}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm">
                  <Play className="h-4 w-4" /> شروع کار
                </button>
              )}
              {order.status === 'started' && (
                <button onClick={() => handleAction('complete')} disabled={transitioning}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm">
                  <CheckCircle className="h-4 w-4" /> تکمیل کار
                </button>
              )}
              {order.status === 'completed' && (
                <button onClick={() => handleAction('approve')} disabled={transitioning}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition text-sm">
                  <CheckCircle className="h-4 w-4" /> تأیید کار
                </button>
              )}
              <button onClick={() => setShowCostForm(!showCostForm)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition text-sm border border-orange-200">
                <DollarSign className="h-4 w-4" /> ثبت هزینه
              </button>
            </div>

            {/* Cost Form */}
            {showCostForm && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { key: 'actual_labor_cost', label: 'هزینه نیروی کار' },
                    { key: 'actual_parts_cost', label: 'هزینه قطعات' },
                    { key: 'actual_external_cost', label: 'هزینه خارجی' },
                    { key: 'actual_overhead', label: 'هزینه سربار' },
                    { key: 'actual_hours', label: 'ساعت کار' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input type="number" value={(costs as any)[key]}
                        onChange={e => setCosts({ ...costs, [key]: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => setShowCostForm(false)} className="px-3 py-1.5 text-sm text-gray-600">انصراف</button>
                  <button onClick={handleCostUpdate} className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">ذخیره</button>
                </div>
              </div>
            )}
          </div>

          {/* Operations */}
          {order.operations && order.operations.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">عملیات انجام شده</h3>
              <div className="space-y-3">
                {order.operations.map(op => (
                  <div key={op.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="text-xs font-mono text-gray-400 w-6">{op.sequence}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{op.name}</p>
                      {op.description && <p className="text-xs text-gray-500 mt-0.5">{op.description}</p>}
                    </div>
                    <span className="text-xs text-gray-400">{op.labor_hours}h</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      op.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {op.status === 'completed' ? 'تکمیل' : op.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Cost Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">خلاصه هزینه‌ها</h3>
            <div className="space-y-3">
              {costBreakdown.map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-sm font-medium ${color}`}>{value.toLocaleString('fa-IR')} ریال</span>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">جمع کل</span>
                <span className="text-lg font-bold text-orange-600">{order.actual_total_cost.toLocaleString('fa-IR')} ریال</span>
              </div>
            </div>
          </div>

          {/* Time Tracking */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">زمان</h3>
            <dl className="space-y-2">
              {[
                { label: 'ساعت تخمینی', value: `${order.estimated_hours}h` },
                { label: 'ساعت واقعی', value: `${order.actual_hours}h` },
                { label: 'شروع', value: order.start_date ? new Date(order.start_date).toLocaleString('fa-IR') : '—' },
                { label: 'پایان', value: order.completed_date ? new Date(order.completed_date).toLocaleString('fa-IR') : '—' },
                { label: 'تأیید', value: order.approved_date ? new Date(order.approved_date).toLocaleString('fa-IR') : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-xs text-gray-500">{label}</dt>
                  <dd className="text-xs font-medium text-gray-900 dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Required Parts */}
          {order.required_parts && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                قطعات مورد نیاز
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{order.required_parts}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
