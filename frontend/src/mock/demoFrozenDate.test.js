import { describe, it, expect, beforeEach } from 'vitest'
import { isDemoMode } from './isDemo'
import { DEMO_BASE_DATE_STR, DEMO_SEMINARS } from './demoData'
import { shanghaiToday, nextSeminar, statusLabel, isSeminarCompleted, DEMO_FROZEN_DATE_STR } from '../utils/schedule'

const store = {}
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: (k) => { delete store[k] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) }
}
globalThis.localStorage = mockLocalStorage

describe('Demo Mode Frozen Date (2026-09-10)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('unfrozen in production / non-demo mode', () => {
    expect(isDemoMode()).toBe(false)
    const today = shanghaiToday()
    // In normal mode, today should be the real current year
    const realYear = new Date().getFullYear().toString()
    expect(today.startsWith(realYear)).toBe(true)
  })

  it('freezes date to 2026-09-10 in demo mode for GitHub Pages showcase', () => {
    localStorage.setItem('labhub_force_demo', '1')
    expect(isDemoMode()).toBe(true)

    expect(DEMO_BASE_DATE_STR).toBe('2026-09-10')
    expect(DEMO_FROZEN_DATE_STR).toBe('2026-09-10')
    expect(shanghaiToday()).toBe('2026-09-10')

    // Seminars status relative to 2026-09-10
    const upcomingSeminar = DEMO_SEMINARS.find(s => s.id === 101) // 2026-09-12
    const pastSeminar = DEMO_SEMINARS.find(s => s.id === 100) // 2026-09-05

    expect(upcomingSeminar.date).toBe('2026-09-12')
    expect(pastSeminar.date).toBe('2026-09-05')

    expect(isSeminarCompleted(upcomingSeminar)).toBe(false)
    expect(statusLabel(upcomingSeminar)).toBe('待举行')

    expect(isSeminarCompleted(pastSeminar)).toBe(true)
    expect(statusLabel(pastSeminar)).toBe('已完成')

    // Next seminar is correctly resolved to the 2026-09-12 session
    const next = nextSeminar(DEMO_SEMINARS)
    expect(next).toBeTruthy()
    expect(next.id).toBe(101)
    expect(next.date).toBe('2026-09-12')
    expect(next.presenter_name).toContain('陈晨')
  })

  it('respects explicitly passed date even in demo mode', () => {
    localStorage.setItem('labhub_force_demo', '1')
    expect(isDemoMode()).toBe(true)

    const specificDate = new Date('2028-05-20T12:00:00+08:00')
    expect(shanghaiToday(specificDate)).toBe('2028-05-20')
  })
})
