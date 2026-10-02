import { describe, it, expect, beforeEach } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import HomeWidgetRenderer from './HomeWidgetRenderer.vue'
import {
  CANONICAL_SIZE_ORDER,
  WIDGET_REGISTRY,
  useHomeGridEngine,
  addWidgetToLayout,
  removeWidgetFromLayout,
  resetHomeGridLayout
} from '../../composables/useHomeGridEngine'

function renderWidget(props) {
  const app = createSSRApp({
    render: () => h(HomeWidgetRenderer, props)
  })
  app.component('router-link', {
    props: ['to'],
    render() {
      let href = '#'
      if (typeof this.to === 'string') {
        href = this.to
      } else if (this.to && typeof this.to === 'object') {
        const path = this.to.path || ''
        const queryParams = new URLSearchParams()
        if (this.to.query) {
          Object.entries(this.to.query).forEach(([k, v]) => {
            if (v !== undefined && v !== null) queryParams.set(k, String(v))
          })
        }
        const qs = queryParams.toString()
        href = qs ? `${path}?${qs}` : path
      }
      return h('a', { href }, this.$slots.default ? this.$slots.default() : [])
    }
  })
  return renderToString(app)
}

describe('Home Widget Features & Requirements Specification', () => {
  beforeEach(() => {
    resetHomeGridLayout()
  })

  describe('1. Unified Size Order Specification', () => {
    it('defines CANONICAL_SIZE_ORDER as minimal -> small -> medium -> large -> medium-wide -> wide', () => {
      expect(CANONICAL_SIZE_ORDER).toEqual([
        'minimal',
        'small',
        'medium',
        'large',
        'medium-wide',
        'wide'
      ])
    })

    it('every widget in WIDGET_REGISTRY has its supportedSizes ordered by CANONICAL_SIZE_ORDER', () => {
      Object.entries(WIDGET_REGISTRY).forEach(([widgetId, def]) => {
        const sizes = def.supportedSizes
        const sorted = [...sizes].sort((a, b) => CANONICAL_SIZE_ORDER.indexOf(a) - CANONICAL_SIZE_ORDER.indexOf(b))
        expect(sizes).toEqual(sorted)
      })
    })
  })

  describe('2. Slot 1 Dual Medium-Wide Layout Behavior', () => {
    it('allows placing 2 medium-wide cards side-by-side in Slot 1', () => {
      const { slot1Config } = useHomeGridEngine()
      // Add first medium-wide widget (e.g. conferences)
      const res1 = addWidgetToLayout('conferences', 'medium-wide', { slot1Index: 0 })
      expect(res1).toBe(true)
      expect(slot1Config.value.type).toBe('medium-wide')
      expect(slot1Config.value.items.length).toBe(1)
      expect(slot1Config.value.items[0].widgetId).toBe('conferences')
      expect(slot1Config.value.items[0].size).toBe('medium-wide')

      // Add second medium-wide widget (e.g. next-seminar)
      const res2 = addWidgetToLayout('next-seminar', 'medium-wide', { slot1Index: 1 })
      expect(res2).toBe(true)
      expect(slot1Config.value.type).toBe('medium-wide')
      expect(slot1Config.value.items.length).toBe(2)
      expect(slot1Config.value.items[0].widgetId).toBe('conferences')
      expect(slot1Config.value.items[1].widgetId).toBe('next-seminar')
    })

    it('removes left medium-wide card while keeping the right one pinned to slot1Index: 1', () => {
      const { slot1Config } = useHomeGridEngine()
      addWidgetToLayout('conferences', 'medium-wide', { slot1Index: 0 })
      addWidgetToLayout('next-seminar', 'medium-wide', { slot1Index: 1 })
      expect(slot1Config.value.items.length).toBe(2)

      const firstId = slot1Config.value.items[0].id
      removeWidgetFromLayout(firstId)

      expect(slot1Config.value.type).toBe('medium-wide')
      expect(slot1Config.value.items.length).toBe(1)
      expect(slot1Config.value.items[0].widgetId).toBe('next-seminar')
      expect(slot1Config.value.items[0].slot1Index).toBe(1)

      // Adding a new card to slot1Index 0 populates the left without overwriting the right
      addWidgetToLayout('library', 'medium-wide', { slot1Index: 0 })
      expect(slot1Config.value.items.length).toBe(2)
      expect(slot1Config.value.items[0].widgetId).toBe('library')
      expect(slot1Config.value.items[0].slot1Index).toBe(0)
      expect(slot1Config.value.items[1].widgetId).toBe('next-seminar')
      expect(slot1Config.value.items[1].slot1Index).toBe(1)

      // Removing both cards transitions slot 1 to empty
      removeWidgetFromLayout(slot1Config.value.items[0].id)
      removeWidgetFromLayout(slot1Config.value.items[0].id)
      expect(slot1Config.value.type).toBe('empty')
      expect(slot1Config.value.items.length).toBe(0)
    })
  })

  describe('3. Academic Conference Priority & Ranking Reason', () => {
    function getRankingReason(conf, getBadgeFn, formatConfDateFn) {
      if (!conf) return ''
      const badge = getBadgeFn ? getBadgeFn(conf) : null
      if (badge?.text) return badge.text
      if (conf._priority) {
        if (conf._priority.priorityType === 'start') {
          return `${formatConfDateFn(conf)} 开幕`
        }
        if (conf._priority.badgeLabel) {
          return `${conf._priority.badgeLabel} ${conf._priority.priorityDate.slice(5)} 截止`
        }
      }
      return `${formatConfDateFn(conf)} 举办`
    }

    it('displays deadline reason when conference has abstract deadline', () => {
      const mockConf = {
        title: '宇宙学前沿研讨会',
        date: '2026-11-20',
        _priority: {
          priorityType: 'abstract',
          badgeLabel: '摘要',
          priorityDate: '2026-10-20'
        }
      }
      const mockBadgeFn = () => ({ text: '摘要 10.20 截止', isUrgent: false })
      const reason = getRankingReason(mockConf, mockBadgeFn, (c) => c.date.slice(5))
      expect(reason).toBe('摘要 10.20 截止')
    })

    it('displays urgent deadline when conference abstract deadline is close', () => {
      const mockConf = {
        title: '星系形成专题会议',
        date: '2026-11-01',
        _priority: {
          priorityType: 'abstract',
          badgeLabel: '摘要',
          priorityDate: '2026-10-04'
        }
      }
      const mockBadgeFn = () => ({ text: '摘要仅剩 3 天', isUrgent: true })
      const reason = getRankingReason(mockConf, mockBadgeFn, (c) => c.date.slice(5))
      expect(reason).toBe('摘要仅剩 3 天')
    })

    it('displays opening date reason when conference ranks first by event date', () => {
      const mockConf = {
        title: '引力波天文年会',
        date: '2026-11-15',
        _priority: {
          priorityType: 'start',
          priorityDate: '2026-11-15'
        }
      }
      const mockBadgeFn = () => null
      const formatConfDateFn = (c) => '11.15'
      const reason = getRankingReason(mockConf, mockBadgeFn, formatConfDateFn)
      expect(reason).toBe('11.15 开幕')
    })
  })

  describe('4. Seminar Wide & Medium-Wide Card Displays with arXiv Presenters', () => {
    it('formats seminar sub-cards with main presenter and arXiv sharers', () => {
      const sampleSeminar = {
        id: 101,
        date: '2026-10-15',
        time: '14:30',
        topic: '宇宙微波背景辐射高精度参数拟合',
        presenter_name: '张三',
        location: '学术交流中心 216',
        presentations: [
          { presenter_name: '李四', arxiv_id: '2409.12345' },
          { presenter_name: '王五', arxiv_id: '2410.01234' }
        ]
      }

      // Check date format helper
      const m = Number(sampleSeminar.date.slice(5, 7))
      const d = sampleSeminar.date.slice(8, 10)
      expect(`${m}.${d}`).toBe('10.15')

      // Check arXiv sharers text
      const arxivSharers = sampleSeminar.presentations.map(p => p.presenter_name).join('、')
      expect(arxivSharers).toBe('李四、王五')
    })
  })

  describe('5. Weather Widget Multi-Day Forecast & Hourly Specification', () => {
    it('provides 4-day daily forecast for wide card and 2-day forecast for medium-wide card', () => {
      const weatherData = {
        label: '晴朗',
        temperature: 24,
        daily: [
          { dayName: '今天', label: '晴朗', low: 19, high: 28, rain: 10 },
          { dayName: '明天', label: '多云', low: 18, high: 27, rain: 20 },
          { dayName: '后天', label: '阴天', low: 17, high: 25, rain: 35 },
          { dayName: '大后天', label: '小雨', low: 16, high: 23, rain: 60 }
        ],
        hourly: [
          { time: '现在', temp: 24, label: '晴朗' },
          { time: '14:00', temp: 26, label: '晴朗' },
          { time: '15:00', temp: 25, label: '多云' }
        ]
      }

      const wideDays = weatherData.daily.slice(0, 4)
      expect(wideDays.length).toBe(4)
      expect(wideDays[0].dayName).toBe('今天')
      expect(wideDays[1].dayName).toBe('明天')
      expect(wideDays[2].dayName).toBe('后天')
      expect(wideDays[3].dayName).toBe('大后天')

      const mediumWideDays = weatherData.daily.slice(0, 2)
      expect(mediumWideDays.length).toBe(2)
      expect(mediumWideDays[0].dayName).toBe('今天')
      expect(mediumWideDays[1].dayName).toBe('明天')

      expect(weatherData.hourly.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('6. Library Items Sorting & Display Specification', () => {
    it('sorts favorite papers first, followed by newest to oldest', () => {
      const papers = [
        { id: 1, title: 'Paper A (Normal Old)', created_at: '2026-09-01T10:00:00Z', is_favorite: false },
        { id: 2, title: 'Paper B (Normal New)', created_at: '2026-09-20T10:00:00Z', is_favorite: false },
        { id: 3, title: 'Paper C (Fav Old)', created_at: '2026-08-01T10:00:00Z', is_favorite: true },
        { id: 4, title: 'Paper D (Fav New)', created_at: '2026-09-25T10:00:00Z', is_favorite: true }
      ]

      const sorted = [...papers].sort((a, b) => {
        const aFav = a.is_favorite ? 1 : 0
        const bFav = b.is_favorite ? 1 : 0
        if (aFav !== bFav) return bFav - aFav
        return b.created_at.localeCompare(a.created_at)
      })

      // Favorites come first, then sorted by newest
      expect(sorted[0].id).toBe(4) // Fav New
      expect(sorted[1].id).toBe(3) // Fav Old
      expect(sorted[2].id).toBe(2) // Normal New
      expect(sorted[3].id).toBe(1) // Normal Old
    })

    it('formats authors array or string properly', () => {
      function formatAuthors(item) {
        if (!item) return ''
        if (Array.isArray(item.authors) && item.authors.length > 0) return item.authors.join(' · ')
        if (typeof item.authors === 'string' && item.authors.trim()) return item.authors
        if (item.author) return item.author
        return ''
      }

      expect(formatAuthors({ authors: ['张三', '李四'] })).toBe('张三 · 李四')
      expect(formatAuthors({ authors: '王五' })).toBe('王五')
      expect(formatAuthors({ author: '赵六' })).toBe('赵六')
    })
  })

  describe('7. Resources Items Sorting & Display Specification', () => {
    it('sorts favorite books/resources first, followed by newest to oldest', () => {
      const resources = [
        { id: 10, title: 'Cosmology I', created_at: '2026-08-10T10:00:00Z', is_favorite: false },
        { id: 20, title: 'Cosmology II', created_at: '2026-09-15T10:00:00Z', is_favorite: false },
        { id: 30, title: 'Cosmology III (Fav)', created_at: '2026-07-01T10:00:00Z', is_favorite: true }
      ]

      const sorted = [...resources].sort((a, b) => {
        const aFav = a.is_favorite ? 1 : 0
        const bFav = b.is_favorite ? 1 : 0
        if (aFav !== bFav) return bFav - aFav
        return b.created_at.localeCompare(a.created_at)
      })

      expect(sorted[0].id).toBe(30)
      expect(sorted[1].id).toBe(20)
      expect(sorted[2].id).toBe(10)
    })
  })

  describe('8. HomeWidgetRenderer Component Template Verification', () => {
    it('renders weather wide card with 4 days and no sun icon or astro text', async () => {
      const html = await renderWidget({
        widgetId: 'weather',
        size: 'wide',
        weatherData: {
          label: '晴朗',
          temperature: 24,
          daily: [
            { dayName: '今天', label: '晴朗', low: 19, high: 28, rain: 10 },
            { dayName: '明天', label: '多云', low: 18, high: 27, rain: 20 },
            { dayName: '后天', label: '阴天', low: 17, high: 25, rain: 35 },
            { dayName: '大后天', label: '多云', low: 18, high: 26, rain: 15 }
          ]
        }
      })
      expect(html).toContain('气象预报')
      expect(html).toContain('今天')
      expect(html).toContain('明天')
      expect(html).toContain('后天')
      expect(html).toContain('大后天')
      expect(html).not.toContain('适宜巡天标定')
      expect(html).not.toContain('天文视宁度与观测研判')
      // No app-icon inside weather wide card
      expect(html).not.toContain('app-icon')
    })

    it('renders weather large card with hourly forecast and no astro text', async () => {
      const html = await renderWidget({
        widgetId: 'weather',
        size: 'large',
        weatherData: {
          label: '晴朗',
          temperature: 24,
          feels: 25,
          low: 19,
          high: 28,
          hourly: [
            { time: '现在', temp: 24, label: '晴朗' },
            { time: '14:00', temp: 26, label: '小毛毛雨' },
            { time: '15:00', temp: 25, label: '雷雨伴冰雹' }
          ]
        }
      })
      expect(html).toContain('气象预报')
      expect(html).toContain('未来分时气象')
      expect(html).toContain('现在')
      // Verifies concise label transformation
      expect(html).toContain('毛毛雨')
      expect(html).toContain('title="小毛毛雨"')
      expect(html).toContain('雷雨')
      expect(html).toContain('title="雷雨伴冰雹"')
      expect(html).not.toContain('天文视宁度与观测研判')
      // No app-icon inside weather large card
      expect(html).not.toContain('app-icon')
    })

    it('renders library card with paper-library icon and top 3 items in medium', async () => {
      const html = await renderWidget({
        widgetId: 'library',
        size: 'medium',
        libraryCount: '10 篇',
        libraryItems: [
          { id: 1, title: 'Paper 1', category: '透镜' },
          { id: 2, title: 'Paper 2', category: '星系' },
          { id: 3, title: 'Paper 3', category: '宇宙学' },
          { id: 4, title: 'Paper 4', category: '射电' },
          { id: 5, title: 'Paper 5', category: '黑洞' }
        ]
      })
      expect(html).toContain('icon-paper-library')
      expect(html).toContain('Paper 5')
      expect(html).toContain('Paper 4')
      expect(html).toContain('Paper 3')
      expect(html).not.toContain('Paper 2')
      expect(html).not.toContain('Paper 1')
    })

    it('renders resources card with resource-db icon and top 3 items in medium', async () => {
      const html = await renderWidget({
        widgetId: 'resources',
        size: 'medium',
        resourcesCount: '15 册',
        resourcesItems: [
          { id: 1, title: 'Book 1', category: '教材' },
          { id: 2, title: 'Book 2', category: '专著' },
          { id: 3, title: 'Book 3', category: '代码' },
          { id: 4, title: 'Book 4', category: '讲义' },
          { id: 5, title: 'Book 5', category: '论文集' }
        ]
      })
      expect(html).toContain('icon-resource-db')
      expect(html).toContain('Book 5')
      expect(html).toContain('Book 4')
      expect(html).toContain('Book 3')
      expect(html).not.toContain('Book 2')
      expect(html).not.toContain('Book 1')
    })

    it('renders resources large card showing top 4 items to fill vertical layout', async () => {
      const html = await renderWidget({
        widgetId: 'resources',
        size: 'large',
        resourcesCount: '15 册',
        resourcesItems: [
          { id: 1, title: 'Book 1', category: '教材' },
          { id: 2, title: 'Book 2', category: '专著' },
          { id: 3, title: 'Book 3', category: '代码' },
          { id: 4, title: 'Book 4', category: '讲义' },
          { id: 5, title: 'Book 5', category: '论文集' }
        ]
      })
      expect(html).toContain('icon-resource-db')
      expect(html).toContain('资料库')
      expect(html).toContain('Book 5')
      expect(html).toContain('Book 4')
      expect(html).toContain('Book 3')
      expect(html).toContain('Book 2')
      expect(html).not.toContain('Book 1')
    })

    it('renders library wide card displaying author and academic meta tags', async () => {
      const html = await renderWidget({
        widgetId: 'library',
        size: 'wide',
        libraryItems: [
          { id: 1, title: '弱引力透镜测量', authors: ['Bartelmann', 'Schneider'], primary_category: 'astro-ph.CO', journal: 'ApJ' }
        ]
      })
      expect(html).toContain('Bartelmann · Schneider')
      expect(html).toContain('astro-ph.CO')
      expect(html).toContain('ApJ')
      expect(html).not.toContain('查看全文与讨论记录')
      expect(html).toContain('icon-paper-library')
    })
  })

  describe('6. Literature Recommendation (arxiv) Widget Redesign', () => {
    const mockPapers = [
      { id: 1, title: 'Paper 1 (Oldest)', category: 'astro-ph.CO', recommender: { id: 1, name: 'Alice', real_name: 'Alice' }, created_at: '2026-01-01' },
      { id: 2, title: 'Paper 2', category: 'astro-ph.GA', recommender: { id: 2, name: 'Bob', real_name: 'Bob' }, created_at: '2026-01-02' },
      { id: 3, title: 'Paper 3', category: 'astro-ph.SR', recommender: { id: 3, name: '王思齐', real_name: '王思齐' }, created_at: '2026-01-03' },
      { id: 4, title: 'Paper 4', category: 'astro-ph.HE', recommender: { id: 4, name: 'David', real_name: 'David' }, created_at: '2026-01-04' },
      { id: 5, title: 'Paper 5 (Newest)', category: 'astro-ph.IM', recommender: { id: 5, name: 'Eva', real_name: 'Eva' }, created_at: '2026-01-05' }
    ]

    it('renders medium card with top 3 items sorted newest-first and avoids JSON object serialization', async () => {
      const html = await renderWidget({
        widgetId: 'arxiv',
        size: 'medium',
        arxivCount: '5 篇',
        arxivItems: mockPapers
      })
      expect(html).toContain('icon-feed-paper')
      // Newest papers should be present (top 3)
      expect(html).toContain('Paper 5 (Newest)')
      expect(html).toContain('Paper 4')
      expect(html).toContain('Paper 3')
      // 4th and 5th papers should be truncated out
      expect(html).not.toContain('Paper 2')
      expect(html).not.toContain('Paper 1 (Oldest)')
      // Recommender name rendered cleanly
      expect(html).toContain('王思齐')
      expect(html).toContain('Eva')
      // Crucial: no JSON serialization like {"id":3...}
      expect(html).not.toContain('&quot;id&quot;')
      expect(html).not.toContain('"id":')
    })

    it('renders wide card ordered newest-first, showing recommender and omitting legacy badges', async () => {
      const html = await renderWidget({
        widgetId: 'arxiv',
        size: 'wide',
        arxivItems: mockPapers
      })
      expect(html).toContain('icon-feed-paper')
      expect(html).toContain('Paper 5 (Newest)')
      expect(html).toContain('Eva')
      expect(html).not.toContain('文献精选')
      expect(html).not.toContain('阅读导师评语与全文')
    })

    it('renders large card with clean English title, top 3 items, and structured subcards', async () => {
      const html = await renderWidget({
        widgetId: 'arxiv',
        size: 'large',
        arxivItems: mockPapers
      })
      expect(html).toContain('icon-feed-paper')
      expect(html).toContain('Paper 5 (Newest)')
      expect(html).toContain('Paper 4')
      expect(html).toContain('Paper 3')
      expect(html).not.toContain('Paper 2')
      expect(html).toContain('Eva')
      expect(html).toContain('王思齐')
      // No overflow comment box
      expect(html).not.toContain('arxiv-comment-box')
      // Header has no nested extra spans or line breaks
      expect(html).toContain('文献推荐')
    })

    it('renders small card showing latest recommended paper title in compact font', async () => {
      const html = await renderWidget({
        widgetId: 'arxiv',
        size: 'small',
        arxivItems: mockPapers
      })
      expect(html).toContain('icon-feed-paper')
      expect(html).toContain('文献推荐')
      expect(html).toContain('Paper 5 (Newest)')
      expect(html).toContain('arxiv-s-paper-title')
    })
  })

  describe('7. Mailbox Widget Multi-Size Redesign & Email Integration', () => {
    const mockEmails = [
      { id: 1, subject: 'Paper Submission Confirmation', from_name: 'Editorial Office', from_address: 'editor@apj.org', date_str: '10:30' },
      { id: 2, subject: 'Observation Schedule Update', from_name: 'FAST Support', from_address: 'fast@nao.cas.cn', date_str: '昨天' },
      { id: 3, subject: 'Colloquium Reminder: Gravitational Waves', from_name: 'Physics Dept', from_address: 'talks@nju.edu.cn', date_str: '周二' },
      { id: 4, subject: 'Review Request: Galaxies in Void', from_name: 'MNRAS Office', from_address: 'reviews@mnras.org', date_str: '9月28日' },
      { id: 5, subject: 'Old Newsletter', from_name: 'AAS News', from_address: 'news@aas.org', date_str: '9月20日' }
    ]

    it('renders unconfigured guide card when mailboxEmails is empty', async () => {
      const html = await renderWidget({
        widgetId: 'mailbox',
        size: 'wide',
        mailboxEmails: []
      })
      expect(html).toContain('POP3 / IMAP 高速收信协议支持')
    })

    it('renders wide card with top 4 emails when mailboxEmails has data', async () => {
      const html = await renderWidget({
        widgetId: 'mailbox',
        size: 'wide',
        mailboxEmails: mockEmails
      })
      expect(html).toContain('Paper Submission Confirmation')
      expect(html).toContain('Observation Schedule Update')
      expect(html).toContain('Colloquium Reminder: Gravitational Waves')
      expect(html).toContain('Review Request: Galaxies in Void')
      expect(html).not.toContain('Old Newsletter')
      expect(html).toContain('Editorial Office')
      expect(html).toContain('editor@apj.org')
      expect(html).not.toContain('&lt;editor@apj.org&gt;')
      expect(html).not.toContain('来信')
    })

    it('renders medium-wide card with top 2 emails and no 来信 or angle brackets', async () => {
      const html = await renderWidget({
        widgetId: 'mailbox',
        size: 'medium-wide',
        mailboxEmails: mockEmails
      })
      expect(html).toContain('Paper Submission Confirmation')
      expect(html).toContain('Observation Schedule Update')
      expect(html).not.toContain('Colloquium Reminder: Gravitational Waves')
      expect(html).toContain('Editorial Office')
      expect(html).toContain('editor@apj.org')
      expect(html).not.toContain('&lt;editor@apj.org&gt;')
      expect(html).not.toContain('来信')
    })

    it('renders large card with 3 email subcards and sender address', async () => {
      const html = await renderWidget({
        widgetId: 'mailbox',
        size: 'large',
        mailboxEmails: mockEmails
      })
      expect(html).toContain('Paper Submission Confirmation')
      expect(html).toContain('Observation Schedule Update')
      expect(html).toContain('Colloquium Reminder: Gravitational Waves')
      expect(html).toContain('editor@apj.org')
      expect(html).toContain('fast@nao.cas.cn')
      expect(html).not.toContain('Review Request: Galaxies in Void')
      expect(html).not.toContain('Old Newsletter')
    })

    it('renders medium card formatted consistently with library medium card showing 3 emails', async () => {
      const html = await renderWidget({
        widgetId: 'mailbox',
        size: 'medium',
        mailboxEmails: mockEmails
      })
      expect(html).toContain('list-widget-card')
      expect(html).toContain('Paper Submission Confirmation')
      expect(html).toContain('Observation Schedule Update')
      expect(html).toContain('Colloquium Reminder: Gravitational Waves')
      expect(html).not.toContain('Review Request: Galaxies in Void')
      expect(html).not.toContain('Old Newsletter')
    })

    it('renders small card showing entry access without email list items', async () => {
      const html = await renderWidget({
        widgetId: 'mailbox',
        size: 'small',
        mailboxEmails: mockEmails
      })
      expect(html).toContain('学术邮箱')
      expect(html).toContain('进入邮箱')
      expect(html).toContain('mailbox-s-link')
      expect(html).not.toContain('Paper Submission Confirmation')
      expect(html).not.toContain('Editorial Office')
    })
  })

  describe('8. Seminar Card Compact Layout & Weather Redesign', () => {
    it('places seminar time badge on right in wide and medium-wide cards', async () => {
      const html = await renderWidget({
        widgetId: 'next-seminar',
        size: 'wide',
        upcomingSeminars: [
          {
            id: 1,
            date: '2026-10-15',
            time: '10:00',
            topic: '宇宙学前沿',
            location: '学术交流中心 216',
            presenter_name: '张三'
          }
        ]
      })
      expect(html).toContain('next-conf-time-badge')
      expect(html).toContain('10:00')
      expect(html).toContain('next-conf-top-row')
    })

    it('displays weather wide card with temperature on the right side and date on left', async () => {
      const html = await renderWidget({
        widgetId: 'weather',
        size: 'wide',
        weatherData: {
          label: '晴朗',
          temperature: 24,
          daily: [
            { dayName: '今天', dateText: '10/01 今天', label: '晴朗', low: 18, high: 26, rain: 0 }
          ]
        }
      })
      expect(html).toContain('weather-daily-main-col')
      expect(html).toContain('weather-daily-temp-side')
      expect(html).toContain('18°—26°')
    })

    it('displays weather medium-wide card with subcard layout matching wide card', async () => {
      const html = await renderWidget({
        widgetId: 'weather',
        size: 'medium-wide',
        weatherData: {
          label: '晴朗',
          temperature: 24,
          daily: [
            { dayName: '今天', dateText: '10/01 今天', label: '晴朗', low: 18, high: 26, rain: 0 },
            { dayName: '明天', dateText: '10/02 明天', label: '多云', low: 19, high: 27, rain: 20 }
          ]
        }
      })
      expect(html).toContain('weather-daily-main-col')
      expect(html).toContain('weather-daily-temp-side')
      expect(html).toContain('weather-daily-temp-large')
      expect(html).toContain('18°—26°')
      expect(html).toContain('19°—27°')
      expect(html).toContain('10/01 今天')
      expect(html).toContain('10/02 明天')
    })

    it('displays weather large card with structured today reading and meta capsules', async () => {
      const html = await renderWidget({
        widgetId: 'weather',
        size: 'large',
        weatherData: {
          label: '晴朗',
          temperature: 24,
          feels: 25,
          low: 18,
          high: 26,
          humidity: 45,
          wind: '东北风 2级',
          rain: 0,
          hourly: [
            { time: '现在', temp: 24, label: '晴朗' }
          ]
        }
      })
      expect(html).toContain('weather-large-today-reading')
      expect(html).toContain('weather-large-today-meta')
      expect(html).toContain('weather-metrics-grid')
      expect(html).toContain('weather-metric-card')
      expect(html).toContain('45%')
      expect(html).toContain('东北风 2级')
      expect(html).toContain('weather-hourly-section')
    })

    it('formats wind speed with separated number and unit without truncation in weather large card', async () => {
      const html = await renderWidget({
        widgetId: 'weather',
        size: 'large',
        weatherData: {
          label: '阴',
          temperature: 18,
          feels: 18,
          low: 16,
          high: 21,
          humidity: 82,
          wind: 12.9,
          rain: 80,
          hourly: [
            { time: '01:00', temp: 19, rain: 4, label: '阴' },
            { time: '02:00', temp: 18, rain: 12, label: '阴' },
            { time: '03:00', temp: 18, rain: 33, label: '毛毛雨' }
          ]
        }
      })
      expect(html).toContain('wind-metric-val')
      expect(html).toContain('w-metric-num')
      expect(html).toContain('12.9')
      expect(html).toContain('w-metric-unit')
      expect(html).toContain('km/h')
      expect(html).toContain('82%')
      expect(html).toContain('80%')
      expect(html).toContain('未来分时气象')
    })

    it('renders minimal cards with left-aligned secondary-quick-link-card and no quick-destination class', async () => {
      const widgets = ['conferences', 'next-seminar', 'weather', 'library', 'resources', 'arxiv', 'mailbox']
      for (const widgetId of widgets) {
        const html = await renderWidget({
          widgetId,
          size: 'minimal'
        })
        expect(html).toContain('widget-size-minimal')
        expect(html).toContain('secondary-quick-link-card')
        expect(html).not.toContain('quick-destination')
      }
    })
  })

  describe('9. Sub-card Deep-link Navigation & Resource Web Redirection Specification', () => {
    it('conferences sub-cards link directly to seminars with tab=conferences and conferenceId', async () => {
      const conferences = [
        { id: 101, title: 'IAU General Assembly', date: '2026-08-10' },
        { id: 102, title: 'COSPAR Scientific Assembly', date: '2026-07-15' }
      ]

      // Wide
      const wideHtml = await renderWidget({
        widgetId: 'conferences',
        size: 'wide',
        conferences
      })
      expect(wideHtml).toContain('tab=conferences')
      expect(wideHtml).toContain('conferenceId=101')
      expect(wideHtml).toContain('conferenceId=102')

      // Medium-Wide
      const mwHtml = await renderWidget({
        widgetId: 'conferences',
        size: 'medium-wide',
        conferences
      })
      expect(mwHtml).toContain('tab=conferences')
      expect(mwHtml).toContain('conferenceId=101')
      expect(mwHtml).toContain('conferenceId=102')

      // Large
      const largeHtml = await renderWidget({
        widgetId: 'conferences',
        size: 'large',
        conferences
      })
      expect(largeHtml).toContain('tab=conferences')
      expect(largeHtml).toContain('conferenceId=101')

      // Small
      const smallHtml = await renderWidget({
        widgetId: 'conferences',
        size: 'small',
        conferences
      })
      expect(smallHtml).toContain('tab=conferences')
      expect(smallHtml).toContain('conferenceId=101')
    })

    it('next-seminar sub-cards link directly to seminars with seminar id', async () => {
      const upcomingSeminars = [
        { id: 201, topic: '弱引力透镜宇宙学前沿研讨', date: '2026-10-15', presenter_name: '张三' },
        { id: 202, topic: '巡天模拟算法与参数拟合', date: '2026-10-22', presenter_name: '李四' }
      ]

      // Wide
      const wideHtml = await renderWidget({
        widgetId: 'next-seminar',
        size: 'wide',
        upcomingSeminars
      })
      expect(wideHtml).toContain('seminar=201')
      expect(wideHtml).toContain('seminar=202')

      // Medium-Wide
      const mwHtml = await renderWidget({
        widgetId: 'next-seminar',
        size: 'medium-wide',
        upcomingSeminars
      })
      expect(mwHtml).toContain('seminar=201')
      expect(mwHtml).toContain('seminar=202')

      // Large
      const largeHtml = await renderWidget({
        widgetId: 'next-seminar',
        size: 'large',
        nextSeminar: upcomingSeminars[0]
      })
      expect(largeHtml).toContain('seminar=201')
    })

    it('library sub-cards link directly to library with q query parameter', async () => {
      const libraryItems = [
        { id: 301, title: 'Weak Gravitational Lensing Review', arxiv_id: '2401.00001' },
        { id: 302, title: 'X-Ray Clusters Observation', arxiv_id: '2401.00002' }
      ]

      const wideHtml = await renderWidget({
        widgetId: 'library',
        size: 'wide',
        libraryItems
      })
      expect(wideHtml).toContain('q=2401.00001')
      expect(wideHtml).toContain('q=2401.00002')

      const largeHtml = await renderWidget({
        widgetId: 'library',
        size: 'large',
        libraryItems
      })
      expect(largeHtml).toContain('q=2401.00001')
    })

    it('arxiv sub-cards link directly to arxiv feed with paper_id, arxiv_id and highlight flag', async () => {
      const arxivItems = [
        { id: 401, title: 'High-z Quasars with JWST', arxiv_id: '2402.12345', recommender: '导师' },
        { id: 402, title: 'Cosmological Simulations Emulator', arxiv_id: '2402.54321', recommender: '重点研读' }
      ]

      const wideHtml = await renderWidget({
        widgetId: 'arxiv',
        size: 'wide',
        arxivItems
      })
      expect(wideHtml).toContain('paper_id=401')
      expect(wideHtml).toContain('arxiv_id=2402.12345')
      expect(wideHtml).toContain('highlight=1')

      const mwHtml = await renderWidget({
        widgetId: 'arxiv',
        size: 'medium-wide',
        arxivItems
      })
      expect(mwHtml).toContain('paper_id=401')
      expect(mwHtml).toContain('highlight=1')

      const largeHtml = await renderWidget({
        widgetId: 'arxiv',
        size: 'large',
        arxivItems
      })
      expect(largeHtml).toContain('paper_id=401')
      expect(largeHtml).toContain('highlight=1')

      const smallHtml = await renderWidget({
        widgetId: 'arxiv',
        size: 'small',
        arxivItems
      })
      expect(smallHtml).toContain('paper_id=402')
      expect(smallHtml).toContain('highlight=1')
    })

    it('mailbox sub-cards link directly to mailbox with email_id query parameter', async () => {
      const mailboxEmails = [
        { id: 501, subject: '前沿天体物理学术研讨会邀请函', from_name: '学术研讨会组委会' },
        { id: 502, subject: '高校天文与物理学院学术周报', from_name: '学院秘书' }
      ]

      const wideHtml = await renderWidget({
        widgetId: 'mailbox',
        size: 'wide',
        mailboxEmails
      })
      expect(wideHtml).toContain('email_id=501')
      expect(wideHtml).toContain('email_id=502')

      const mwHtml = await renderWidget({
        widgetId: 'mailbox',
        size: 'medium-wide',
        mailboxEmails
      })
      expect(mwHtml).toContain('email_id=501')
      expect(mwHtml).toContain('email_id=502')

      const largeHtml = await renderWidget({
        widgetId: 'mailbox',
        size: 'large',
        mailboxEmails
      })
      expect(largeHtml).toContain('email_id=501')

      const smallHtml = await renderWidget({
        widgetId: 'mailbox',
        size: 'small',
        mailboxEmails
      })
      expect(smallHtml).toContain('email_id=501')
    })

    it('resources sub-cards display 访问 for website types and download/authors for book types', async () => {
      const resourcesItems = [
        {
          id: 601,
          title: 'Astropy 官方文档与计算库',
          category: '网站',
          download_url: 'https://astropy.org'
        },
        {
          id: 602,
          title: 'Cosmology 现代宇宙学教材',
          category: '经典教材',
          authors: 'Dodelson',
          download_url: 'https://example.com/cosmology.pdf'
        },
        {
          id: 603,
          title: '无作者专著资料',
          category: '专著',
          download_url: 'https://example.com/book.pdf'
        }
      ]

      // Wide
      const wideHtml = await renderWidget({
        widgetId: 'resources',
        size: 'wide',
        resourcesItems
      })
      // Website card: should display "访问" and NOT "下载资料"
      expect(wideHtml).toContain('访问')
      // Non-website card: should display author
      expect(wideHtml).toContain('Dodelson')
      // Card with no author: should display "下载资料"
      expect(wideHtml).toContain('下载资料')
      // Direct external link with target _blank
      expect(wideHtml).toContain('href="https://astropy.org"')
      expect(wideHtml).toContain('target="_blank"')
      expect(wideHtml).toContain('href="https://example.com/cosmology.pdf"')

      // Medium-Wide
      const mwHtml = await renderWidget({
        widgetId: 'resources',
        size: 'medium-wide',
        resourcesItems: [resourcesItems[0], resourcesItems[2]]
      })
      // Website card in medium-wide must display "访问"
      expect(mwHtml).toContain('访问')
      // Non-website without author should display "下载资料"
      expect(mwHtml).toContain('下载资料')
      expect(mwHtml).toContain('href="https://astropy.org"')
      expect(mwHtml).toContain('target="_blank"')

      // Large
      const largeHtml = await renderWidget({
        widgetId: 'resources',
        size: 'large',
        resourcesItems
      })
      expect(largeHtml).toContain('href="https://astropy.org"')
      expect(largeHtml).toContain('target="_blank"')
    })
  })
})


