/**
 * 判断指定日期（默认当前日期）是否为中秋节（农历八月十五）
 * 支持利用现代原生 Intl.DateTimeFormat('zh-u-ca-chinese') 自动推算任意年份的农历八月十五，
 * 并内置公历对照表作为跨平台降级兜底。
 * @param {Date} [date=new Date()]
 * @returns {boolean}
 */
export function isMidAutumnFestival(date = new Date()) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return false
  }

  // 1. 优先使用浏览器原生的国际化农历引擎精确计算（自动支持 2026 及未来任意年份）
  try {
    const formatter = new Intl.DateTimeFormat('zh-u-ca-chinese', {
      month: 'numeric',
      day: 'numeric'
    })
    const parts = formatter.formatToParts(date)
    const monthPart = parts.find(p => p.type === 'month')?.value || ''
    const dayPart = parts.find(p => p.type === 'day')?.value || ''

    // 农历八月常见格式：'八月'、'8'、'8月'；十五常见格式：'15'、'十五'
    const isEighthMonth = monthPart.includes('8') || monthPart.includes('八')
    const isFifteenthDay = dayPart === '15' || dayPart.includes('十五')

    if (isEighthMonth && isFifteenthDay) {
      return true
    }
  } catch (e) {
    // 降级至预置公历对照表
  }

  // 2. 权威公历对应中秋节日期对照表（作为老旧环境备用兜底）
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const key = `${y}-${m}-${d}`

  const KNOWN_MID_AUTUMN_DATES = new Set([
    '2024-09-17',
    '2025-10-06',
    '2026-09-25', // 2026 年中秋节
    '2027-09-15',
    '2028-10-03',
    '2029-09-22',
    '2030-09-12',
    '2031-10-01',
    '2032-09-19',
    '2033-09-08',
    '2034-09-27',
    '2035-09-16'
  ])

  return KNOWN_MID_AUTUMN_DATES.has(key)
}
