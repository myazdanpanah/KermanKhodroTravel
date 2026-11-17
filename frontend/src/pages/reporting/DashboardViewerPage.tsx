/**
 * Dashboard Viewer Page — Renders dashboard widgets with ECharts
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Settings, RefreshCw } from 'lucide-react';
import { reportingApi, Dashboard, DashboardWidget } from '../../api/reporting';
import ChartWidget from '../../components/ChartWidget';
import { useToast } from '../../components/Toast';

const CHART_TYPE_LABELS: Record<string, string> = {
  line: 'خطی', bar: 'میله‌ای', stacked_bar: 'stacked', pie: 'دایره‌ای',
  donut: 'حلقه‌ای', area: 'سطحی', scatter: 'پراکنده', gauge: 'گیج',
  heatmap: 'نقشه حرارتی', treemap: 'درختی', funnel: 'قیفی', radar: 'راداری',
  kpi: 'KPI', table: 'جدول',
};

export default function DashboardViewerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    reportingApi.getDashboard(Number(id))
      .then(r => setDashboard(r.data.data))
      .catch(() => toast('خطا در بارگذاری داشبورد', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRefresh = () => {
    if (!id) return;
    setLoading(true);
    reportingApi.getDashboard(Number(id))
      .then(r => setDashboard(r.data.data))
      .catch(() => toast('خطا در بروزرسانی', 'error'))
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nx-blue" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center py-12 text-nx-mist">
        <p>داشبورد یافت نشد</p>
        <button onClick={() => navigate('/erp/reports/dashboards')} className="mt-4 text-nx-blue hover:text-nx-blue">
          بازگشت به لیست
        </button>
      </div>
    );
  }

  const widgets = dashboard.widgets || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/erp/reports/dashboards')} className="p-2 text-nx-mist hover:text-nx-mist">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white dark:text-white">{dashboard.name}</h1>
            <p className="text-sm text-nx-mist dark:text-nx-mist">{dashboard.description || 'بدون توضیح'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} className="p-2 text-nx-mist hover:text-nx-mist hover:bg-nx-mist/10 rounded-lg">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button className="p-2 text-nx-mist hover:text-nx-mist hover:bg-nx-mist/10 rounded-lg">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Widgets Grid */}
      {widgets.length === 0 ? (
        <div className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border p-12 text-center">
          <p className="text-nx-mist text-sm">هنوز ویجتی اضافه نشده است</p>
          <p className="text-nx-mist text-xs mt-2">از API ویجت‌ها را به این داشبورد اضافه کنید</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {widgets.map((widget: DashboardWidget) => (
            <div
              key={widget.id}
              className="bg-white dark:bg-nx-navy rounded-xl border border-nx-border dark:border-nx-navy-border overflow-hidden hover:shadow-md transition"
              style={{ minHeight: `${widget.height * 60}px` }}
            >
              <div className="px-4 py-2 border-b border-nx-border dark:border-nx-navy-border flex items-center justify-between">
                <h3 className="text-sm font-medium text-nx-navy dark:text-white">{widget.title}</h3>
                <span className="text-xs text-nx-mist">{CHART_TYPE_LABELS[widget.chart_type] || widget.chart_type}</span>
              </div>
              <div className="p-2" style={{ height: `${widget.height * 60 - 40}px` }}>
                {widget.query_config?.dataset_id ? (
                  <ChartWidget
                    widget={{
                      id: String(widget.id),
                      title: widget.title,
                      chartType: widget.chart_type,
                      datasetId: widget.query_config?.dataset_id as number,
                      chartConfig: widget.config || {},
                      queryConfig: widget.query_config || {},
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-nx-mist text-xs">
                    منبع داده تنظیم نشده
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
