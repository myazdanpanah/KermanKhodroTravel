import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { CARD, rial, num, toPersianDigits } from './shared'
import PayerStatementModal from './PayerStatementModal'
import {
  LayoutDashboard, TrendingUp, Wallet, ReceiptText, AlertCircle, PieChart as PieIcon,
  Calendar
} from 'lucide-react'

interface Summary {
  totals: { invoices: number; manual_debts: number; payments: number; credits: number }
  outstanding: number
  per_service: { invoice_type: string; amount: number }[]
  per_payer: { payer_code: string; payer: string; amount: number }[]
  monthly: {
    month?: string
    label?: string
    issue_date: string
    issue_date_jalali: string
    amount: number
    invoiced?: number
    paid?: number
  }[]
  approvals: { status: string; count: number }[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار تأیید',
  approved: 'تأیید شده',
  rejected: 'رد شده',
}

const COLOR_PALETTE = ['#3678F6', '#24C6B2', '#F59E0B', '#8B5CF6', '#EC4899', '#0EA5E9', '#F97316', '#10B981', '#6366F1', '#64748B']

export default function BillingDashboardPage() {
  const { toast } = useToast()
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPayer, setSelectedPayer] = useState<{ code: string; name: string } | null>(null)
  const trendRef = useRef<HTMLDivElement>(null)
  const servicePieRef = useRef<HTMLDivElement>(null)
  const payerPieRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .get('/billing/dashboard/summary/')
      .then((res) => setData(res.data))
      .catch(() => toast('خطا در دریافت خلاصهٔ مالی', 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 1. Process Monthly Trend data: fixed 12-month period for chronological display on the curve
  const filteredMonthly = useMemo(() => {
    if (!data?.monthly) return []
    // The backend provides newest first (up to 12 months); slice 12 and reverse for chronological timeline (left to right)
    return [...data.monthly].slice(0, 12).reverse()
  }, [data?.monthly])

  // 2. Process Services: Top 5 + "سایر خدمات" as the 6th slice
  const processedServices = useMemo(() => {
    if (!data?.per_service) return []
    const list = [...data.per_service]
    if (list.length <= 5) return list

    const top5 = list.slice(0, 5)
    const remainder = list.slice(5).reduce((acc, cur) => acc + (cur.amount || 0), 0)
    if (remainder > 0) {
      top5.push({ invoice_type: 'باقی خدمات', amount: remainder })
    }
    return top5
  }, [data?.per_service])

  // 3. Process Top 10 Debtors (unpaid debt = debts - payments > 0)
  const top10Debtors = useMemo(() => {
    if (!data?.per_payer) return []
    return data.per_payer.slice(0, 10)
  }, [data?.per_payer])

  // Initialize Monthly Trend Area-Stack-Gradient chart with Invoiced & Collected series
  useEffect(() => {
    if (!trendRef.current || filteredMonthly.length === 0) return
    const isDark = document.documentElement.classList.contains('dark')
    const axisColor = isDark ? '#94A3B8' : '#64748B'
    const splitColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.12)'
    const textColor = isDark ? '#E2E8F0' : '#1E293B'

    const chart = echarts.init(trendRef.current)
    chart.setOption({
      textStyle: { fontFamily: 'Vazirmatn' },
      color: ['#3678F6', '#24C6B2'],
      legend: {
        data: ['صورت‌حساب‌های صادره', 'دریافت‌ها (وصول‌شده)'],
        top: 0,
        textStyle: { color: textColor, fontFamily: 'Vazirmatn', fontSize: 11 },
      },
      tooltip: {
        trigger: 'axis',
        textStyle: { fontFamily: 'Vazirmatn' },
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#3678F6',
            fontFamily: 'Vazirmatn',
            formatter: (p: any) => toPersianDigits(p.value),
          },
        },
        formatter: (params: any) => {
          let html = `<div dir="rtl" class="text-xs p-1 leading-5" style="font-family: Vazirmatn, sans-serif;">
            <strong>${params[0]?.name || ''}</strong><br/>`
          params.forEach((item: any) => {
            const dot = `<span style="display:inline-block;margin-left:5px;border-radius:10px;width:9px;height:9px;background-color:${item.color};"></span>`
            html += `${dot} ${item.seriesName}: <span class="font-bold" style="color:${item.color}">${num(item.value)} ریال</span><br/>`
          })
          html += `</div>`
          return html
        },
      },
      grid: {
        left: 16,
        right: 20,
        top: 36,
        bottom: 24,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: filteredMonthly.map((m) => toPersianDigits(m.label || m.issue_date_jalali || m.month)),
        axisLine: { lineStyle: { color: splitColor } },
        axisLabel: {
          color: axisColor,
          fontFamily: 'Vazirmatn',
          fontSize: 11,
          formatter: (val: string) => toPersianDigits(val),
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: axisColor,
          fontFamily: 'Vazirmatn',
          formatter: (val: number) => num(val),
        },
        splitLine: { lineStyle: { color: splitColor } },
      },
      series: [
        {
          name: 'صورت‌حساب‌های صادره',
          type: 'line',
          smooth: true,
          lineStyle: { width: 3, color: '#3678F6' },
          showSymbol: false,
          areaStyle: {
            opacity: 0.8,
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(54, 120, 246, 0.65)' },
              { offset: 1, color: 'rgba(54, 120, 246, 0.04)' },
            ]),
          },
          emphasis: { focus: 'series' },
          data: filteredMonthly.map((m) => m.invoiced ?? m.amount ?? 0),
        },
        {
          name: 'دریافت‌ها (وصول‌شده)',
          type: 'line',
          smooth: true,
          lineStyle: { width: 3, color: '#24C6B2' },
          showSymbol: false,
          areaStyle: {
            opacity: 0.8,
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(36, 198, 178, 0.65)' },
              { offset: 1, color: 'rgba(36, 198, 178, 0.04)' },
            ]),
          },
          emphasis: { focus: 'series' },
          data: filteredMonthly.map((m) => m.paid ?? 0),
        },
      ],
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
    }
  }, [filteredMonthly])

  // Initialize Service Breakdown Pie (pie-padAngle)
  useEffect(() => {
    if (!servicePieRef.current || processedServices.length === 0) return
    const isDark = document.documentElement.classList.contains('dark')
    const textColor = isDark ? '#E2E8F0' : '#1E293B'

    const chart = echarts.init(servicePieRef.current)
    chart.setOption({
      textStyle: { fontFamily: 'Vazirmatn' },
      tooltip: {
        trigger: 'item',
        textStyle: { fontFamily: 'Vazirmatn' },
        formatter: (params: any) => {
          return `<div dir="rtl" class="text-xs p-1 leading-5" style="font-family: Vazirmatn, sans-serif;">
            <strong>${params.name}</strong><br/>
            مبلغ: <span class="font-bold">${num(params.value)} ریال</span><br/>
            سهم: <span class="font-bold text-blue-500">${toPersianDigits(Number(params.percent).toFixed(1))}٪</span>
          </div>`
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: textColor, fontFamily: 'Vazirmatn', fontSize: 11 },
        type: 'scroll',
      },
      color: COLOR_PALETTE,
      series: [
        {
          name: 'تفکیک خدمت',
          type: 'pie',
          radius: ['42%', '70%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: true,
          padAngle: 3,
          itemStyle: {
            borderRadius: 8,
            borderColor: isDark ? '#0F1B2E' : '#FFFFFF',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: (p: any) => `${p.name}: ${toPersianDigits(Number(p.percent).toFixed(0))}٪`,
            color: textColor,
            fontFamily: 'Vazirmatn',
            fontSize: 10,
          },
          emphasis: {
            label: { show: true, fontSize: 12, fontWeight: 'bold' },
          },
          data: processedServices.map((item) => ({
            name: item.invoice_type || 'بدون دسته‌بندی',
            value: item.amount,
            itemStyle:
              item.invoice_type === 'بدون دسته‌بندی'
                ? { color: '#F59E0B' }
                : undefined,
          })),
        },
      ],
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
    }
  }, [processedServices])

  // Initialize Top 10 Debtors Pie (pie-padAngle)
  useEffect(() => {
    if (!payerPieRef.current || top10Debtors.length === 0) return
    const isDark = document.documentElement.classList.contains('dark')
    const textColor = isDark ? '#E2E8F0' : '#1E293B'

    const chart = echarts.init(payerPieRef.current)
    chart.setOption({
      textStyle: { fontFamily: 'Vazirmatn' },
      tooltip: {
        trigger: 'item',
        textStyle: { fontFamily: 'Vazirmatn' },
        formatter: (params: any) => {
          return `<div dir="rtl" class="text-xs p-1 leading-5" style="font-family: Vazirmatn, sans-serif;">
            <strong>${params.name}</strong><br/>
            مانده بدهی پرداخت‌نشده: <span class="font-bold text-rose-500">${num(params.value)} ریال</span><br/>
            سهم از بدهی‌های برتر: <span class="font-bold">${toPersianDigits(Number(params.percent).toFixed(1))}٪</span>
          </div>`
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: textColor, fontFamily: 'Vazirmatn', fontSize: 11 },
        type: 'scroll',
      },
      color: ['#EF4444', '#F97316', '#F59E0B', '#3678F6', '#8B5CF6', '#24C6B2', '#EC4899', '#0EA5E9', '#14B8A6', '#64748B'],
      series: [
        {
          name: '۱۰ بدهکار برتر',
          type: 'pie',
          radius: ['42%', '70%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: true,
          padAngle: 3,
          itemStyle: {
            borderRadius: 8,
            borderColor: isDark ? '#0F1B2E' : '#FFFFFF',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: (p: any) => `${p.name}: ${toPersianDigits(Number(p.percent).toFixed(0))}٪`,
            color: textColor,
            fontFamily: 'Vazirmatn',
            fontSize: 10,
          },
          emphasis: {
            label: { show: true, fontSize: 12, fontWeight: 'bold' },
          },
          data: top10Debtors.map((p) => ({
            name: p.payer,
            value: p.amount,
          })),
        },
      ],
    })

    chart.on('click', (params: any) => {
      const match = top10Debtors.find((p) => p.payer === params.name)
      if (match) {
        setSelectedPayer({ code: match.payer_code, name: match.payer })
      }
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
    }
  }, [top10Debtors])

  if (loading) {
    return <div className="p-10 text-center text-sm text-slate-500 dark:text-nx-mist">در حال بارگذاری داشبورد مالی…</div>
  }
  if (!data) {
    return <div className="p-10 text-center text-sm text-slate-500 dark:text-nx-mist">داده‌ای برای نمایش نیست.</div>
  }

  const cards = [
    { label: 'جمع صورت‌حساب‌ها', value: data.totals.invoices, icon: ReceiptText, color: 'text-nx-blue bg-nx-blue/10' },
    { label: 'جمع پرداخت‌ها', value: data.totals.payments, icon: Wallet, color: 'text-emerald-500 bg-emerald-500/10' },
    { label: 'اعتبار (بستانکاری)', value: data.totals.credits, icon: TrendingUp, color: 'text-amber-500 bg-amber-500/10' },
    { label: 'مانده وصول‌نشده', value: data.outstanding, icon: AlertCircle, color: 'text-rose-500 bg-rose-500/10' },
  ]

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="w-5 h-5 text-nx-blue" />
        <div>
          <h1 className="text-lg font-bold text-nx-navy dark:text-white">داشبورد مالی</h1>
          <p className="text-xs text-slate-500 dark:text-nx-mist">خلاصهٔ شاخص‌های مالی، نمودار روند، تفکیک خدمات و مانده بدهکاران</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`${CARD} p-5 flex items-center gap-3`}>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <span className="text-xs text-slate-500 dark:text-nx-mist">{label}</span>
              <p className="text-lg font-bold text-nx-navy dark:text-white truncate">{rial(value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 1. Monthly Trend: Dual Gradient Area Curves (Invoices & Collections) - Fixed 12-month */}
      <section className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div>
            <h2 className="text-sm font-semibold text-nx-navy dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-nx-blue" />
              روند ماهانه صدور صورت‌حساب‌ها و دریافت‌ها (دوره ۱۲ ماهه)
            </h2>
            <p className="text-xs text-slate-500 dark:text-nx-mist">مقایسه تحلیلی روند صدور فاکتورها و دریافت‌های وصول‌شده در ۱۲ ماه اخیر</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-blue-50 text-nx-blue dark:bg-nx-blue/10 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20">
            <Calendar className="w-3.5 h-3.5" />
            دورهٔ ۱۲ ماهه
          </span>
        </div>
        <div ref={trendRef} className="h-72 w-full mt-2" />
      </section>

      {/* 2. Top 10 Debtors (pie-padAngle) & 3. Services Breakdown (Top 5 + باقی خدمات) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 Debtors Pie Chart */}
        <section className={`${CARD} p-5 flex flex-col`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-nx-navy dark:text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-rose-500" />
              ۱۰ شرکت با بیشترین بدهی پرداخت‌نشده
            </h2>
          </div>
          <div ref={payerPieRef} className="h-72 w-full my-auto" />
          {top10Debtors.length > 0 && (
            <div className="mt-3 border-t border-slate-100 dark:border-nx-navy-border pt-3">
              <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs pl-3.5 pr-2">
                {top10Debtors.map((row, idx) => (
                  <div
                    key={row.payer_code}
                    onClick={() => setSelectedPayer({ code: row.payer_code, name: row.payer })}
                    className="flex justify-between items-center py-1.5 px-2 rounded-lg border-b border-slate-50 dark:border-white/5 hover:bg-slate-100/70 dark:hover:bg-white/5 cursor-pointer transition-colors group"
                    title="مشاهده ریز گردش و کاردکس حساب"
                  >
                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-nx-mist truncate group-hover:text-nx-blue dark:group-hover:text-blue-400 font-medium">
                      <span className="text-[10px] w-4 text-slate-400">{toPersianDigits(idx + 1)}.</span>
                      {row.payer}
                    </span>
                    <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">{rial(row.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Services Breakdown Pie Chart: Top 5 + باقی خدمات */}
        <section className={`${CARD} p-5 flex flex-col`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-nx-navy dark:text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-nx-blue" />
              صورت‌حساب به تفکیک خدمت (۵ خدمت برتر + سایر)
            </h2>
            {processedServices.some((s) => s.invoice_type === 'بدون دسته‌بندی') && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                شامل بدون دسته‌بندی
              </span>
            )}
          </div>
          <div ref={servicePieRef} className="h-72 w-full my-auto" />
          {processedServices.length > 0 && (
            <div className="mt-3 border-t border-slate-100 dark:border-nx-navy-border pt-3">
              <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs pr-1">
                {processedServices.map((row) => (
                  <div key={row.invoice_type} className="flex justify-between items-center py-1 border-b border-slate-50 dark:border-white/5">
                    <span className={`flex items-center gap-1.5 ${
                      row.invoice_type === 'بدون دسته‌بندی'
                        ? 'text-amber-600 dark:text-amber-400 font-semibold'
                        : row.invoice_type === 'باقی خدمات'
                        ? 'text-slate-500 font-medium italic'
                        : 'text-slate-700 dark:text-nx-mist'
                    }`}>
                      {row.invoice_type === 'بدون دسته‌بندی' && <AlertCircle className="w-3.5 h-3.5" />}
                      {row.invoice_type}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">{rial(row.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Issuance Requests Status */}
      <section className={`${CARD} p-5`}>
        <h2 className="text-sm font-semibold text-nx-navy dark:text-white mb-3">وضعیت درخواست‌های صدور</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          {data.approvals.length === 0 && <li className="text-xs text-slate-500 dark:text-nx-mist col-span-3">درخواستی ثبت نشده است.</li>}
          {data.approvals.map((row) => (
            <li key={row.status} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-nx-navy-border">
              <span className="text-slate-600 dark:text-nx-mist">{STATUS_LABELS[row.status] || row.status}</span>
              <span className="font-bold text-nx-navy dark:text-white">{num(row.count)}</span>
            </li>
          ))}
        </ul>
      </section>
      {/* Statement Ledger Modal */}
      {selectedPayer && (
        <PayerStatementModal
          payerCode={selectedPayer.code}
          payerName={selectedPayer.name}
          onClose={() => setSelectedPayer(null)}
        />
      )}
    </div>
  )
}
