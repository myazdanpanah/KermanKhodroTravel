import { useState, useEffect } from 'react'
import {
  X,
  Receipt,
  Download,
  Calendar,
  Building2,
  Tag,
  Printer,
  FileText,
  Layers,
} from 'lucide-react'
import api from '../api/client'
import { useToast } from './Toast'

export interface InvoiceItemDetail {
  id: number
  service_type?: string
  passenger_name?: string
  destination?: string
  hotel_name?: string
  ticket_number?: string
  room_type?: string
  contract_number?: string
  guest_count?: number
  item_date?: string
  description?: string
  debt_amount?: number
  credit_amount?: number
  amount?: number
}

export interface InvoiceFullDetail {
  id: number | string
  letter_number: string
  payer: string
  payer_code: string
  invoice_type: string
  amount: number
  issue_date?: string
  issue_date_jalali?: string
  period_range?: string
  description?: string
  items_count?: number
  items?: InvoiceItemDetail[]
  pdf_url?: string
  letter_url?: string
}

interface InvoiceDetailModalProps {
  invoiceIdOrCode: string | number
  onClose: () => void
  initialData?: Partial<InvoiceFullDetail>
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

export default function InvoiceDetailModal({
  invoiceIdOrCode,
  onClose,
  initialData,
}: InvoiceDetailModalProps) {
  const [data, setData] = useState<InvoiceFullDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    let active = true

    const fetchDetail = async () => {
      setLoading(true)
      try {
        // Try preview entity endpoint first
        let res
        try {
          res = await api.get(`/messaging/entities/preview/invoice/${invoiceIdOrCode}/`)
        } catch {
          // Fallback to billing invoice endpoint if ID is numeric
          if (!isNaN(Number(invoiceIdOrCode))) {
            res = await api.get(`/billing/invoices/${invoiceIdOrCode}/`)
          }
        }

        if (active && res?.data) {
          setData(res.data)
        }
      } catch {
        if (active && initialData) {
          setData(initialData as InvoiceFullDetail)
        } else {
          toast('خطا در دریافت جزئیات صورت‌حساب', 'error')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    if (invoiceIdOrCode) {
      fetchDetail()
    }

    return () => {
      active = false
    }
  }, [invoiceIdOrCode, initialData, toast])

  const invoice = data || (initialData as InvoiceFullDetail)

  const downloadPdf = async () => {
    if (!invoice?.id) return
    try {
      const endpoint = `/billing/invoices/${invoice.id}/download-pdf/`
      const res = await api.get(endpoint, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `صورت‌حساب_${invoice.invoice_type || 'مالی'}_${String(invoice.letter_number).replace(/\//g, '-')}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast('صورت‌حساب PDF دانلود شد', 'success')
    } catch {
      toast('دانلود صورت‌حساب ناموفق بود', 'error')
    }
  }

  const downloadLetter = async () => {
    if (!invoice?.id) return
    try {
      const endpoint = `/billing/invoices/${invoice.id}/download-letter/`
      const res = await api.get(endpoint, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `نامه_رسمی_${invoice.invoice_type || 'مالی'}_${String(invoice.letter_number).replace(/\//g, '-')}.docx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast('نامه رسمی (Word) دانلود شد', 'success')
    } catch {
      toast('دانلود نامه رسمی ناموفق بود', 'error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 font-sans"
      dir="rtl"
      style={{ fontFamily: 'Vazirmatn, system-ui, sans-serif' }}
    >
      <div
        className="bg-white dark:bg-nx-navy-elevated border border-slate-200 dark:border-nx-navy-border rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 font-sans"
        style={{ fontFamily: 'Vazirmatn, system-ui, sans-serif' }}
      >
        {/* Top Header Card */}
        <div className="bg-gradient-to-l from-emerald-600 via-teal-700 to-slate-900 text-white p-5 shrink-0 flex items-start justify-between relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/20">
                  شناسنامه و کارت صورت‌حساب مالی
                </span>
                <span className="text-xs opacity-90 font-medium" dir="ltr">
                  #{toPersianDigits(invoice?.letter_number || '')}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-1">
                {invoice?.payer || 'صورت‌حساب خدمات'}
              </h2>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition hidden sm:inline-flex"
              title="چاپ کارت"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              title="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/5 rounded-full pointer-events-none" />
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {loading && !invoice ? (
            <div className="py-20 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs">در حال بارگذاری جزئیات صورت‌حساب…</p>
            </div>
          ) : (
            <>
              {/* Key Specifications Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-nx-navy rounded-2xl p-4 border border-slate-200/80 dark:border-nx-navy-border/80 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-400 dark:text-nx-mist text-[11px] flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    شرکت طرف‌حساب:
                  </span>
                  <p className="font-bold text-slate-800 dark:text-white truncate">
                    {invoice?.payer || '—'}
                  </p>
                  {invoice?.payer_code && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      کد: {toPersianDigits(invoice.payer_code)}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 dark:text-nx-mist text-[11px] flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    نوع خدمت:
                  </span>
                  <p className="font-bold text-slate-800 dark:text-white">
                    {invoice?.invoice_type || 'خدمات رفاهی و اقامتی'}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 dark:text-nx-mist text-[11px] flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    تاریخ صدور:
                  </span>
                  <p className="font-bold text-slate-800 dark:text-white">
                    {toPersianDigits(invoice?.issue_date_jalali || invoice?.issue_date || '—')}
                  </p>
                  {invoice?.period_range && (
                    <span className="text-[10px] text-slate-400 block truncate" title={invoice.period_range}>
                      بازه: {toPersianDigits(invoice.period_range)}
                    </span>
                  )}
                </div>

                <div className="space-y-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 p-2.5 rounded-xl">
                  <span className="text-emerald-700 dark:text-emerald-300 text-[10px] font-bold block">
                    مبلغ کل صورت‌حساب:
                  </span>
                  <p className="font-bold text-emerald-800 dark:text-emerald-200 text-sm">
                    {formatRials(invoice?.amount || 0)}
                  </p>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">
                    ({formatTomans(invoice?.amount || 0)})
                  </span>
                </div>
              </div>

              {/* Description if any */}
              {invoice?.description && (
                <div className="bg-slate-50 dark:bg-nx-navy rounded-xl p-3 border border-slate-200 dark:border-nx-navy-border text-xs text-slate-600 dark:text-nx-mist leading-relaxed">
                  <span className="font-bold text-slate-700 dark:text-white block mb-0.5">توضیحات صورت‌حساب:</span>
                  {invoice.description}
                </div>
              )}

              {/* Line Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>ریز اقلام و خدمات ارائه‌شده</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-nx-navy text-slate-600 dark:text-nx-mist font-normal">
                      {invoice?.items?.length || 0} مورد
                    </span>
                  </h3>
                </div>

                {invoice?.items && invoice.items.length > 0 ? (
                  <div className="border border-slate-200 dark:border-nx-navy-border rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto max-h-72">
                      <table className="w-full text-xs text-right divide-y divide-slate-100 dark:divide-nx-navy-border">
                        <thead className="bg-slate-100 dark:bg-nx-navy sticky top-0 text-[11px] font-bold text-slate-600 dark:text-nx-mist">
                          <tr>
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">نام مسافر / مهمان</th>
                            <th className="py-2.5 px-3">مقصد / هتل</th>
                            <th className="py-2.5 px-3">شماره بلیط / اتاق</th>
                            <th className="py-2.5 px-3">تاریخ خدمت</th>
                            <th className="py-2.5 px-3">شرح خدمت</th>
                            <th className="py-2.5 px-3 text-left">مبلغ (ریال)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-nx-navy-border/60 bg-white dark:bg-nx-navy-elevated">
                          {invoice.items.map((it, idx) => (
                            <tr key={it.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                              <td className="py-2.5 px-3 text-slate-400 font-medium">{toPersianDigits(idx + 1)}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-white whitespace-nowrap">
                                {it.passenger_name || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-nx-mist whitespace-nowrap">
                                {it.destination || it.hotel_name || '—'}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-500 text-[11px] whitespace-nowrap" dir="ltr">
                                {it.ticket_number || it.room_type || it.contract_number || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                {toPersianDigits(it.item_date || '—')}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={it.description || ''}>
                                {it.description || it.service_type || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-left font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap" dir="ltr">
                                {toPersianDigits((it.amount || it.debt_amount || 0).toLocaleString())}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 dark:bg-nx-navy font-bold text-slate-700 dark:text-white border-t border-slate-200 dark:border-nx-navy-border">
                          <tr>
                            <td colSpan={6} className="py-2.5 px-3 text-right">جمع کل اقلام:</td>
                            <td className="py-2.5 px-3 text-left font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                              {toPersianDigits((invoice.amount || 0).toLocaleString())} ریال
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-nx-navy rounded-2xl p-6 text-center border border-dashed border-slate-200 dark:border-nx-navy-border">
                    <p className="text-xs text-slate-500 dark:text-nx-mist mb-1">
                      صورت‌حساب به صورت سرجمع ثبت شده یا ریز اقلام آن مستقیماً در فایل ضمیمه (PDF / Word) قابل مشاهده است.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      جهت مشاهده مشخصات تفصیلی، می‌توانید فایل رسمی PDF را با دکمه زیر دانلود فرمایید.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 dark:bg-nx-navy border-t border-slate-200 dark:border-nx-navy-border p-4 shrink-0 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={downloadPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>دانلود فایل PDF رسمی</span>
            </button>
            <button
              onClick={downloadLetter}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-200 dark:bg-nx-navy-elevated border border-slate-300 dark:border-nx-navy-border text-slate-700 dark:text-white rounded-xl text-xs font-semibold hover:bg-slate-300 transition"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>نامه رسمی (Word)</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white transition"
          >
            بستن کارت
          </button>
        </div>
      </div>
    </div>
  )
}
