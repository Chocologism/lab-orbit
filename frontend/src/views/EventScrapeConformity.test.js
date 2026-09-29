import { describe, it, expect } from 'vitest'
import {
  cleanHtmlText,
  extractMainContent,
  extractJsonLdEvent,
  parsePageHtml,
  resolveAbsoluteUrl
} from '../utils/webScraper.js'

describe('EventScrapeConformity: 学术会议与报告抓取与降噪清洗', () => {
  const sampleIndicoHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Strong Lensing in the Next Decade - Overview (11-15 January 2027) &middot; Tsung-Dao Lee Institute</title>
      <meta property="og:title" content="Strong Lensing in the Next Decade (11-15 January 2027)">
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "Strong Lensing in the Next Decade",
        "startDate": "2027-01-11",
        "endDate": "2027-01-15",
        "url": "https://web.gravity.sjtu.edu.cn/event/13/",
        "location": {
          "@type": "Place",
          "name": "Jin Jiang Hotel",
          "address": "59 Maoming South Road, Huangpu District, Shanghai"
        },
        "description": "International conference on strong gravitational lensing"
      }
      </script>
    </head>
    <body>
      <header>
        <div class="header-logo">TDLI Event Management</div>
        <nav><a href="/login">Login</a></nav>
      </header>

      <div class="timezone-picker">
        <select name="tz">
          <option value="Africa/Abidjan">Africa/Abidjan</option>
          <option value="America/New_York">America/New_York</option>
          <option value="Asia/Shanghai">Asia/Shanghai</option>
          <option value="Europe/London">Europe/London</option>
        </select>
        <span>Choose timezone</span>
      </div>

      <div class="language-selector">
        <span>Deutsch</span>
        <span>Español</span>
        <span>Français</span>
        <span>中文</span>
      </div>

      <div class="conf_leftMenu">
        <h2>Event menu</h2>
        <ul id="outer">
          <li><a href="/event/13/overview">Overview</a></li>
          <li><a href="/event/13/page/34-key-dates">Key dates</a></li>
          <li><a href="/event/13/abstracts/">Call for Abstracts</a></li>
          <li><a href="/event/13/page/39-registration-info">Registration info</a></li>
          <li><a href="/event/13/page/33-venue">Venue</a></li>
          <li><a href="/event/13/page/35-visa-information">Visa information</a></li>
          <li><a href="/event/13/timetable/?view=standard">Timetable (Standard)</a></li>
          <li><a href="/event/13/timetable/?view=standard_inline_minutes">Timetable (Minutes)</a></li>
        </ul>
      </div>

      <div class="conference-page">
        <div class="page-content">
          <h1>Strong Lensing in the Next Decade</h1>
          <p>Dates: 11-15 January 2027</p>
          <p>Location: Jin Jiang Hotel, 59 Maoming South Road, Shanghai</p>
          <p>Registration deadline: 2026-10-31</p>
          <p>Abstract submission deadline: 2026-09-15</p>
          <p>Visa applications should be submitted at least 2 months in advance.</p>
        </div>
      </div>

      <footer>
        <p>Powered by Indico</p>
      </footer>
    </body>
    </html>
  `

  it('cleanHtmlText 应彻底过滤下拉列表时区、语言切换与页眉页脚噪音', () => {
    const text = cleanHtmlText(sampleIndicoHtml)

    // 不应包含时区列表与时区选项
    expect(text).not.toContain('Africa/Abidjan')
    expect(text).not.toContain('America/New_York')
    expect(text).not.toContain('Europe/London')
    expect(text).not.toContain('Choose timezone')

    // 不应包含页眉导航与页脚
    expect(text).not.toContain('TDLI Event Management')
    expect(text).not.toContain('Powered by Indico')

    // 不应包含纯语言选择列表
    expect(text).not.toContain('Español')
    expect(text).not.toContain('Français')

    // 必须保留核心会议文本
    expect(text).toContain('Strong Lensing in the Next Decade')
    expect(text).toContain('11-15 January 2027')
    expect(text).toContain('Jin Jiang Hotel')
    expect(text).toContain('Registration deadline: 2026-10-31')
    expect(text).toContain('Abstract submission deadline: 2026-09-15')
    expect(text).toContain('Visa applications should be submitted')
  })

  it('extractJsonLdEvent 应正确解析 Schema.org Event 元数据', () => {
    const jsonLd = extractJsonLdEvent(sampleIndicoHtml)
    expect(jsonLd).not.toBeNull()
    expect(jsonLd.title).toBe('Strong Lensing in the Next Decade')
    expect(jsonLd.startDate).toBe('2027-01-11')
    expect(jsonLd.endDate).toBe('2027-01-15')
    expect(jsonLd.location).toBe('Jin Jiang Hotel (59 Maoming South Road, Huangpu District, Shanghai)')
    expect(jsonLd.description).toContain('strong gravitational lensing')
  })

  it('extractMainContent 应靶向提取会议正文区域', () => {
    const mainContent = extractMainContent(sampleIndicoHtml)
    expect(mainContent).toContain('Strong Lensing in the Next Decade')
    expect(mainContent).toContain('Jin Jiang Hotel')
    expect(mainContent).not.toContain('Africa/Abidjan')
  })

  it('parsePageHtml 应高分优先识别出核心活动栏目（Key dates、摘要、注册、会场、签证等）并去重 timetable view', () => {
    const parsed = parsePageHtml(sampleIndicoHtml, 'https://web.gravity.sjtu.edu.cn/event/13/')

    expect(parsed.title).toBe('Strong Lensing in the Next Decade (11-15 January 2027)')
    expect(parsed.jsonLdEvent).toBeDefined()
    expect(parsed.candidateLinks.length).toBeGreaterThanOrEqual(5)

    const texts = parsed.candidateLinks.map(c => c.text)

    // 应包含所有核心关键页面
    expect(texts).toContain('Key dates')
    expect(texts).toContain('Call for Abstracts')
    expect(texts).toContain('Registration info')
    expect(texts).toContain('Venue')
    expect(texts).toContain('Visa information')

    // 侧边栏链接应获得最高优先级（分值 >= 30）
    for (const link of parsed.candidateLinks) {
      if (['Key dates', 'Call for Abstracts', 'Registration info', 'Venue', 'Visa information'].includes(link.text)) {
        expect(link.score).toBeGreaterThanOrEqual(30)
      }
    }

    // 针对 timetable/?view=standard 与 timetable/?view=standard_inline_minutes 应去重或过滤，不能占据多个名额
    const timetableLinks = parsed.candidateLinks.filter(c => c.url.includes('/timetable/'))
    expect(timetableLinks.length).toBeLessThanOrEqual(1)
  })
})
