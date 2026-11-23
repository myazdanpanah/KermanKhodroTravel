import { useState, useEffect } from 'react'
import {
  X,
  CreditCard,
  Calendar,
  Building2,
  Hash,
  CheckCircle2,
} from 'lucide-react'
import api from '../api/client'
import { useToast } from './Toast'

export interface PaymentFullDetail {
  id: number | string
  payer_name: string
  payer_code?: string
  amount: number
  payment_date?: string
  tracking_number?: string
  description?: string
  created_at?: string
}

interface PaymentDetailModalProps {
  paymentIdOrCode: string | number
  onClose: () => void
  initialData?: Partial<PaymentFullDetail>
}

const toPersianDigits = (n: number | string) =>
  String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])

const formatRials = (val: number | string) => {
  const num = Number(val) || 0
  return toPersianDigits(num.toLocaleString('fa-IR')) + ' ریال'
}

const formatTomans = (val: number | string) => {
  const num = Math.floor((Number(val) || 0) / 10)
  return toPersianDigits(num.toLocaleString('fa-IR')) + ' تومان'
}

export default function PaymentDetailModal({
  paymentIdOrCode,
  onClose,
  initialData,
}: PaymentDetailModalProps) {
  const [data, setData] = useState<PaymentFullDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    let active = true

    const fetchDetail = async () => {
      setLoading(true)
      try {
        let res
        try {
          res = await api.get(`/messaging/entities/preview/payment/${paymentIdOrCode}/`)
        } catch {
          if (!isNaN(Number(paymentIdOrCode))) {
            res = await api.get(`/billing/payments/${paymentIdOrCode}/`)
          }
        }
        if (active && res?.data) {
          setData(res.data)
        }
      } catch {
        if (active && initialData) {
          setData(initialData as PaymentFullDetail)
        } else {
          toast('خطا در دریافت جزئیات پرداخت مالی', 'error')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    if (paymentIdOrCode) {
      fetchDetail()
    }

    return () => {
      active = false
    }
  }, [paymentIdOrCode, initialData, toast])

  const payment = data || (initialData as PaymentFullDetail)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans"
      dir="rtl"
      style={{ fontFamily: 'Vazirmatn, system-ui, sans-serif' }}
    >
      <div
        className="bg-white dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border rounded-3xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 font-sans"
        style={{ fontFamily: 'Vazirmatn, system-ui, sans-serif' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-sky-600 via-blue-700 to-indigo-900 text-white p-5 flex items-start justify-between relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/20">
                رسید و سند پرداخت مالی
              </span>
              <h2 className="text-base font-bold text-white mt-1">
                {payment?.payer_name || 'سند تسویه مالی'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition relative z-10"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {loading && !payment ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs">در حال بارگذاری اطلاعات پرداخت…</p>
            </div>
          ) : (
            <>
              {/* Highlight Amount Box */}
              <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-2xl p-4 text-center">
                <span className="text-xs text-sky-700 dark:text-sky-300 font-medium block mb-1">
                  مبلغ واریزی ثبت‌شده:
                </span>
                <p className="text-xl font-bold text-sky-900 dark:text-sky-100">
                  {formatRials(payment?.amount || 0)}
                </p>
                <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold block mt-1">
                  معادل: {formatTomans(payment?.amount || 0)}
                </span>
              </div>

              {/* Detail fields */}
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-nx-navy">
                  <span className="text-slate-400 dark:text-nx-mist flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    پرداخت‌کننده / مشتری:
                  </span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    {payment?.payer_name || '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-nx-navy">
                  <span className="text-slate-400 dark:text-nx-mist flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-slate-500" />
                    کد پیگیری / شماره سند:
                  </span>
                  <span className="font-bold text-slate-800 dark:text-white" dir="ltr">
                    {toPersianDigits(payment?.tracking_number || '—')}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-nx-navy">
                  <span className="text-slate-400 dark:text-nx-mist flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    تاریخ پرداخت:
                  </span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    {toPersianDigits(payment?.payment_date || '—')}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50">
                  <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    وضعیت سند:
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    تأییدشده و ثبت در سیستم مالی
                  </span>
                </div>

                {payment?.description && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-nx-navy border border-slate-200 dark:border-nx-navy-border text-slate-600 dark:text-nx-mist leading-relaxed">
                    <span className="font-bold text-slate-700 dark:text-white block mb-0.5">توضیحات:</span>
                    {payment.description}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-nx-navy border-t border-slate-200 dark:border-nx-navy-border p-3.5 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white transition"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  )
}
