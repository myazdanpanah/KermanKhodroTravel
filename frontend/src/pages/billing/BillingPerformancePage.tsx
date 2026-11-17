import { useEffect, useMemo, useState } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { CARD, num, rial, type Payer } from './shared'
import { Gauge } from 'lucide-react'

export default function BillingPerformancePage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<Payer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/billing/payers/')
      .then((res) => setRows(res.data))
      .catch(() => toast('خطا در دریافت عملکرد شرکت‌ها', 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          const b = row.balance || { invoices: 0, manual_debts: 0, payments: 0, credits: 0, balance: 0 }
          return {
            invoices: acc.invoices + b.invoices,
            manual_debts: acc.manual_debts + b.manual_debts,
            payments: acc.payments + b.payments,
            credits: acc.credits + b.credits,
            balance: acc.balance + b.balance,
          }
        },
        { invoices: 0, manual_debts: 0, payments: 0, credits: 0, balance: 0 }
      ),
    [rows]
  )

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Gauge className="w-5 h-5 text-nx-blue" />
        <div>
          <h1 className="text-lg font-bold text-white">عملکرد</h1>
          <p className="text-xs text-nx-mist">گردش حساب هر شرکت: صورت‌حساب، بدهی دستی، پرداخت و اعتبار</p>
        </div>
      </div>

      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-nx-navy text-nx-mist text-xs">
            <tr>
              <th className="text-right font-medium px-4 py-3">کد</th>
              <th className="text-right font-medium px-4 py-3">شرکت</th>
              <th className="text-left font-medium px-4 py-3">صورت‌حساب</th>
              <th className="text-left font-medium px-4 py-3">بدهی دستی</th>
              <th className="text-left font-medium px-4 py-3">پرداخت</th>
              <th className="text-left font-medium px-4 py-3">اعتبار</th>
              <th className="text-left font-medium px-4 py-3">مانده</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-8 text-center text-xs text-nx-mist">در حال بارگذاری…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-xs text-nx-mist">شرکتی ثبت نشده است.</td></tr>
            )}
            {rows.map((row) => {
              const b = row.balance || { invoices: 0, manual_debts: 0, payments: 0, credits: 0, balance: 0 }
              return (
                <tr key={row.code} className="border-t border-nx-navy-border hover:bg-nx-navy/40">
                  <td className="px-4 py-3 text-nx-mist">{row.code}</td>
                  <td className="px-4 py-3 text-white">
                    {row.name}
                    {row.parent_name && <span className="text-[10px] text-nx-mist/70"> ({row.parent_name})</span>}
                  </td>
                  <td className="px-4 py-3 text-left text-nx-mist">{rial(b.invoices)}</td>
                  <td className="px-4 py-3 text-left text-nx-mist">{rial(b.manual_debts)}</td>
                  <td className="px-4 py-3 text-left text-emerald-400">{rial(b.payments)}</td>
                  <td className="px-4 py-3 text-left text-amber-400">{rial(b.credits)}</td>
                  <td className={`px-4 py-3 text-left font-bold ${b.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {rial(b.balance)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-nx-navy">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-xs text-nx-mist">جمع ({num(rows.length)} شرکت)</td>
              <td className="px-4 py-3 text-left text-white">{rial(totals.invoices)}</td>
              <td className="px-4 py-3 text-left text-white">{rial(totals.manual_debts)}</td>
              <td className="px-4 py-3 text-left text-white">{rial(totals.payments)}</td>
              <td className="px-4 py-3 text-left text-white">{rial(totals.credits)}</td>
              <td className="px-4 py-3 text-left font-bold text-white">{rial(totals.balance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
