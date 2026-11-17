import { useEffect, useState } from 'react'
import { Package, Warehouse, AlertTriangle, TrendingDown, ShoppingCart, ArrowUpDown } from 'lucide-react'
import client from '../../api/client'

interface InventorySummary {
  total_warehouses: number
  total_products: number
  total_inventory_value: number
  low_stock_items: number
  pending_reservations: number
}

interface StockItem {
  product_name: string
  product_code: string
  warehouse: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
  unit_cost: number
  total_value: number
}

export default function InventoryDashboard() {
  const [summary, setSummary] = useState<InventorySummary | null>(null)
  const [stock, setStock] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      client.get('/inventory/summary/'),
      client.get('/inventory/balances/'),
    ]).then(([summaryRes, stockRes]) => {
      setSummary(summaryRes.data.data)
      setStock(stockRes.data.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-nx-blue border-t-transparent rounded-full" />
      </div>
    )
  }

  const kpis = [
    { label: 'انبارها', value: summary?.total_warehouses ?? 0, icon: Warehouse, color: 'text-nx-blue', bg: 'bg-nx-blue/10' },
    { label: 'محصولات', value: summary?.total_products ?? 0, icon: Package, color: 'text-nx-teal', bg: 'bg-nx-teal/10' },
    { label: 'ارزش موجودی', value: `${((summary?.total_inventory_value ?? 0) / 1_000_000).toFixed(1)}M`, icon: TrendingDown, color: 'text-nx-blue', bg: 'bg-nx-blue/10' },
    { label: 'کمبود موجودی', value: summary?.low_stock_items ?? 0, icon: AlertTriangle, color: 'text-nx-danger-400', bg: 'bg-nx-danger-500/10' },
    { label: 'رزروهای فعال', value: summary?.pending_reservations ?? 0, icon: ShoppingCart, color: 'text-nx-warning-400', bg: 'bg-nx-warning-500/10' },
  ]

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">داشبورد انبار</h1>
        <p className="text-nx-mist text-sm mt-1">مدیریت موجودی و حرکات انبار</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-nx-navy border border-nx-navy-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.bg}`}>
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-white">{kpi.value}</div>
            <div className="text-xs text-nx-mist mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Stock Table */}
      <div className="bg-nx-navy border border-nx-navy-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-nx-navy-border flex items-center gap-2">
          <ArrowUpDown className="w-5 h-5 text-nx-warning-400" />
          <h2 className="text-lg font-bold text-white">موجودی فعلی</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nx-navy-border text-nx-mist">
                <th className="text-right px-4 py-3 font-medium">محصول</th>
                <th className="text-right px-4 py-3 font-medium">کد</th>
                <th className="text-right px-4 py-3 font-medium">انبار</th>
                <th className="text-left px-4 py-3 font-medium">موجودی</th>
                <th className="text-left px-4 py-3 font-medium">رزرو</th>
                <th className="text-left px-4 py-3 font-medium">قابل استفاده</th>
                <th className="text-left px-4 py-3 font-medium">قیمت واحد</th>
                <th className="text-left px-4 py-3 font-medium">ارزش کل</th>
              </tr>
            </thead>
            <tbody>
              {stock.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-nx-mist">
                    موجودی یافت نشد
                  </td>
                </tr>
              ) : (
                stock.map((item, idx) => (
                  <tr key={idx} className="border-b border-nx-navy/50 hover:bg-nx-navy-elevated transition">
                    <td className="px-4 py-3 text-white font-medium">{item.product_name}</td>
                    <td className="px-4 py-3 text-nx-mist">{item.product_code}</td>
                    <td className="px-4 py-3 text-nx-mist">{item.warehouse}</td>
                    <td className="px-4 py-3 text-left text-white">{item.quantity_on_hand.toLocaleString()}</td>
                    <td className="px-4 py-3 text-left text-nx-warning-400">{item.quantity_reserved.toLocaleString()}</td>
                    <td className="px-4 py-3 text-left text-nx-teal">{item.quantity_available.toLocaleString()}</td>
                    <td className="px-4 py-3 text-left text-nx-mist">{item.unit_cost.toLocaleString()} ریال</td>
                    <td className="px-4 py-3 text-left text-white font-medium">{item.total_value.toLocaleString()} ریال</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
