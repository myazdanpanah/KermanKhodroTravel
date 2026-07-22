/**
 * Service Request Detail Page
 * Per UI_UX_GUIDELINES.md §9: Detail views, §11: Status workflows.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Clock, User, Wrench, CheckCircle,
  XCircle, Shield, Play, Package,
} from 'lucide-react';
import { serviceManagementApi, ServiceRequest, Technician } from '../../api/serviceManagement';

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  new: { label: 'جدید', color: 'bg-blue-100 text-blue-700', icon: Clock },
  assigned: { label: 'تخصیص یافته', color: 'bg-purple-100 text-purple-700', icon: User },
  in_progress: { label: 'در حال انجام', color: 'bg-orange-100 text-orange-700', icon: Wrench },
  waiting_customer: { label: 'در انتظار مشتری', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  waiting_parts: { label: 'در انتظار قطعات', color: 'bg-amber-100 text-amber-700', icon: Package },
  completed: { label: 'تکمیل شده', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'بسته شده', color: 'bg-gray-100 text-gray-700', icon: XCircle },
  cancelled: { label: 'لغو شده', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: 'کم', color: 'bg-gray-100 text-gray-700' },
  medium: { label: 'متوسط', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'زیاد', color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'بحرانی', color: 'bg-red-100 text-red-700' },
};

const TRANSITIONS: Record<string, string[]> = {
  new: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['waiting_customer', 'waiting_parts', 'completed'],
  waiting_customer: ['in_progress', 'cancelled'],
  waiting_parts: ['in_progress'],
  completed: ['closed'],
  closed: [],
  cancelled: [],
};

const TRANSITION_LABELS: Record<string, string> = {
  assigned: 'تخصیص',
  in_progress: 'شروع انجام',
  waiting_customer: 'انتظار مشتری',
  waiting_parts: 'انتظار قطعات',
  completed: 'تکمیل',
  closed: 'بستن',
  cancelled: 'لغو',
};

export default function ServiceRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      serviceManagementApi.getServiceRequest(Number(id)),
      serviceManagementApi.getTechnicians(),
    ])
      .then(([srRes, techRes]) => {
        setRequest(srRes.data.data);
        setTechnicians(techRes.data.data);
      })
      .catch(() => navigate('/erp/service-management/requests'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAssign = async (technicianId: number) => {
    if (!request) return;
    try {
      const res = await serviceManagementApi.assignTechnician(request.id, technicianId);
      setRequest(res.data.data);
    } catch {}
  };

  const handleTransition = async (newStatus: string) => {
    if (!request) return;
    setTransitioning(true);
    try {
      const res = await serviceManagementApi.transitionRequest(request.id, newStatus);
      setRequest(res.data.data);
    } catch {}
    setTransitioning(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!request) return null;

  const status = STATUS_MAP[request.status] || STATUS_MAP.new;
  const priority = PRIORITY_MAP[request.priority] || PRIORITY_MAP.medium;
  const StatusIcon = status.icon;
  const availableTransitions = TRANSITIONS[request.status] || [];

  // Build timeline from request data
  const timeline = [
    { time: request.created_at, label: 'درخواست ایجاد شد', icon: Clock, color: 'text-blue-500 bg-blue-100' },
    ...(request.assigned_technician_name ? [{ time: request.created_at, label: `تخصیص به ${request.assigned_technician_name}`, icon: User, color: 'text-purple-500 bg-purple-100' }] : []),
    ...(request.resolved_date ? [{ time: request.resolved_date, label: 'مشکل حل شد', icon: CheckCircle, color: 'text-green-500 bg-green-100' }] : []),
    ...(request.closed_date ? [{ time: request.closed_date, label: 'درخواست بسته شد', icon: XCircle, color: 'text-gray-500 bg-gray-100' }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/erp/service-management/requests')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {request.request_number}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {request.customer_name} — {request.product_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
            <StatusIcon className="h-4 w-4" />
            {status.label}
          </span>
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${priority.color}`}>
            {priority.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem Description */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">توضیحات مشکل</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              {request.problem_description || 'بدون توضیحات'}
            </p>
            {request.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <h4 className="text-xs font-medium text-gray-500 mb-1">یادداشت‌ها</h4>
                <p className="text-gray-500 text-sm">{request.notes}</p>
              </div>
            )}
          </div>

          {/* Status Transition Buttons */}
          {availableTransitions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">تغییر وضعیت</h3>
              <div className="flex flex-wrap gap-2">
                {availableTransitions.map(ts => (
                  <button
                    key={ts}
                    onClick={() => handleTransition(ts)}
                    disabled={transitioning}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${ts === 'cancelled'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                        : ts === 'completed'
                        ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                        : 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {ts === 'assigned' && <User className="h-4 w-4" />}
                    {ts === 'in_progress' && <Play className="h-4 w-4" />}
                    {ts === 'waiting_customer' && <Clock className="h-4 w-4" />}
                    {ts === 'waiting_parts' && <Package className="h-4 w-4" />}
                    {ts === 'completed' && <CheckCircle className="h-4 w-4" />}
                    {ts === 'closed' && <XCircle className="h-4 w-4" />}
                    {ts === 'cancelled' && <XCircle className="h-4 w-4" />}
                    {TRANSITION_LABELS[ts] || ts}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">تاریخچه</h3>
            <div className="space-y-4">
              {timeline.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-full ${item.color}`}>
                    <item.icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{item.label}</p>
                    <p className="text-xs text-gray-400">{new Date(item.time).toLocaleString('fa-IR')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">اطلاعات</h3>
            <dl className="space-y-3">
              {[
                { label: 'محصول', value: request.product_name },
                { label: 'کد محصول', value: request.product_code || '—' },
                { label: 'شماره سریال', value: request.serial_number || '—' },
                { label: 'مشتری', value: request.customer_name || '—' },
                { label: 'اولویت', value: priority.label },
                { label: 'قابل پرداخت', value: request.is_chargeable ? 'بله' : 'خیر' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-xs text-gray-500">{label}</dt>
                  <dd className="text-xs font-medium text-gray-900 dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Warranty */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              گارانتی
            </h3>
            {request.warranty ? (
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                request.warranty_status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {request.warranty_status === 'active' ? 'فعال' : 'منقضی'}
              </span>
            ) : (
              <p className="text-xs text-gray-500">بدون گارانتی</p>
            )}
          </div>

          {/* Assignment */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">تکنسین</h3>
            {request.assigned_technician_name ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-purple-500" />
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {request.assigned_technician_name}
                </span>
              </div>
            ) : (
              <select
                onChange={e => handleAssign(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                defaultValue=""
              >
                <option value="" disabled>انتخاب تکنسین...</option>
                {technicians.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* SLA */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">SLA</h3>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-xs text-gray-500">مهلت پاسخ</dt>
                <dd className="text-xs">{request.sla_response_met !== null ? (
                  request.sla_response_met ? (
                    <span className="text-green-600">✓ رعایت شده</span>
                  ) : (
                    <span className="text-red-600">✗ نقض شده</span>
                  )
                ) : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-xs text-gray-500">مهلت حل مشکل</dt>
                <dd className="text-xs">{request.sla_resolution_met !== null ? (
                  request.sla_resolution_met ? (
                    <span className="text-green-600">✓ رعایت شده</span>
                  ) : (
                    <span className="text-red-600">✗ نقض شده</span>
                  )
                ) : '—'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
