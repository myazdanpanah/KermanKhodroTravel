/** Shared types and formatting for the KKT billing screens. */

export interface Balance {
  invoices: number
  manual_debts: number
  payments: number
  credits: number
  balance: number
}

export interface Payer {
  code: string
  name: string
  parent: string | null
  parent_name: string | null
  children_count: number
  national_id: string
  economic_code: string
  registration_number: string
  address: string
  postal_code: string
  phone: string
  mobile: string
  email: string
  customer_type: 'legal' | 'individual'
  is_active?: boolean
  balance?: Balance
}

export type AgingBucketKey = 'd0_30' | 'd31_60' | 'd61_90' | 'd90_plus'

export interface AgingBuckets {
  d0_30: number
  d31_60: number
  d61_90: number
  d90_plus: number
}

export interface AgingRow extends AgingBuckets {
  payer_code: string
  payer_name: string
  total_open: number
}

export interface AgingReport {
  as_of: string
  rows: AgingRow[]
  totals: AgingBuckets & { total_open: number }
}

export interface Invoice {
  id: number
  letter_number: string
  payer: string
  payer_code: string
  invoice_type: string
  amount: number
  issue_date: string
  issue_date_jalali: string
  file_path: string
  file_id?: number | null
  pdf_file_id?: number | null
  letter_file_id?: number | null
  items_count?: number
  created_at: string
}

export interface Payment {
  id: number
  payment_code: string
  payer_code: string
  payer_name: string
  payment_date: string
  amount: number
  tracking_number: string
  description: string
  created_at: string
  created_by_name: string
}

export const toPersianDigits = (input: string | number | undefined | null) =>
  String(input ?? '').replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])

export const num = (value: number | undefined | null) =>
  toPersianDigits(Number(value || 0).toLocaleString('en-US'))

export const rial = (value: number | undefined | null) => `${num(value)} ریال`

export const INPUT =
  'w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm focus:ring-2 focus:ring-nx-blue focus:border-nx-blue outline-none transition dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-white dark:placeholder:text-nx-mist/45'

export const CARD =
  'rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-nx-navy-border dark:bg-nx-navy-elevated dark:text-white'
