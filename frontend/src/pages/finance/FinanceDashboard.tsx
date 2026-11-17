import { useState, useEffect } from 'react'
import { getFinanceSummary } from '../../api/finance'
import { useToast } from '../../components/Toast'
import {
  TrendingUp, TrendingDown, Landmark, Users, Truck,
  Receipt, CreditCard, FileText, Calendar
} from 'lucide-react'

interface FinanceSummary {
  fiscal_year: { name: string; start_date_jalali: string; end_date_jalali: string } | null
  total_sales: number
  total_purchases: number
  total_receipts: number
  total_payments: number
  open_cheques_received: number
  open_cheques_issued: number
  bank_balance: number
  customers_count: number
  suppliers_count: number
}

const formatIRR = (amount: number) => {
  return new Intl.NumberFormat('fa-IR').format(amount) + ' ریال'
}

const KPICard = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
}) => (
  <div className="bg-nx-navy-elevated border border-nx-navy-border rounded-2xl p-5 hover:border-nx-navy-border transition-all duration-200">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    <p className="text-2xl font-bold text-white mb-1">{value}</p>
    <p className="text-sm text-nx-mist">{label}</p>
  </div>
)

export default function FinanceDashboard() {
  const { toast } = useToast()
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSummary()
  }, [])

  const fetchSummary = async () => {
    try {
      const res = await getFinanceSummary()
      setSummary(res.data)
    } catch {
      toast('خطا در دریافت خلاصه مالی', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-nx-teal border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-96 text-nx-mist">
        خلاصه مالی در دسترس نیست
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">داشبورد مالی</h1>
          <p className="text-nx-mist mt-1">
            {summary.fiscal_year
              ? `سال مالی ${summary.fiscal_year.name}`
              : 'سال مالی تعریف نشده'}
          </p>
        </div>
        {summary.fiscal_year && (
          <div className="flex items-center gap-2 text-sm text-nx-mist bg-nx-navy-elevated px-4 py-2 rounded-xl">
            <Calendar className="w-4 h-4" />
            <span>
              {summary.fiscal_year.start_date_jalali} — {summary.fiscal_year.end_date_jalali}
            </span>
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={TrendingUp}
          label="فروش تأیید شده"
          value={formatIRR(summary.total_sales)}
          color="bg-nx-teal"
        />
        <KPICard
          icon={TrendingDown}
          label="خرید تأیید شده"
          value={formatIRR(summary.total_purchases)}
          color="bg-nx-blue"
        />
        <KPICard
          icon={Receipt}
          label="دریافت‌ها"
          value={formatIRR(summary.total_receipts)}
          color="bg-nx-blue"
        />
        <KPICard
          icon={CreditCard}
          label="پرداخت‌ها"
          value={formatIRR(summary.total_payments)}
          color="bg-nx-blue"
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Landmark}
          label="مانده بانک"
          value={formatIRR(summary.bank_balance)}
          color="bg-nx-blue"
        />
        <KPICard
          icon={FileText}
          label="چک‌های دریافتی (باز)"
          value={formatIRR(summary.open_cheques_received)}
          color="bg-nx-teal"
        />
        <KPICard
          icon={FileText}
          label="چک‌های صادره (باز)"
          value={formatIRR(summary.open_cheques_issued)}
          color="bg-nx-blue"
        />
        <KPICard
          icon={Users}
          label="مشتریان فعال"
          value={summary.customers_count}
          color="bg-nx-blue"
        />
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-nx-navy-elevated border border-nx-navy-border rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">مانده حساب‌ها</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-nx-navy-elevated rounded-xl">
              <span className="text-nx-mist">مانده بانک</span>
              <span className="text-white font-medium">{formatIRR(summary.bank_balance)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-nx-navy-elevated rounded-xl">
              <span className="text-nx-mist">دریافتی‌ها - پرداختی‌ها</span>
              <span className={`font-medium ${summary.total_receipts - summary.total_payments >= 0 ? 'text-nx-teal' : 'text-nx-danger-400'}`}>
                {formatIRR(summary.total_receipts - summary.total_payments)}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-nx-navy-elevated border border-nx-navy-border rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">آمار طرف حساب‌ها</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-nx-navy-elevated rounded-xl">
              <Users className="w-5 h-5 text-nx-blue" />
              <span className="text-nx-mist flex-1">مشتریان فعال</span>
              <span className="text-white font-bold text-lg">{summary.customers_count}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-nx-navy-elevated rounded-xl">
              <Truck className="w-5 h-5 text-nx-warning-400" />
              <span className="text-nx-mist flex-1">تأمین‌کنندگان فعال</span>
              <span className="text-white font-bold text-lg">{summary.suppliers_count}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
