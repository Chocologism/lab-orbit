import { describe, it, expect } from 'vitest'
import { parseExternalEmails, formatSeminarDateTime, buildSeminarNoticeBody, buildSeminarNoticeHtml, formatNoticeBodyToHtml } from './smtpNotice'

describe('smtpNotice utilities', () => {
  it('parses external emails correctly with various separators and trims duplicates', () => {
    const raw = 'test1@example.edu, test2@163.com; test3@qq.com\ntest1@example.edu  invalid-email  guest@nju.edu.cn'
    const result = parseExternalEmails(raw)
    expect(result).toEqual([
      'test1@example.edu',
      'test2@163.com',
      'test3@qq.com',
      'guest@nju.edu.cn'
    ])
  })

  it('formats seminar date and time into natural Chinese', () => {
    // 2026-09-16 is Wednesday
    const formatted = formatSeminarDateTime('2026-09-16', '10:00')
    expect(formatted).toBe('9月16日（周三）上午10点')

    const formattedAfternoon = formatSeminarDateTime('2026-09-16', '14:30')
    expect(formattedAfternoon).toBe('9月16日（周三）下午2点30分')
  })

  it('generates the seminar notice email body following standard format with hyphen bullets', () => {
    const body = buildSeminarNoticeBody({
      dateStr: '2026-09-23',
      timeStr: '10:00',
      location: '5-511 / 腾讯会议 911-575-921',
      presenterName: '赵子涵',
      presentationsText: '陈晨，王思齐',
      topic: '当自适应 Fuzzy Dark matter 模拟遇上Agent时代',
      abstract: '随着 Fuzzy Dark Matter 模拟逐渐进入大质量阻晕和多尺度问题...',
      adminName: '李华'
    })

    expect(body).toContain('大家好，\n\n下次组会安排如下：\n- 时间：9月23日（周三）上午10点\n- 地点：5-511\n- 线上：腾讯会议 911-575-921')
    expect(body).toContain('主讲人：赵子涵')
    expect(body).toContain('题目：当自适应 Fuzzy Dark matter 模拟遇上Agent时代')
    expect(body).toContain('摘要：随着 Fuzzy Dark Matter 模拟逐渐进入大质量阻晕和多尺度问题...')
    expect(body).toContain('Arxiv主讲人：陈晨，王思齐')
    expect(body).toContain('请大家准时参加，谢谢！\n\n祝好，\n李华')
  })

  it('generates standard HTML notice with red location highlight', () => {
    const html = buildSeminarNoticeHtml({
      dateStr: '2026-09-23',
      timeStr: '10:00',
      location: '5-511 / 腾讯会议 911-575-921',
      presenterName: '赵子涵',
      presentationsText: '陈晨，王思齐',
      topic: '当自适应 Fuzzy Dark matter 模拟遇上Agent时代',
      abstract: '随着 Fuzzy Dark Matter 模拟逐渐进入大质量阻晕和多尺度问题...',
      adminName: '李华'
    })

    expect(html).toContain('<span style="color: #e53333; font-weight: bold;">5-511</span>')
    expect(html).toContain('<strong>主讲人</strong>：赵子涵')
    expect(html).toContain('<strong>题目</strong>：当自适应 Fuzzy Dark matter 模拟遇上Agent时代')
    expect(html).toContain('<strong>Arxiv主讲人</strong>：陈晨，王思齐')
  })

  it('formats custom edited notice text into html with red location highlight', () => {
    const customText = `大家好，\n\n下次组会安排如下：\n- 时间：9月23日（周三）上午10点\n- 地点：5-511\n- 线上：腾讯会议 911-575-921\n\n主讲人：赵子涵\n题目：测试\n摘要：无\n\nArxiv主讲人：无\n\n请大家准时参加，谢谢！\n\n祝好，\n李华`
    const html = formatNoticeBodyToHtml(customText)
    expect(html).toContain('<span style="color: #e53333; font-weight: bold;">5-511</span>')
    expect(html).toContain('• <strong>时间</strong>：')
  })

  it('formats email subject simply as 【组会通知】date and time', () => {
    // 2026-09-23 is Wednesday
    const formatted = formatSeminarDateTime('2026-09-23', '10:00')
    expect(formatted).toBe('9月23日（周三）上午10点')
    const subject = `【组会通知】${formatted}`
    expect(subject).toBe('【组会通知】9月23日（周三）上午10点')
  })
})
