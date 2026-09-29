import { describe, it, expect } from 'vitest'
import { isMidAutumnFestival } from './midAutumn'

describe('midAutumn utility', () => {
  it('correctly identifies 2026 Mid-Autumn festival date (2026-09-25)', () => {
    const d = new Date(2026, 8, 25, 12, 0, 0)
    expect(isMidAutumnFestival(d)).toBe(true)
  })

  it('returns false for dates right before and after Mid-Autumn festival', () => {
    const before = new Date(2026, 8, 24, 23, 59, 59)
    const after = new Date(2026, 8, 26, 0, 0, 1)
    expect(isMidAutumnFestival(before)).toBe(false)
    expect(isMidAutumnFestival(after)).toBe(false)
  })

  it('correctly identifies future and past Mid-Autumn festivals', () => {
    expect(isMidAutumnFestival(new Date(2025, 9, 6))).toBe(true)
    expect(isMidAutumnFestival(new Date(2027, 8, 15))).toBe(true)
  })

  it('gracefully handles invalid date objects', () => {
    expect(isMidAutumnFestival(new Date('invalid'))).toBe(false)
    expect(isMidAutumnFestival(null)).toBe(false)
  })
})
