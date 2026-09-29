/**
 * Safely parse a date string or timestamp from database/API into a local Date object.
 * Handles SQLite UTC strings (e.g. "YYYY-MM-DD HH:mm:ss") by ensuring UTC context.
 * @param {string|number|Date|null|undefined} input
 * @returns {Date|null}
 */
export function parseUtcDate(input) {
  if (!input) return null
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input
  if (typeof input === 'number') {
    const d = new Date(input)
    return isNaN(d.getTime()) ? null : d
  }
  try {
    let s = String(input).trim()
    if (!s) return null
    // If string lacks timezone offset/Z, SQLite returns UTC without indicator
    if (!s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
      s = s.replace(' ', 'T') + 'Z'
    }
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/**
 * Formats comment timestamp into readable local time.
 * If today, returns "HH:mm". Otherwise returns "M/D HH:mm".
 * @param {string|number|Date} isoStr
 * @param {Date} [now]
 * @returns {string}
 */
export function formatCommentTime(isoStr, now = new Date()) {
  if (!isoStr) return ''
  try {
    const d = parseUtcDate(isoStr)
    if (!d) return ''
    const isToday = d.toDateString() === now.toDateString()
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    if (isToday) return `${hours}:${mins}`
    const m = d.getMonth() + 1
    const day = d.getDate()
    return `${m}/${day} ${hours}:${mins}`
  } catch {
    return ''
  }
}

/**
 * Formats a recommendation timestamp into a human-readable string in Asia/Shanghai timezone.
 * Examples:
 * - "今天 14:30"
 * - "昨天 09:15"
 * - "9月12日 16:40"
 * - "2025-09-12 16:40"
 * @param {string|number|Date} isoStr
 * @param {Date} [now]
 * @returns {string}
 */
export function formatRecommendDate(isoStr, now = new Date()) {
  if (!isoStr) return ''
  try {
    const d = parseUtcDate(isoStr)
    if (!d) return ''

    const toDateParts = (date) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(date)
      const map = Object.fromEntries(parts.map(p => [p.type, p.value]))
      return {
        year: map.year,
        month: map.month,
        day: map.day,
        dateStr: `${map.year}-${map.month}-${map.day}`,
        timeStr: `${map.hour}:${map.minute}`
      }
    }

    const dParts = toDateParts(d)
    const nowParts = toDateParts(now)

    if (dParts.dateStr === nowParts.dateStr) {
      return `今天 ${dParts.timeStr}`
    }

    const yesterday = new Date(now.getTime() - 86400000)
    const yesterdayParts = toDateParts(yesterday)
    if (dParts.dateStr === yesterdayParts.dateStr) {
      return `昨天 ${dParts.timeStr}`
    }

    if (dParts.year === nowParts.year) {
      return `${parseInt(dParts.month, 10)}月${parseInt(dParts.day, 10)}日 ${dParts.timeStr}`
    }

    return `${dParts.dateStr} ${dParts.timeStr}`
  } catch {
    return ''
  }
}

