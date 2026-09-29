import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { useNoticeScanState } from './useNoticeScanState'
import { normalizeNoticeTitle } from '../utils/noticeValidity'

describe('useNoticeScanState and Notices Batch SQL Suite', () => {
  const state = useNoticeScanState()

  beforeEach(() => {
    state.resetNoticeScan()
  })

  it('verifies notices.ts SQL INSERT statements have exactly 12 parameter placeholders for 12 columns', () => {
    const noticesTs = readFileSync(resolve(__dirname, '../../functions/api/routes/notices.ts'), 'utf-8')

    // Single insert query regex
    const singleInsertRegex = /INSERT INTO notices\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)/g
    const matches = [...noticesTs.matchAll(singleInsertRegex)]
    expect(matches.length).toBeGreaterThanOrEqual(2)

    for (const match of matches) {
      const columns = match[1]
        .split(',')
        .map(c => c.trim())
        .filter(c => c && c !== 'created_at' && c !== 'updated_at')
      
      const valuesPart = match[2]
      const questionMarks = valuesPart.split(',').filter(p => p.trim() === '?')

      // Exactly 12 columns bound via ?, plus created_at and updated_at handled via datetime('now')
      expect(columns.length).toBe(12)
      expect(questionMarks.length).toBe(12)
    }

    // Verify errorCount is tracked and returned in /batch response
    expect(noticesTs).toContain('let errorCount = 0;')
    expect(noticesTs).toContain('error_count: errorCount')
  })

  it('normalizes notice titles correctly removing common prefix brackets and punctuation', () => {
    expect(normalizeNoticeTitle('【重要通知】2026年度研究生国家奖学金评选申请通知'))
      .toBe('2026年度研究生国家奖学金评选申请通知')
    expect(normalizeNoticeTitle('[教务通知] 关于落实天文学专业研究生学术报告与学术交流学分要求的通知'))
      .toBe('关于落实天文学专业研究生学术报告与学术交流学分要求的通知')
    expect(normalizeNoticeTitle('2026年国庆放假调休安排：9月20日上周二课、10月10日上周三课'))
      .toBe('2026年国庆放假调休安排9月20日上周二课10月10日上周三课')
  })

  it('manages modal visibility and selection state reactively', () => {
    state.openNoticeScanModal()
    expect(state.showNoticeScanModal.value).toBe(true)

    state.closeNoticeScanModal()
    expect(state.showNoticeScanModal.value).toBe(false)

    state.noticeScanCandidates.value = [
      { title: 'Notice 1', isDuplicate: false },
      { title: 'Notice 2', isDuplicate: true },
      { title: 'Notice 3', isDuplicate: false }
    ]

    state.selectAllCandidates()
    expect(state.noticeScanSelectedIndices.value.has(0)).toBe(true)
    expect(state.noticeScanSelectedIndices.value.has(1)).toBe(false) // duplicate skipped
    expect(state.noticeScanSelectedIndices.value.has(2)).toBe(true)
    expect(state.noticeScanSelectedIndices.value.size).toBe(2)

    state.toggleSelectCandidate(0)
    expect(state.noticeScanSelectedIndices.value.has(0)).toBe(false)

    state.deselectAllCandidates()
    expect(state.noticeScanSelectedIndices.value.size).toBe(0)
  })

  it('handles background scan cancellation gracefully', () => {
    state.isNoticeScanning.value = true
    state.cancelNoticeScan()
    expect(state.isNoticeScanning.value).toBe(false)
    expect(state.noticeScanProgress.value).toBe('已停止后台扫描。')
  })
})
