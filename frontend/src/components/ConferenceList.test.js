import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

describe('ConferenceList Component and Logic', () => {
  const filePath = path.resolve(__dirname, 'ConferenceList.vue')
  const content = fs.readFileSync(filePath, 'utf8')

  it('compiles SFC template and script cleanly', () => {
    const parsed = parse(content)
    expect(parsed.errors.length).toBe(0)

    const compiledScript = compileScript(parsed.descriptor, { id: 'test-conf-list' })
    const bindings = compiledScript.bindings || {}

    expect(bindings.groupedConferences).toBeDefined()
    expect(bindings.statusFilter).toBeDefined()
    expect(bindings.yearFilter).toBeDefined()
    expect(bindings.searchQuery).toBeDefined()
    expect(bindings.onlyInterested).toBeDefined()
    expect(bindings.getDeadlineStatus).toBeDefined()

    const compiledTemplate = compileTemplate({
      source: parsed.descriptor.template.content,
      id: 'test-conf-list',
      compilerOptions: { bindingMetadata: bindings }
    })
    expect(compiledTemplate.errors.length).toBe(0)
  })

  it('calculates deadline urgency and status correctly', () => {
    // Helper replicating component logic with a fixed reference date (2026-09-18)
    function calcDeadline(conf, refToday = '2026-09-18') {
      const [yRef, mRef, dRef] = refToday.split('-').map(Number)
      const refDateVal = Date.UTC(yRef, mRef - 1, dRef)

      const deadlines = [
        { label: '摘要投递', date: conf.abstract_deadline },
        { label: '早鸟优惠', date: conf.early_bird_deadline },
        { label: '注册报名', date: conf.registration_deadline }
      ].filter(d => Boolean(d.date && d.date.trim()))

      if (deadlines.length === 0) {
        return { text: '截止日期待补充', isUrgent: false, isPassed: false, isMissing: true }
      }

      const pending = []
      for (const d of deadlines) {
        const [y, m, day] = d.date.split('-').map(Number)
        const diff = Math.round((Date.UTC(y, m - 1, day) - refDateVal) / (1000 * 60 * 60 * 24))
        if (diff >= 0) {
          pending.push({ ...d, diff })
        }
      }

      if (pending.length === 0) {
        return { text: '报名已截止', isUrgent: false, isPassed: true, isMissing: false }
      }

      pending.sort((a, b) => a.diff - b.diff)
      const closest = pending[0]
      const isUrgent = closest.diff <= 7
      let text = ''
      if (closest.diff === 0) {
        text = `${closest.label}今天截止`
      } else if (closest.diff === 1) {
        text = `${closest.label}明天截止`
      } else if (isUrgent) {
        text = `${closest.label}仅剩 ${closest.diff} 天`
      } else {
        text = `${closest.label}剩 ${closest.diff} 天`
      }

      return { text, isUrgent, isPassed: false, isMissing: false }
    }

    // Case 1: No deadlines filled
    expect(calcDeadline({}).text).toBe('截止日期待补充')

    // Case 2: Urgent deadline in 3 days
    const urgentConf = { registration_deadline: '2026-09-21' }
    const urgentResult = calcDeadline(urgentConf)
    expect(urgentResult.isUrgent).toBe(true)
    expect(urgentResult.text).toBe('注册报名仅剩 3 天')

    // Case 3: Deadline today
    const todayConf = { abstract_deadline: '2026-09-18' }
    const todayResult = calcDeadline(todayConf)
    expect(todayResult.isUrgent).toBe(true)
    expect(todayResult.text).toBe('摘要投递今天截止')

    // Case 4: Deadline tomorrow
    const tomorrowConf = { early_bird_deadline: '2026-09-19' }
    const tomorrowResult = calcDeadline(tomorrowConf)
    expect(tomorrowResult.isUrgent).toBe(true)
    expect(tomorrowResult.text).toBe('早鸟优惠明天截止')

    // Case 5: All deadlines past
    const pastConf = {
      abstract_deadline: '2026-09-01',
      registration_deadline: '2026-09-15',
      end_date: '2026-09-25'
    }
    const pastResult = calcDeadline(pastConf)
    expect(pastResult.isPassed).toBe(true)
    expect(pastResult.text).toBe('报名已截止')
  })

  it('groups conferences by month properly', () => {
    function groupConferences(talks) {
      const confs = talks.filter(t => t.event_type === 'conference' || (t.end_date && t.end_date !== t.date))
      const map = new Map()
      for (const c of confs) {
        const monthKey = (c.date || '').slice(0, 7) || '未知月份'
        if (!map.has(monthKey)) {
          map.set(monthKey, [])
        }
        map.get(monthKey).push(c)
      }
      return Array.from(map.entries()).map(([month, items]) => ({
        month,
        items: items.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      })).sort((a, b) => a.month.localeCompare(b.month))
    }

    const testTalks = [
      { id: 1, event_type: 'conference', title: '会议 A', date: '2026-09-10', end_date: '2026-09-12' },
      { id: 2, event_type: 'talk', title: '单场报告', date: '2026-09-15' },
      { id: 3, event_type: 'conference', title: '会议 B', date: '2026-09-20', end_date: '2026-09-22' },
      { id: 4, event_type: 'conference', title: '会议 C', date: '2026-10-05', end_date: '2026-10-07' }
    ]

    const groups = groupConferences(testTalks)
    expect(groups.length).toBe(2)
    expect(groups[0].month).toBe('2026-09')
    expect(groups[0].items.length).toBe(2)
    expect(groups[1].items.length).toBe(1)
  })

  it('integrates ThinHoundCheckbox with strict user-select suppression', () => {
    expect(content).toContain('ThinHoundCheckbox')
    expect(content).toContain('v-model="onlyInterested"')
    expect(content).toContain('user-select: none !important')
    expect(content).toContain('-webkit-user-select: none !important')
  })

  it('defaults yearFilter to all and filters from current year to future years', () => {
    expect(content).toContain("const yearFilter = ref('all')")
    expect(content).toContain('<option value="all">全部年份</option>')

    const currentYear = '2026'
    const today = '2026-09-24'

    function filterConferences(conferences, statusFilter = 'upcoming', yearFilter = 'all') {
      let list = [...conferences]
      if (statusFilter === 'upcoming') {
        list = list.filter(c => (c.end_date || c.date) >= today)
      } else if (statusFilter === 'past') {
        list = list.filter(c => (c.end_date || c.date) < today)
      }

      if (yearFilter === 'all') {
        if (statusFilter !== 'past') {
          list = list.filter(c => {
            const startYear = (c.date || '').slice(0, 4)
            const endYear = (c.end_date || '').slice(0, 4)
            return (!startYear && !endYear) || startYear >= currentYear || endYear >= currentYear
          })
        }
      } else {
        list = list.filter(c => (c.date || '').startsWith(yearFilter))
      }
      return list
    }

    const testConfs = [
      { id: 1, title: '2025 会议', date: '2025-10-10', end_date: '2025-10-12' },
      { id: 2, title: '2026 年初会议（已过）', date: '2026-04-10', end_date: '2026-04-12' },
      { id: 3, title: '2026 年底会议', date: '2026-11-15', end_date: '2026-11-18' },
      { id: 4, title: '2027 SJTU 透镜会议', date: '2027-05-18', end_date: '2027-05-22' },
      { id: 5, title: '2028 宇宙学年会', date: '2028-08-01', end_date: '2028-08-05' }
    ]

    // 1. 默认状态（upcoming + all）展示今年及未来全部即将举行的会议（包含 2026 年底、2027、2028）
    const defaultList = filterConferences(testConfs, 'upcoming', 'all')
    expect(defaultList.map(c => c.id)).toEqual([3, 4, 5])

    // 2. 选择“全部会议” + “全部年份”，展示从今年开始到未来全部年份（包含今年已过的 2、今年底 3、2027年 4、2028年 5，排除往年 2025年 1）
    const allList = filterConferences(testConfs, 'all', 'all')
    expect(allList.map(c => c.id)).toEqual([2, 3, 4, 5])

    // 3. 显式选择单一年份 2027 年
    const year2027List = filterConferences(testConfs, 'upcoming', '2027')
    expect(year2027List.map(c => c.id)).toEqual([4])

    // 4. 历史会议下，允许查看包括 2025 在内的往年记录
    const pastList = filterConferences(testConfs, 'past', 'all')
    expect(pastList.map(c => c.id)).toEqual([1, 2])
  })
})
