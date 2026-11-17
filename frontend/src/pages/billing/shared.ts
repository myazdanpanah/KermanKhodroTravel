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

export const CARD = 'rounded-xl border border-nx-navy-border bg-nx-navy-elevated'
