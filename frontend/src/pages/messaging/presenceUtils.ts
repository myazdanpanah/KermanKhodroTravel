/**
 * Presence formatting utilities for Nexivo Orbit Messaging.
 */

export function toPersianDigits(str: string | number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return String(str).replace(/[0-9]/g, (d) => persianDigits[parseInt(d, 10)])
}

export function formatLastSeen(lastSeenAt?: string | null, isOnline?: boolean | null): string {
  if (isOnline) {
    return 'آنلاین'
  }
  if (!lastSeenAt) {
    return 'آفلاین'
  }

  const date = new Date(lastSeenAt)
  if (isNaN(date.getTime())) {
    return 'آفلاین'
  }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSec < 60) {
    return 'آخرین بازدید: چند لحظه پیش'
  }
  if (diffMin < 60) {
    return `آخرین بازدید: ${toPersianDigits(diffMin)} دقیقه پیش`
  }

  const hoursStr = String(date.getHours()).padStart(2, '0')
  const minutesStr = String(date.getMinutes()).padStart(2, '0')
  const timeFormatted = toPersianDigits(`${hoursStr}:${minutesStr}`)

  const isToday =
    now.getDate() === date.getDate() &&
    now.getMonth() === date.getMonth() &&
    now.getFullYear() === date.getFullYear()

  if (isToday) {
    return `آخرین بازدید: امروز ساعت ${timeFormatted}`
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    yesterday.getDate() === date.getDate() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getFullYear() === date.getFullYear()

  if (isYesterday) {
    return `آخرین بازدید: دیروز ساعت ${timeFormatted}`
  }

  if (diffDays < 7) {
    return `آخرین بازدید: ${toPersianDigits(diffDays)} روز پیش`
  }

  // Fallback to Jalali date
  try {
    const formattedDate = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(date)
    return `آخرین بازدید: ${formattedDate}`
  } catch {
    return `آخرین بازدید: ${date.toLocaleDateString('fa-IR')}`
  }
}

/**
 * Formats a message timestamp into Persian time: "۱۴:۳۵"
 */
export function formatMessageTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return toPersianDigits(`${h}:${m}`)
  } catch {
    return ''
  }
}

/**
 * Returns a human-friendly Jalali date label for chat history day separators:
 * - "امروز"
 * - "دیروز"
 * - "یکشنبه، ۲ آذر ۱۴۰۵"
 */
export function getMessageDateDivider(isoString: string): string {
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return ''
    const now = new Date()

    const isToday =
      now.getDate() === date.getDate() &&
      now.getMonth() === date.getMonth() &&
      now.getFullYear() === date.getFullYear()
    if (isToday) return 'امروز'

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday =
      yesterday.getDate() === date.getDate() &&
      yesterday.getMonth() === date.getMonth() &&
      yesterday.getFullYear() === date.getFullYear()
    if (isYesterday) return 'دیروز'

    return new Intl.DateTimeFormat('fa-IR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
  } catch {
    return ''
  }
}

/**
 * Formats conversation last message time:
 * - If today: "۱۴:۳۰"
 * - If yesterday: "دیروز"
 * - If this year: "۲ آذر"
 * - Older: "۱۴۰۵/۰۹/۰۲"
 */
export function formatConversationTime(isoString: string | null): string {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return ''
    const now = new Date()

    const isToday =
      now.getDate() === date.getDate() &&
      now.getMonth() === date.getMonth() &&
      now.getFullYear() === date.getFullYear()
    if (isToday) {
      const h = String(date.getHours()).padStart(2, '0')
      const m = String(date.getMinutes()).padStart(2, '0')
      return toPersianDigits(`${h}:${m}`)
    }

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday =
      yesterday.getDate() === date.getDate() &&
      yesterday.getMonth() === date.getMonth() &&
      yesterday.getFullYear() === date.getFullYear()
    if (isYesterday) return 'دیروز'

    if (now.getFullYear() === date.getFullYear()) {
      return new Intl.DateTimeFormat('fa-IR', {
        day: 'numeric',
        month: 'short',
      }).format(date)
    }

    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(date)
  } catch {
    return ''
  }
}

/**
 * Full Jalali timestamp for tooltip/hover: e.g. "۲ آذر ۱۴۰۵ ساعت ۱۴:۳۰:۴۵"
 */
export function formatFullJalaliDateTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    const datePart = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d)
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    const s = String(d.getSeconds()).padStart(2, '0')
    return `${datePart} ساعت ${toPersianDigits(`${h}:${m}:${s}`)}`
  } catch {
    return ''
  }
}
