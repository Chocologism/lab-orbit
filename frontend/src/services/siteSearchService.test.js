import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  tokenizeQuery,
  hasPlatformSearchIntent,
  invalidateSearchCache,
  searchAllPlatformData,
  searchLiterature,
  searchNoticesAndEmails,
  searchSchedule,
  searchResources
} from './siteSearchService.js'
import {
  PLATFORM_KNOWLEDGE_PROMPT,
  formatSearchResultsForPrompt
} from './aiService.js'
import {
  arxivApi,
  libraryApi,
  noticeApi,
  mailboxApi,
  seminarApi,
  talkApi,
  resourceApi
} from '../api/client.js'

vi.mock('../api/client.js', () => ({
  arxivApi: {
    getFeed: vi.fn()
  },
  libraryApi: {
    list: vi.fn()
  },
  noticeApi: {
    list: vi.fn()
  },
  mailboxApi: {
    getEmails: vi.fn()
  },
  seminarApi: {
    getSeminars: vi.fn()
  },
  talkApi: {
    list: vi.fn()
  },
  resourceApi: {
    getBooks: vi.fn()
  }
}))

describe('siteSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateSearchCache()
  })

  describe('tokenizeQuery', () => {
    it('should filter stop words and extract relevant tokens', () => {
      const tokens = tokenizeQuery('帮我查一下关于黑洞吸积盘的论文')
      expect(tokens).toContain('黑洞吸积盘')
      // 中文 n-gram
      expect(tokens).toContain('黑洞')
      expect(tokens).toContain('吸积')
      expect(tokens).not.toContain('帮我')
      expect(tokens).not.toContain('查一下')
      expect(tokens).not.toContain('关于')
      expect(tokens).not.toContain('的')
    })

    it('should handle English and mixed tokens', () => {
      const tokens = tokenizeQuery('Search for arXiv 2609.12345 accretion disk')
      expect(tokens).toContain('search')
      expect(tokens).toContain('arxiv')
      expect(tokens).toContain('2609.12345')
      expect(tokens).toContain('accretion')
      expect(tokens).toContain('disk')
      expect(tokens).not.toContain('for')
    })
  })

  describe('hasPlatformSearchIntent', () => {
    it('should identify platform navigation and query intent', () => {
      expect(hasPlatformSearchIntent('这网站怎么用？各个功能入口在哪？')).toBe(true)
      expect(hasPlatformSearchIntent('帮我检索文献推荐流中的高能天体物理论文')).toBe(true)
      expect(hasPlatformSearchIntent('查一下文献库里有没有关于磁场重联的文章')).toBe(true)
      expect(hasPlatformSearchIntent('最近有什么重要教务通知或者邮件？')).toBe(true)
      expect(hasPlatformSearchIntent('下一场周会是谁汇报？什么时候？')).toBe(true)
      expect(hasPlatformSearchIntent('资料库里有电动力学的卡片吗？')).toBe(true)
      expect(hasPlatformSearchIntent('搜索一下学术报告安排')).toBe(true)
    })

    it('should return false for pure physics/math derivation or unrelated chat', () => {
      expect(hasPlatformSearchIntent('推导麦克斯韦方程组在弯曲时空中的形式')).toBe(false)
      expect(hasPlatformSearchIntent('写一个 Python 脚本计算 Runge-Kutta 4 阶积分')).toBe(false)
      expect(hasPlatformSearchIntent('你好')).toBe(false)
      expect(hasPlatformSearchIntent('')).toBe(false)
    })
  })

  describe('formatSearchResultsForPrompt & PLATFORM_KNOWLEDGE_PROMPT', () => {
    it('PLATFORM_KNOWLEDGE_PROMPT should cover all 8 modules and hyperlinks', () => {
      expect(PLATFORM_KNOWLEDGE_PROMPT).toContain('/arxiv')
      expect(PLATFORM_KNOWLEDGE_PROMPT).toContain('/library')
      expect(PLATFORM_KNOWLEDGE_PROMPT).toContain('/seminars')
      expect(PLATFORM_KNOWLEDGE_PROMPT).toContain('/resources')
      expect(PLATFORM_KNOWLEDGE_PROMPT).toContain('/notices')
      expect(PLATFORM_KNOWLEDGE_PROMPT).toContain('/mailbox')
      expect(PLATFORM_KNOWLEDGE_PROMPT).toContain('/assistant')
    })

    it('formatSearchResultsForPrompt should produce structured markdown with internal links', () => {
      const mockResults = [
        {
          id: 1,
          type: 'literature_feed',
          title: '黑洞吸积盘磁重联数值模拟',
          authors: '张三, 李四',
          arxiv_id: 'arXiv:2609.99999',
          recommender: '推荐人: 王教授',
          comment: '推荐理由: 前沿研究',
          detail: '利用 3D GRMHD 模拟研究磁重联过程',
          link: '/arxiv?paper_id=1'
        },
        {
          id: 10,
          type: 'notice',
          title: '【通知】2026年秋季学期学业奖学金申报通知',
          meta: '分类: 教务 | 日期: 2026-09-20',
          detail: '请各位研究生于本周五前完成系统填报',
          link: '/notices?id=10'
        }
      ]

      const formatted = formatSearchResultsForPrompt(mockResults)
      expect(formatted).toContain('【推荐流文献】 黑洞吸积盘磁重联数值模拟')
      expect(formatted).toContain('可点击超链接: [黑洞吸积盘磁重联数值模拟](/arxiv?paper_id=1)')
      expect(formatted).toContain('【重要通知】 【通知】2026年秋季学期学业奖学金申报通知')
      expect(formatted).toContain('可点击超链接: [【通知】2026年秋季学期学业奖学金申报通知](/notices?id=10)')
      expect(formatted).toContain('推荐人: 王教授')
      expect(formatted).toContain('arXiv: arXiv:2609.99999')
    })
  })

  describe('searchAllPlatformData and caching', () => {
    it('should aggregate matches across multiple domains and cache results', async () => {
      arxivApi.getFeed.mockResolvedValue([
        {
          id: 101,
          arxiv_id: '2609.11111',
          title: 'Relativistic Jet Formation in AGNs',
          title_zh: '活动星系核中的相对论性喷流形成',
          authors: ['Alice', 'Bob'],
          abstract: 'We perform 3D simulations of jets in AGNs.'
        }
      ])
      libraryApi.list.mockResolvedValue([])
      noticeApi.list.mockResolvedValue([
        {
          id: 201,
          title: '关于相对论天体物理讲座的通知',
          content: '本周五下午在物理楼举办讲座。',
          category: 'academic'
        }
      ])
      mailboxApi.getEmails.mockResolvedValue([])
      seminarApi.getSeminars.mockResolvedValue([
        {
          id: 301,
          topic: 'Jet Simulation',
          presenter_name: 'Alice',
          location: '理化大楼 1001',
          date: '2026-10-01'
        }
      ])
      talkApi.list.mockResolvedValue([])
      resourceApi.getBooks.mockResolvedValue([
        {
          id: 'card-1',
          title: 'Relativistic Hydrodynamics Notes',
          category: 'course_notes',
          description: '相对论流体力学精读与代码'
        }
      ])

      const results = await searchAllPlatformData('相对论 喷流')
      expect(results.length).toBeGreaterThan(0)
      const feedHit = results.find(r => r.id === 101)
      expect(feedHit).toBeDefined()
      expect(feedHit.link).toBe('/arxiv?paper_id=101')

      const noticeHit = results.find(r => r.id === 201)
      expect(noticeHit).toBeDefined()
      expect(noticeHit.link).toBe('/notices?id=201')

      // 验证内存缓存生效：再次检索相同域时不会重新调用 API
      expect(arxivApi.getFeed).toHaveBeenCalledTimes(1)
      expect(noticeApi.list).toHaveBeenCalledTimes(1)

      await searchAllPlatformData('相对论')
      expect(arxivApi.getFeed).toHaveBeenCalledTimes(1)
      expect(noticeApi.list).toHaveBeenCalledTimes(1)
    })
  })
})
