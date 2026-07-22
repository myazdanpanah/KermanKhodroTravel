/**
 * Reports Page — Execute and manage report templates
 */
import { useState, useEffect } from 'react';
import { Plus, Search, Play, FileText, Download, Clock } from 'lucide-react';
import { reportingApi, ReportTemplate, ReportExecution } from '../../api/reporting';
import { useToast } from '../../components/Toast';

const MODULE_LABELS: Record<string, string> = {
  finance: 'مالی', inventory: 'انبار', purchasing: 'خرید', sales: 'فروش',
  manufacturing: 'تولید', trading: 'بازرگانی', service_sales: 'فروش خدمات',
  service_management: 'مدیریت خدمات', crm: 'CRM', hr: 'منابع انسانی', cross_module: 'بین‌ماژولی',
};

const VIZ_LABELS: Record<string, string> = {
  table: 'جدول', chart_bar: 'نمودار میله‌ای', chart_line: 'خطی', chart_pie: 'دایره‌ای',
  chart_area: 'سطحی', kpi: 'KPI', pivot: 'جدول محوری',
};

export default function ReportsPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ReportExecution | null>(null);
  const [form, setForm] = useState({ name: '', description: '', module: 'finance', visualization: 'table' });

  useEffect(() => {
    Promise.all([reportingApi.getTemplates(), reportingApi.getExecutions()])
      .then(([r1, r2]) => { setTemplates(r1.data.data); setExecutions(r2.data.data); })
      .catch(() => toast('خطا در دریافت گزارش‌ها', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = templates.filter(t => !search || t.name.includes(search));

  const handleCreate = async () => {
    if (!form.name) return;
    try {
      const res = await reportingApi.createTemplate(form);
      setTemplates(prev => [res.data.data, ...prev]);
      setShowForm(false);
      setForm({ name: '', description: '', module: 'finance', visualization: 'table' });
      toast('قالب گزارش ایجاد شد', 'success');
    } catch { toast('خطا در ایجاد قالب', 'error'); }
  };

  const handleExecute = async (templateId: number) => {
    try {
      const res = await reportingApi.executeReport(templateId);
      setExecutions(prev => [res.data.data, ...prev]);
      setSelectedResult(res.data.data);
      toast('گزارش با موفقیت اجرا شد', 'success');
    } catch { toast('خطا در اجرای گزارش', 'error'); }
  };

  const handleExport = async (id: number, format: string) => {
    try {
      const res = await reportingApi.exportExecution(id, format);
      const blob = new Blob([res.data as any]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FileText className="h-6 w-6 text-indigo-500" /> گزارش‌ها
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{templates.length} قالب گزارش — {executions.length} اجرا</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
          <Plus className="h-4 w-4" /> قالب جدید
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><label className="block text-xs text-gray-500 mb-1">نام *</label><input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">توضیحات</label><input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">ماژول</label>
              <select value={form.module} onChange={e => setForm({ ...form, module: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm">
                {Object.entries(MODULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">نوع نمایش</label>
              <select value={form.visualization} onChange={e => setForm({ ...form, visualization: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm">
                {Object.entries(VIZ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">انصراف</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 text-sm">ایجاد</button>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..."
          className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
      </div>

      {/* Templates */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">هیچ قالب گزارشی یافت نشد</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filtered.map(t => (
              <div key={t.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 transition">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm">{t.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {MODULE_LABELS[t.module] || t.module}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">{t.description || '—'}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{VIZ_LABELS[t.visualization] || t.visualization}</span>
                  <button onClick={() => handleExecute(t.id)} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700">
                    <Play className="h-3 w-3" /> اجرا
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Executions */}
      {executions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" /> اجراهای اخیر
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {executions.slice(0, 5).map(e => (
              <div key={e.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer" onClick={() => setSelectedResult(e)}>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{e.template_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{e.row_count} ردیف — {new Date(e.created_at).toLocaleDateString('fa-IR')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${e.status === 'completed' ? 'bg-green-100 text-green-700' : e.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {e.status === 'completed' ? 'تکمیل' : e.status === 'failed' ? 'خطا' : 'در حال اجرا'}
                  </span>
                  {e.status === 'completed' && (
                    <div className="flex gap-1">
                      <button onClick={(ev) => { ev.stopPropagation(); handleExport(e.id, 'csv'); }} className="text-xs text-gray-400 hover:text-gray-600"><Download className="h-3 w-3" /></button>
                      <button onClick={(ev) => { ev.stopPropagation(); handleExport(e.id, 'json'); }} className="text-xs text-gray-400 hover:text-gray-600">JSON</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result Preview Modal */}
      {selectedResult && selectedResult.status === 'completed' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedResult(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selectedResult.template_name}</h2>
              <button onClick={() => setSelectedResult(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{selectedResult.row_count} ردیف — {selectedResult.execution_time_ms}ms</p>
            {selectedResult.result_data?.headers && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {selectedResult.result_data.headers.map((h, i) => (
                        <th key={i} className="text-right px-3 py-2 font-medium text-gray-500 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedResult.result_data.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-gray-100 dark:border-gray-800">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-xs">{typeof cell === 'number' ? cell.toLocaleString('fa-IR') : String(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => handleExport(selectedResult.id, 'csv')} className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg">دانلود CSV</button>
              <button onClick={() => handleExport(selectedResult.id, 'json')} className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg">دانلود JSON</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
