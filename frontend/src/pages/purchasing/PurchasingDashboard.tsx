import { useEffect, useState } from 'react'
import { ClipboardList, ShoppingCart, Package, Clock, TrendingUp, CheckCircle } from 'lucide-react'
import client from '../../api/client'

interface PurchasingSummary {
  total_purchase_requests: number
  pending_purchase_requests: number
  total_purchase_orders: number
  active_purchase_orders: number
  total_goods_receipts: number
  pending_goods_receipts: number
  active_order_value: number
}

export default function PurchasingDashboard() {
  const [summary, setSummary] = useState<PurchasingSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/purchasing/summary/').then((res) => {
      setSummary(res.data.data)
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
    { label: 'درخواست‌ها', value: summary?.total_purchase_requests ?? 0, icon: ClipboardList, color: 'text-nx-blue', bg: 'bg-nx-blue/10' },
    { label: 'در انتظار تأیید', value: summary?.pending_purchase_requests ?? 0, icon: Clock, color: 'text-nx-warning-400', bg: 'bg-nx-warning-500/10' },
    { label: 'سفارشات فعال', value: summary?.active_purchase_orders ?? 0, icon: ShoppingCart, color: 'text-nx-teal', bg: 'bg-nx-teal/10' },
    { label: 'رسیدهای در انتظار', value: summary?.pending_goods_receipts ?? 0, icon: Package, color: 'text-nx-blue', bg: 'bg-nx-blue/10' },
    { label: 'ارزش سفارشات فعال', value: `${((summary?.active_order_value ?? 0) / 1_000_000).toFixed(1)}M`, icon: TrendingUp, color: 'text-nx-warning-400', bg: 'bg-nx-blue/10' },
  ]

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-white">داشبورد خرید</h1>
        <p className="text-nx-mist text-sm mt-1">مدیریت درخواست‌ها، سفارشات و رسید کالا</p>
      </div>

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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-nx-navy border border-nx-navy-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-nx-teal" />
            <h3 className="text-sm font-bold text-white">مجموع سفارشات</h3>
          </div>
          <div className="text-3xl font-bold text-white">{summary?.total_purchase_orders ?? 0}</div>
        </div>
        <div className="bg-nx-navy border border-nx-navy-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-nx-blue" />
            <h3 className="text-sm font-bold text-white">مجموع رسیدها</h3>
          </div>
          <div className="text-3xl font-bold text-white">{summary?.total_goods_receipts ?? 0}</div>
        </div>
        <div className="bg-nx-navy border border-nx-navy-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-5 h-5 text-nx-warning-400" />
            <h3 className="text-sm font-bold text-white">مجموع درخواست‌ها</h3>
          </div>
          <div className="text-3xl font-bold text-white">{summary?.total_purchase_requests ?? 0}</div>
        </div>
      </div>
    </div>
  )
}
