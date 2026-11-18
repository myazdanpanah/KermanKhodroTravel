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
}

export const num = (value: number | undefined | null) =>
  Number(value || 0).toLocaleString('fa-IR')

export const rial = (value: number | undefined | null) => `${num(value)} ریال`

export const INPUT =
  'w-full px-3 py-2.5 rounded-xl border border-nx-navy-border bg-nx-navy-elevated text-white placeholder:text-nx-mist/45 text-sm focus:ring-2 focus:ring-nx-blue focus:border-nx-blue outline-none transition'

// `dark-surface` keeps muted copy light inside these always-navy cards.
export const CARD = 'dark-surface rounded-xl border border-nx-navy-border bg-nx-navy-elevated'
