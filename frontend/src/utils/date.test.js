import { describe, it, expect } from 'vitest'
import { parseUtcDate, formatCommentTime, formatRecommendDate } from './date'

describe('date utility', () => {
  it('parses SQLite datetime UTC strings correctly', () => {
    const d1 = parseUtcDate('2026-09-12 07:51:30')
    const d2 = parseUtcDate('2026-09-12T07:51:30Z')
    expect(d1).not.toBeNull()
    expect(d2).not.toBeNull()
    expect(d1.getTime()).toBe(d2.getTime())
  })

  it('handles strings with fractional seconds and Z', () => {
    const d = parseUtcDate('2026-09-12T07:51:30.123Z')
    expect(d.getUTCHours()).toBe(7)
    expect(d.getUTCMinutes()).toBe(51)
  })

  it('handles null, undefined and invalid strings safely', () => {
    expect(parseUtcDate(null)).toBeNull()
    expect(parseUtcDate(undefined)).toBeNull()
    expect(parseUtcDate('')).toBeNull()
    expect(parseUtcDate('invalid-date')).toBeNull()
    expect(formatCommentTime(null)).toBe('')
    expect(formatCommentTime('')).toBe('')
    expect(formatRecommendDate(null)).toBe('')
    expect(formatRecommendDate('')).toBe('')
    expect(formatRecommendDate('invalid-date')).toBe('')
  })

  it('formats comment time for today correctly', () => {
    const utcDateStr = '2026-09-12 07:51:30'
    const parsed = parseUtcDate(utcDateStr)
    const expectedHours = String(parsed.getHours()).padStart(2, '0')
    const expectedMins = String(parsed.getMinutes()).padStart(2, '0')
    
    const formatted = formatCommentTime(utcDateStr, parsed)
    expect(formatted).toBe(`${expectedHours}:${expectedMins}`)
  })

  it('formats comment time for previous days correctly', () => {
    const pastStr = '2026-09-10 07:51:30'
    const parsed = parseUtcDate(pastStr)
    const futureDate = new Date(parsed.getTime() + 86400000 * 2)
    
    const formatted = formatCommentTime(pastStr, futureDate)
    const m = parsed.getMonth() + 1
    const day = parsed.getDate()
    const hours = String(parsed.getHours()).padStart(2, '0')
    const mins = String(parsed.getMinutes()).padStart(2, '0')
    expect(formatted).toBe(`${m}/${day} ${hours}:${mins}`)
  })

  it('formats recommendation date for today, yesterday, and past dates', () => {
    // 2026-09-22 06:30:00 UTC is 2026-09-22 14:30 in Asia/Shanghai
    const todayUtc = '2026-09-22 06:30:00'
    const nowDate = new Date('2026-09-22T08:00:00Z')
    expect(formatRecommendDate(todayUtc, nowDate)).toBe('今天 14:30')

    // 2026-09-21 02:15:00 UTC is 2026-09-21 10:15 in Asia/Shanghai
    const yesterdayUtc = '2026-09-21 02:15:00'
    expect(formatRecommendDate(yesterdayUtc, nowDate)).toBe('昨天 10:15')

    // Older date same year
    const pastUtc = '2026-05-10 01:20:00'
    expect(formatRecommendDate(pastUtc, nowDate)).toBe('5月10日 09:20')

    // Previous year
    const lastYearUtc = '2025-11-05 03:00:00'
    expect(formatRecommendDate(lastYearUtc, nowDate)).toBe('2025-11-05 11:00')
  })
})
