import { describe, it, expect, beforeEach } from 'vitest'
import { isNationalDayHoliday } from './nationalDay'

const store = {}
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: (k) => { delete store[k] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) }
}
globalThis.localStorage = mockLocalStorage

describe('National Day Holiday Detection (Oct 1 - Oct 7)', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
  })

  it('returns true on Oct 1', () => {
    expect(isNationalDayHoliday(new Date('2026-10-01T10:00:00'))).toBe(true)
  })

  it('returns true on Oct 2 (current date)', () => {
    expect(isNationalDayHoliday(new Date('2026-10-02T12:00:00'))).toBe(true)
  })

  it('returns true on Oct 7 (last day of holiday)', () => {
    expect(isNationalDayHoliday(new Date('2026-10-07T23:59:59'))).toBe(true)
  })

  it('returns false on Sept 30 (day before holiday)', () => {
    expect(isNationalDayHoliday(new Date('2026-09-30T23:59:59'))).toBe(false)
  })

  it('returns false on Oct 8 (day after holiday, auto recovery)', () => {
    expect(isNationalDayHoliday(new Date('2026-10-08T00:00:00'))).toBe(false)
  })

  it('returns true for future years Oct 1 - Oct 7 (e.g. 2027, 2028)', () => {
    expect(isNationalDayHoliday(new Date('2027-10-01T08:00:00'))).toBe(true)
    expect(isNationalDayHoliday(new Date('2028-10-05T15:00:00'))).toBe(true)
  })

  it('returns false in demo mode because demo date is frozen to 2026-09-10', () => {
    localStorage.setItem('labhub_force_demo', '1')
    expect(isNationalDayHoliday()).toBe(false)
    localStorage.removeItem('labhub_force_demo')
  })

  it('supports explicit force override via localStorage', () => {
    localStorage.setItem('labhub_force_national_day', '1')
    expect(isNationalDayHoliday()).toBe(true)
    localStorage.removeItem('labhub_force_national_day')
  })

  it('returns false for other months or invalid input', () => {
    expect(isNationalDayHoliday(new Date('2026-05-01'))).toBe(false)
    expect(isNationalDayHoliday(null)).toBe(false)
    expect(isNationalDayHoliday('invalid')).toBe(false)
  })
})
