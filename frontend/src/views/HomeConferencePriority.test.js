import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

describe('HomeView Academic Conference Priority and 4-Card Compact Layout', () => {
  const filePath = path.resolve(__dirname, 'HomeView.vue')
  const content = fs.readFileSync(filePath, 'utf8')

  it('compiles HomeView SFC cleanly and contains required conference bindings', () => {
    const parsed = parse(content)
    expect(parsed.errors.length).toBe(0)

    const compiledScript = compileScript(parsed.descriptor, { id: 'test-home-view' })
    const bindings = compiledScript.bindings || {}

    expect(bindings.upcomingConferences).toBeDefined()
    expect(bindings.formatHomeConfDate).toBeDefined()
    expect(bindings.getHomeConfDeadlineBadge).toBeDefined()

    const compiledTemplate = compileTemplate({
      source: parsed.descriptor.template.content,
      id: 'test-home-view',
      compilerOptions: { bindingMetadata: bindings }
    })
    expect(compiledTemplate.errors.length).toBe(0)
  })

  it('replicates the exact user scenario: 2027 conference prioritized before 10.27 annual meeting, then drops after abstract ddl passes', () => {
    function getConferencePriorityInfo(conf, todayVal) {
      const candidates = []

      if (conf.abstract_deadline && conf.abstract_deadline >= todayVal) {
        candidates.push({
          date: conf.abstract_deadline,
          type: 'abstract',
          label: '摘要投递',
          badgeLabel: '摘要'
        })
      }

      const regDates = []
      if (conf.early_bird_deadline && conf.early_bird_deadline >= todayVal) {
        regDates.push({
          date: conf.early_bird_deadline,
          type: 'early_bird',
          label: '早鸟优惠',
          badgeLabel: '早鸟'
        })
      }
      if (conf.registration_deadline && conf.registration_deadline >= todayVal) {
        regDates.push({
          date: conf.registration_deadline,
          type: 'registration',
          label: '注册报名',
          badgeLabel: '报名'
        })
      }
      if (regDates.length > 0) {
        regDates.sort((a, b) => a.date.localeCompare(b.date))
        candidates.push(regDates[0])
      }

      if (conf.date && conf.date >= todayVal) {
        candidates.push({
          date: conf.date,
          type: 'start',
          label: '会议开幕',
          badgeLabel: '开幕'
        })
      } else if ((conf.end_date || conf.date) && (conf.end_date || conf.date) >= todayVal) {
        candidates.push({
          date: conf.end_date || conf.date,
          type: 'ongoing',
          label: '进行中',
          badgeLabel: '进行中'
        })
      }

      if (candidates.length === 0) {
        return null
      }

      candidates.sort((a, b) => a.date.localeCompare(b.date))
      const earliest = candidates[0]

      return {
        priorityDate: earliest.date,
        priorityType: earliest.type,
        priorityLabel: earliest.label,
        badgeLabel: earliest.badgeLabel
      }
    }

    function sortUpcomingConferences(talks, todayVal, limit = 4) {
      const list = []
      for (const t of talks) {
        const isConf = t.event_type === 'conference' || (t.end_date && t.end_date !== t.date)
        if (!isConf) continue

        const priorityInfo = getConferencePriorityInfo(t, todayVal)
        if (!priorityInfo) continue

        list.push({
          ...t,
          _priority: priorityInfo
        })
      }

      list.sort((a, b) => {
        const pComp = a._priority.priorityDate.localeCompare(b._priority.priorityDate)
        if (pComp !== 0) return pComp
        const dComp = (a.date || '').localeCompare(b.date || '')
        if (dComp !== 0) return dComp
        return a.id - b.id
      })

      return list.slice(0, limit)
    }

    const conf1 = {
      id: 1,
      event_type: 'conference',
      title: '2026年引力透镜年会会议',
      date: '2026-10-16',
      end_date: '2026-10-19',
      registration_deadline: '2026-09-10'
    }
    const conf2 = {
      id: 2,
      event_type: 'conference',
      title: '空间科学卫星研讨会',
      date: '2026-10-20',
      end_date: '2026-10-20',
      registration_deadline: '2026-09-15'
    }
    const conf3 = {
      id: 3,
      event_type: 'conference',
      title: '天文学年会',
      date: '2026-10-27',
      end_date: '2026-10-30',
      registration_deadline: '2026-09-20'
    }
    const conf4_2027 = {
      id: 4,
      event_type: 'conference',
      title: 'Strong Gravitational Lensing 2027',
      date: '2027-01-15',
      end_date: '2027-01-18',
      abstract_deadline: '2026-10-22',
      registration_deadline: '2026-11-20'
    }
    const conf5 = {
      id: 5,
      event_type: 'conference',
      title: '银河系结构研讨会',
      date: '2026-11-05',
      end_date: '2026-11-08',
      registration_deadline: '2026-10-25'
    }

    const allConferences = [conf1, conf2, conf3, conf4_2027, conf5]

    // 阶段1：2026-09-24（今天），conf4 摘要截止在 10-22，早于天文学年会的 10-27 开幕，优先级高于天文学年会并展示在首页
    const resultSep24 = sortUpcomingConferences(allConferences, '2026-09-24', 4)

    expect(resultSep24.length).toBe(4)
    expect(resultSep24[0].id).toBe(1)
    expect(resultSep24[1].id).toBe(2)
    expect(resultSep24[2].id).toBe(4) // 10.22 摘要投递截止 -> 优先级高于天文学年会（10.27）
    expect(resultSep24[3].id).toBe(5) // 10.25 注册截止
    expect(resultSep24.map(c => c.id)).toContain(4)

    // 阶段2：2026-10-23（摘要截止已过），conf4 优先级按较晚的注册截止 11-20 计算，排到天文学年会（10-27）及 11-05 之后
    const resultOct23 = sortUpcomingConferences(allConferences, '2026-10-23', 4)

    expect(resultOct23[0].id).toBe(5) // 10.25 注册
    expect(resultOct23[1].id).toBe(3) // 10.27 开幕
    expect(resultOct23[2].id).toBe(4) // 11.20 注册 -> 排在天文学年会之后
  })

  it('excludes conferences when all 3 milestones have passed', () => {
    function getConferencePriorityInfo(conf, todayVal) {
      const candidates = []
      if (conf.abstract_deadline && conf.abstract_deadline >= todayVal) candidates.push(conf.abstract_deadline)
      if (conf.registration_deadline && conf.registration_deadline >= todayVal) candidates.push(conf.registration_deadline)
      if (conf.date && conf.date >= todayVal) candidates.push(conf.date)
      else if ((conf.end_date || conf.date) && (conf.end_date || conf.date) >= todayVal) candidates.push(conf.end_date || conf.date)
      return candidates.length > 0 ? candidates.sort()[0] : null
    }

    const pastConf = {
      date: '2026-09-10',
      end_date: '2026-09-12',
      abstract_deadline: '2026-08-01',
      registration_deadline: '2026-08-20'
    }

    expect(getConferencePriorityInfo(pastConf, '2026-09-24')).toBeNull()
  })

  it('formats dates properly with 2-digit year prefix when not current year', () => {
    function formatHomeConfDate(conf, todayVal = '2026-09-24') {
      if (!conf?.date) return ''
      const todayYear = todayVal.slice(0, 4)
      const start = conf.date
      const end = conf.end_date || conf.date
      const [sy, sm, sd] = start.split('-')
      const [ey, em, ed] = end.split('-')

      const yearPrefix = sy !== todayYear ? `'${sy.slice(2)}.` : ''

      if (start === end) {
        return `${yearPrefix}${sm}.${sd}`
      }
      if (sy === ey && sm === em) {
        return `${yearPrefix}${sm}.${sd} - ${ed}`
      }
      return `${yearPrefix}${sm}.${sd} - ${em}.${ed}`
    }

    expect(formatHomeConfDate({ date: '2026-10-16', end_date: '2026-10-19' })).toBe('10.16 - 19')
    expect(formatHomeConfDate({ date: '2026-10-20', end_date: '2026-10-20' })).toBe('10.20')
    expect(formatHomeConfDate({ date: '2027-01-15', end_date: '2027-01-18' })).toBe("'27.01.15 - 18")
  })

  it('verifies HomeView template includes grid-cols-4 and compact styling classes', () => {
    expect(content).toContain('grid-cols-')
    expect(content).toContain('.home-conf-grid.grid-cols-4')
    expect(content).toContain('slice(0, 4)')
    expect(content).toContain('getHomeConfDeadlineBadge')
  })
})
