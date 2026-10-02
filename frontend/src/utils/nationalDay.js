import { isDemoMode } from '../mock/isDemo'
import { DEMO_FROZEN_TIME_MS } from './schedule'

/**
 * 判断指定日期（默认当前系统日期，在演示模式下默认为冻结时间 2026-09-10）是否处于国庆节 7 天黄金周期间（10月1日 00:00:00 至 10月7日 23:59:59）
 * 适用于任意年份的 10.01 - 10.07 自动启用特效，节后（10月8日及之后）自动静默恢复。
 * @param {Date} [date]
 * @returns {boolean}
 */
export function isNationalDayHoliday(date) {
  if (date === undefined) {
    if (typeof localStorage !== 'undefined' && (localStorage.getItem('labhub_force_national_day') === '1' || localStorage.getItem('laborbit_force_national_day') === 'true' || localStorage.getItem('laborbit_force_national_day') === '1')) {
      return true
    }
    if (isDemoMode()) {
      date = new Date(DEMO_FROZEN_TIME_MS)
    } else {
      date = new Date()
    }
  }

  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return false
  }

  // 本地月份（0 对应 1 月，9 对应 10 月）与日份（1~31）
  const month = date.getMonth()
  const day = date.getDate()

  return month === 9 && day >= 1 && day <= 7
}

