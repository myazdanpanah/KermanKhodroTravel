/**
 * Shared Jalali date input for the whole app.
 *
 * `PersianDatePicker` from `@seydanloo/persian-calendar` handles RTL layout,
 * keyboard navigation, holidays and mobile behaviour; this wrapper only keeps
 * the form contract in ISO Gregorian (what the API stores).
 */
import { PersianDatePicker } from '@seydanloo/persian-calendar'
import { isoToJalali, jalaliToIso, type JalaliDate } from '../lib/jalali'

export interface JalaliDateInputProps {
  /** ISO Gregorian value ('YYYY-MM-DD'); '' for empty. */
  value: string
  /** Receives an ISO Gregorian date, or '' when cleared. */
  onChange: (iso: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  /** ISO bounds. */
  minIso?: string
  maxIso?: string
  id?: string
  className?: string
}

export default function JalaliDateInput({
  value,
  onChange,
  label,
  placeholder = 'انتخاب تاریخ',
  disabled = false,
  minIso,
  maxIso,
  id,
  className,
}: JalaliDateInputProps) {
  const jalaliValue = isoToJalali(value)
  const minDate = isoToJalali(minIso) ?? undefined
  const maxDate = isoToJalali(maxIso) ?? undefined

  return (
    <PersianDatePicker
      id={id}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      value={jalaliValue}
      minDate={minDate}
      maxDate={maxDate}
      className={className}
      onChange={(date: JalaliDate) => onChange(jalaliToIso(date))}
    />
  )
}
