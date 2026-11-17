import { useEffect, useState } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { CARD, rial, num } from './shared'
import { LayoutDashboard, TrendingUp, Wallet, ReceiptText, AlertCircle } from 'lucide-react'

interface Summary {
  totals: { invoices: number; manual_debts: number; payments: number; credits: number }
  outstanding: number
  per_service: { invoice_type: string; amount: number }[]
  per_payer: { payer_code: string; payer: string; amount: number }[]
  monthly: { issue_date: string; issue_date_jalali: string; amount: number }[]
  approvals: { status: string; count: number }[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار تأیید',
  approved: 'تأیید شده',
  rejected: 'رد شده',
}

export default function BillingDashboardPage() {
  const { toast } = useToast()
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/billing/dashboard/summary/')
      .then((res) => setData(res.data))
      .catch(() => toast('خطا در دریافت خلاصهٔ مالی', 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return <div className="p-10 text-center text-sm text-nx-mist">در حال بارگذاری…</div>
  }
  if (!data) {
    return <div className="p-10 text-center text-sm text-nx-mist">داده‌ای برای نمایش نیست.</div>
  }

  const cards = [
    { label: 'جمع صورت‌حساب‌ها', value: data.totals.invoices, icon: ReceiptText, color: 'text-nx-blue' },
    { label: 'جمع پرداخت‌ها', value: data.totals.payments, icon: Wallet, color: 'text-emerald-400' },
    { label: 'اعتبار (بستانکاری)', value: data.totals.credits, icon: TrendingUp, color: 'text-amber-400' },
    { label: 'مانده وصول‌نشده', value: data.outstanding, icon: AlertCircle, color: 'text-rose-400' },
  ]

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="w-5 h-5 text-nx-blue" />
        <div>
          <h1 className="text-lg font-bold text-white">داشبورد مدیریتی</h1>
          <p className="text-xs text-nx-mist">خلاصهٔ عملکرد مالی شرکت‌های طرف حساب</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`${CARD} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-nx-mist">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xl font-bold text-white">{rial(value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className={`${CARD} p-5`}>
          <h2 className="text-sm font-semibold text-white mb-3">صورت‌حساب به تفکیک خدمت</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-nx-mist text-xs">
                <th className="text-right font-medium pb-2">نوع خدمت</th>
                <th className="text-left font-medium pb-2">مبلغ</th>
              </tr>
            </thead>
            <tbody>
              {data.per_service.length === 0 && (
                <tr><td colSpan={2} className="py-4 text-center text-xs text-nx-mist">داده‌ای ثبت نشده است.</td></tr>
              )}
              {data.per_service.map((row) => (
                <tr key={row.invoice_type} className="border-t border-nx-navy-border">
                  <td className="py-2 text-nx-mist">{row.invoice_type}</td>
                  <td className="py-2 text-left text-white">{rial(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={`${CARD} p-5`}>
          <h2 className="text-sm font-semibold text-white mb-3">بیشترین بدهی شرکت‌ها</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-nx-mist text-xs">
                <th className="text-right font-medium pb-2">شرکت</th>
                <th className="text-left font-medium pb-2">مبلغ</th>
              </tr>
            </thead>
            <tbody>
              {data.per_payer.map((row) => (
                <tr key={row.payer_code} className="border-t border-nx-navy-border">
                  <td className="py-2 text-nx-mist">{row.payer}</td>
                  <td className="py-2 text-left text-white">{rial(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={`${CARD} p-5`}>
          <h2 className="text-sm font-semibold text-white mb-3">روند ماهانه</h2>
          <div className="space-y-2">
            {data.monthly.length === 0 && <p className="text-xs text-nx-mist">هنوز صورت‌حسابی صادر نشده است.</p>}
            {data.monthly.map((row) => {
              const max = Math.max(...data.monthly.map((m) => m.amount), 1)
              return (
                <div key={row.issue_date}>
                  <div className="flex justify-between text-xs text-nx-mist mb-1">
                    <span>{row.issue_date_jalali}</span>
                    <span>{rial(row.amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-nx-navy">
                    <div className="h-1.5 rounded-full bg-nx-blue" style={{ width: `${(row.amount / max) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className={`${CARD} p-5`}>
          <h2 className="text-sm font-semibold text-white mb-3">وضعیت درخواست‌های صدور</h2>
          <ul className="space-y-2 text-sm">
            {data.approvals.length === 0 && <li className="text-xs text-nx-mist">درخواستی ثبت نشده است.</li>}
            {data.approvals.map((row) => (
              <li key={row.status} className="flex justify-between border-t border-nx-navy-border pt-2">
                <span className="text-nx-mist">{STATUS_LABELS[row.status] || row.status}</span>
                <span className="text-white font-medium">{num(row.count)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
