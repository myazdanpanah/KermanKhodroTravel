import { useState, useEffect, useCallback } from 'react'
import { aiApi, type Forecast } from '../../api/aiInsights'
import { useToast } from '../../components/Toast'
import { TrendingUp, Plus, BarChart3 } from 'lucide-react'

export default function ForecastsPage() {
  const { toast } = useToast()
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ module: 'finance', metric_name: 'revenue', periods: 30 })
  const [selectedForecast, setSelectedForecast] = useState<Forecast | null>(null)

  const fetchForecasts = useCallback(async () => {
    try {
      const res = await aiApi.getForecasts()
      setForecasts(res.data)
    } catch {
      toast('خطا در بارگذاری پیش‌بینی‌ها', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchForecasts() }, [fetchForecasts])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    try {
      const res = await aiApi.generateForecast(form)
      toast('پیش‌بینی جدید ایجاد شد', 'success')
      setSelectedForecast(res.data)
      setShowForm(false)
      fetchForecasts()
    } catch {
      toast('خطا در ایجاد پیش‌بینی — شاید داده کافی نیست', 'error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">پیش‌بینی</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Forecasts & Projections</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition">
          <Plus className="w-4 h-4" /> Generate Forecast
        </button>
      </div>

      {/* Generate Form */}
      {showForm && (
        <form onSubmit={handleGenerate} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Generate New Forecast</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Module</label>
              <select value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm">
                <option value="finance">Finance</option>
                <option value="sales">Sales</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="hr">HR</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Metric</label>
              <select value={form.metric_name} onChange={(e) => setForm({ ...form, metric_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm">
                <option value="revenue">Revenue</option>
                <option value="orders">Orders</option>
                <option value="cost">Cost</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Periods (days)</label>
              <input type="number" value={form.periods} onChange={(e) => setForm({ ...form, periods: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" disabled={generating}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 text-sm">
              {generating ? 'Generating...' : 'Generate'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Forecast Detail */}
      {selectedForecast && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {selectedForecast.metric_name} — {selectedForecast.forecast_period}
            </h3>
            <span className="text-xs text-gray-500">Accuracy: {selectedForecast.accuracy_score}%</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-600 dark:text-gray-400">Date</th>
                  <th className="text-right py-2 text-gray-600 dark:text-gray-400">Predicted</th>
                  <th className="text-right py-2 text-gray-600 dark:text-gray-400">Lower</th>
                  <th className="text-right py-2 text-gray-600 dark:text-gray-400">Upper</th>
                </tr>
              </thead>
              <tbody>
                {selectedForecast.forecast_data.slice(0, 15).map((d, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 text-gray-700 dark:text-gray-300">{d.date}</td>
                    <td className="py-2 text-right font-medium text-gray-900 dark:text-gray-100">{d.value.toLocaleString()}</td>
                    <td className="py-2 text-right text-gray-500">{d.lower_bound.toLocaleString()}</td>
                    <td className="py-2 text-right text-gray-500">{d.upper_bound.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Forecast List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : forecasts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No forecasts yet. Generate your first forecast above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forecasts.map((f) => (
            <button key={f.id} onClick={() => setSelectedForecast(f)}
              className={`text-left bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border transition ${selectedForecast?.id === f.id ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'}`}>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">{f.metric_name}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 capitalize">{f.module} · {f.forecast_period}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  {f.accuracy_score}% accuracy
                </span>
                <span className="text-xs text-gray-400">{f.model_used}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
