import { useEffect, useMemo, useState } from 'react'
import api from '../../api/client'
import { useToast } from '../../components/Toast'
import { CARD, num, rial, type AgingBucketKey, type AgingReport, type Payer } from './shared'
import { Gauge } from 'lucide-react'

const AGING_COLUMNS: { key: AgingBucketKey; label: string }[] = [
  { key: 'd0_30', label: '۰ تا ۳۰ روز' },
  { key: 'd31_60', label: '۳۱ تا ۶۰ روز' },
  { key: 'd61_90', label: '۶۱ تا ۹۰ روز' },
  { key: 'd90_plus', label: 'بیش از ۹۰ روز' },
]

/**
 * Performance is a three-figure ledger per company: what they owe, what they
 * have paid and the remaining balance. Invoices, manual debts, payments and
 * credits are only the inputs; their breakdown lives on the dashboard.
 */
export default function BillingPerformancePage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<Payer[]>([])
  const [aging, setAging] = useState<AgingReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/billing/payers/'), api.get('/billing/aging/')])
      .then(([payers, report]) => {
        setRows(payers.data)
        setAging(report.data)
      })
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
            debt: acc.debt + b.invoices + b.manual_debts,
            credit: acc.credit + b.payments + b.credits,
            balance: acc.balance + b.balance,
          }
        },
        { debt: 0, credit: 0, balance: 0 }
      ),
    [rows]
  )

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Gauge className="w-5 h-5 text-nx-blue" />
        <div>
          <h1 className="text-lg font-bold text-white">عملکرد</h1>
          <p className="text-xs text-nx-mist">بدهکاری، بستانکاری و ماندهٔ هر شرکت</p>
        </div>
      </div>

      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-nx-navy text-nx-mist text-xs">
            <tr>
              <th className="text-right font-medium px-4 py-3">کد</th>
              <th className="text-right font-medium px-4 py-3">شرکت</th>
              <th className="text-left font-medium px-4 py-3">بدهکاری</th>
              <th className="text-left font-medium px-4 py-3">بستانکاری</th>
              <th className="text-left font-medium px-4 py-3">مانده</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="py-8 text-center text-xs text-nx-mist">در حال بارگذاری…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-xs text-nx-mist">شرکتی ثبت نشده است.</td></tr>
            )}
            {rows.map((row) => {
              const b = row.balance || { invoices: 0, manual_debts: 0, payments: 0, credits: 0, balance: 0 }
              const debt = b.invoices + b.manual_debts
              const credit = b.payments + b.credits
              return (
                <tr key={row.code} className="border-t border-nx-navy-border hover:bg-nx-navy/40">
                  <td className="px-4 py-3 text-nx-mist">{row.code}</td>
                  <td className="px-4 py-3 text-white">
                    {row.name}
                    {row.parent_name && <span className="text-[10px] text-nx-mist/70"> ({row.parent_name})</span>}
                  </td>
                  <td className="px-4 py-3 text-left text-rose-400">{rial(debt)}</td>
                  <td className="px-4 py-3 text-left text-emerald-400">{rial(credit)}</td>
                  <td className={`px-4 py-3 text-left font-bold ${b.balance > 0 ? 'text-rose-400' : b.balance < 0 ? 'text-emerald-400' : 'text-white'}`}>
                    {rial(b.balance)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-nx-navy">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-xs text-nx-mist">جمع ({num(rows.length)} شرکت)</td>
              <td className="px-4 py-3 text-left text-white">{rial(totals.debt)}</td>
              <td className="px-4 py-3 text-left text-white">{rial(totals.credit)}</td>
              <td className="px-4 py-3 text-left font-bold text-white">{rial(totals.balance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className={`${CARD} overflow-x-auto`}>
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-bold text-white">سابقهٔ مطالبات</h2>
          <p className="text-xs text-nx-mist">
            صورتحساب‌های باز به تفکیک عمر (پرداخت‌ها به ترتیب از قدیمی‌ترین فاکتور کسر شده‌اند)
          </p>
        </div>
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-nx-navy text-nx-mist text-xs">
            <tr>
              <th className="text-right font-medium px-4 py-3">کد</th>
              <th className="text-right font-medium px-4 py-3">شرکت</th>
              {AGING_COLUMNS.map((column) => (
                <th key={column.key} className="text-left font-medium px-4 py-3">
                  {column.label}
                </th>
              ))}
              <th className="text-left font-medium px-4 py-3">جمع باز</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-8 text-center text-xs text-nx-mist">در حال بارگذاری…</td></tr>}
            {!loading && (!aging || aging.rows.length === 0) && (
              <tr><td colSpan={7} className="py-8 text-center text-xs text-nx-mist">مطالبهٔ بازی وجود ندارد.</td></tr>
            )}
            {(aging?.rows || []).map((row) => (
              <tr key={row.payer_code} className="border-t border-nx-navy-border hover:bg-nx-navy/40">
                <td className="px-4 py-3 text-nx-mist">{row.payer_code}</td>
                <td className="px-4 py-3 text-white">{row.payer_name}</td>
                {AGING_COLUMNS.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 text-left ${column.key === 'd90_plus' && row[column.key] > 0 ? 'text-rose-400' : 'text-white'}`}
                  >
                    {rial(row[column.key])}
                  </td>
                ))}
                <td className="px-4 py-3 text-left font-bold text-white">{rial(row.total_open)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-nx-navy">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-xs text-nx-mist">
                جمع ({num(aging?.rows.length || 0)} شرکت)
              </td>
              {AGING_COLUMNS.map((column) => (
                <td key={column.key} className="px-4 py-3 text-left text-white">
                  {rial(aging?.totals[column.key] || 0)}
                </td>
              ))}
              <td className="px-4 py-3 text-left font-bold text-white">{rial(aging?.totals.total_open || 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
