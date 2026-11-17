/**
 * Jalali (Shamsi) date helpers.
 *
 * Conversion comes from `@seydanloo/persian-calendar-core` (the independent
 * date-math package behind the calendar component), so UI and forms share one
 * implementation instead of hand-rolled arithmetic.
 *
 * Convention used across the billing module:
 *   • the API and form state speak ISO Gregorian ('YYYY-MM-DD'),
 *   • the user sees and picks Jalali ('YYYY/MM/DD').
 */
import {
  fromNativeDate,
  normalizeDigits,
  toGregorian,
  toJalali,
  type JalaliDate,
} from '@seydanloo/persian-calendar-core'

export type { JalaliDate }

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})/
const JALALI_RE = /^(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})$/

/** 'YYYY-MM-DD' -> { year, month, day } or null. */
export function isoToJalali(iso?: string | null): JalaliDate | null {
  if (!iso) return null
  const match = ISO_RE.exec(iso.trim())
  if (!match) return null
  const [, y, m, d] = match
  try {
    return toJalali({ year: Number(y), month: Number(m), day: Number(d) })
  } catch {
    return null
  }
}

/** { year, month, day } -> 'YYYY-MM-DD' (Gregorian, API shape). */
export function jalaliToIso(date?: JalaliDate | null): string {
  if (!date) return ''
  const g = toGregorian(date)
  return `${g.year.toString().padStart(4, '0')}-${g.month.toString().padStart(2, '0')}-${g.day
    .toString()
    .padStart(2, '0')}`
}

/** ISO or Jalali input (typed by a user) -> ISO, or '' when unparsable. */
export function parseDateToIso(value: string): string {
  const text = normalizeDigits((value || '').trim())
  if (!text) return ''
  if (ISO_RE.test(text)) return text.slice(0, 10)
  const match = JALALI_RE.exec(text)
  if (!match) return ''
  const [, y, m, d] = match
  const year = Number(y)
  if (year < 1300 || year > 1500) return ''
  try {
    return jalaliToIso({ year, month: Number(m), day: Number(d) })
  } catch {
    return ''
  }
}

/** ISO -> 'YYYY/MM/DD' Jalali string for display ('' when empty). */
export function formatJalali(iso?: string | null): string {
  const jalali = isoToJalali(iso)
  if (!jalali) return ''
  return `${jalali.year}/${jalali.month.toString().padStart(2, '0')}/${jalali.day
    .toString()
    .padStart(2, '0')}`
}

/** ISO -> '۱۵ فروردین ۱۴۰۴' for headings and summaries. */
export function formatJalaliLong(iso?: string | null): string {
  const jalali = isoToJalali(iso)
  if (!jalali) return ''
  return `${jalali.day} ${JALALI_MONTHS[jalali.month - 1]} ${jalali.year}`
}

/** Today as Jalali. */
export function todayJalali(): JalaliDate {
  return fromNativeDate(new Date())
}

/** Today as ISO (Gregorian) for date defaults. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Two-digit Jalali year used by letter numbering. */
export function jalaliYearTwoDigits(iso?: string | null): string {
  const jalali = isoToJalali(iso) ?? todayJalali()
  return (jalali.year % 100).toString().padStart(2, '0')
}
