import { describe, it, expect } from 'vitest'
import { isSeminarCompleted, effectiveSeminarStatus, statusLabel, filterSeminars, nextSeminar } from './schedule'

describe('seminar completion and statusLabel behavior', () => {
  const basePast = {
    id: 101,
    date: '2026-01-10',
    time: '14:30',
    status: 'upcoming',
    presenter_name: '张三',
    topic: '引力波透镜效应研究'
  }
  const baseToday = {
    id: 102,
    date: '2026-05-20',
    time: '15:00',
    status: 'upcoming',
    presenter_name: '李四',
    topic: '宇宙大尺度结构'
  }
  const baseFuture = {
    id: 103,
    date: '2026-08-15',
    time: '14:30',
    status: 'upcoming',
    presenter_name: '王五',
    topic: '活动星系核反馈'
  }
  const baseManualCompleted = {
    id: 104,
    date: '2026-08-20',
    time: '14:30',
    status: 'completed',
    presenter_name: '赵六',
    topic: '星系团演化'
  }
  const baseCancelled = {
    id: 105,
    date: '2026-01-05',
    time: '14:30',
    status: 'cancelled',
    presenter_name: '钱七',
    topic: '已取消的报告'
  }

  // 基准测试时间：2026-05-20（北京时间 14:00）
  const testNow = Date.parse('2026-05-20T14:00:00+08:00')

  it('identifies completed status accurately based on date passing', () => {
    // 过去的组会（当天过去后）自动完成
    expect(isSeminarCompleted(basePast, testNow)).toBe(true)
    expect(effectiveSeminarStatus(basePast, testNow)).toBe('completed')
    expect(statusLabel(basePast, testNow)).toBe('已完成')

    // 当天的组会尚未过去，仍为待举行
    expect(isSeminarCompleted(baseToday, testNow)).toBe(false)
    expect(effectiveSeminarStatus(baseToday, testNow)).toBe('upcoming')
    expect(statusLabel(baseToday, testNow)).toBe('待举行')

    // 未来的组会为待举行
    expect(isSeminarCompleted(baseFuture, testNow)).toBe(false)
    expect(effectiveSeminarStatus(baseFuture, testNow)).toBe('upcoming')
    expect(statusLabel(baseFuture, testNow)).toBe('待举行')

    // 手动标记完成的组会无论日期均返回已完成
    expect(isSeminarCompleted(baseManualCompleted, testNow)).toBe(true)
    expect(effectiveSeminarStatus(baseManualCompleted, testNow)).toBe('completed')
    expect(statusLabel(baseManualCompleted, testNow)).toBe('已完成')

    // 已取消的组会优先显示已取消，不因过去日期变为已完成
    expect(isSeminarCompleted(baseCancelled, testNow)).toBe(false)
    expect(effectiveSeminarStatus(baseCancelled, testNow)).toBe('cancelled')
    expect(statusLabel(baseCancelled, testNow)).toBe('已取消')
  })

  it('never outputs 待补纪要 tag', () => {
    // 即使组会已经过去很久，也绝不输出待补纪要
    const labels = [
      statusLabel(basePast, testNow),
      statusLabel(baseToday, testNow),
      statusLabel(baseFuture, testNow),
      statusLabel(baseManualCompleted, testNow),
      statusLabel(baseCancelled, testNow),
      statusLabel({ date: '2020-01-01', status: 'upcoming' }, testNow)
    ]
    for (const label of labels) {
      expect(label).not.toBe('待补纪要')
    }
  })

  it('filters seminars according to effective completion status', () => {
    const list = [basePast, baseToday, baseFuture, baseManualCompleted, baseCancelled]

    // 过滤待举行：过去的组会已自动完成，待举行中仅包含今天和未来的
    const upcomingList = filterSeminars(list, 'upcoming', '', testNow)
    expect(upcomingList.map(s => s.id)).toEqual([102, 103])

    // 过滤已完成：过去的组会及手动完成的组会均包含在内
    const completedList = filterSeminars(list, 'completed', '', testNow)
    expect(completedList.map(s => s.id)).toEqual([101, 104])

    // 全部：按日期正确排序
    const allList = filterSeminars(list, 'all', '', testNow)
    expect(allList.map(s => s.id)).toEqual([105, 101, 102, 103, 104])
  })

  it('picks the correct next seminar without selecting past ones', () => {
    const list = [basePast, baseToday, baseFuture]
    // 当天 14:00 时，当天 15:00 的组会是下一场组会
    expect(nextSeminar(list, testNow)?.id).toBe(102)

    // 当天组会结束后（例如 2026-05-20 18:00），下一场为未来的组会
    const laterSameDay = Date.parse('2026-05-20T18:00:00+08:00')
    expect(nextSeminar(list, laterSameDay)?.id).toBe(103)
  })
})
