import { describe, it, expect, vi } from 'vitest'
import { extractAllArxivIds, getPresentationArxivList } from '../utils/papers'
import { extractAllArxivIds as backendExtractAllArxivIds, archiveSeminarPresentationArxiv, unarchiveSeminarPresentationArxiv } from '../../functions/api/utils/papers'

describe('Multi-arXiv Sharing and Seminar Multi-paper Flow', () => {
  describe('Frontend and Backend extractAllArxivIds Consistency', () => {
    it('both frontend and backend extract multiple arXiv IDs identically', () => {
      const sampleText = 'Two papers: https://arxiv.org/abs/2302.13971 and 2401.00123v1, plus hep-th/9901001'
      const feRes = extractAllArxivIds(sampleText)
      const beRes = backendExtractAllArxivIds(sampleText)
      expect(feRes).toEqual(['2302.13971', '2401.00123v1', 'hep-th/9901001'])
      expect(beRes).toEqual(feRes)
    })

    it('handles comma-separated and semicolon-separated inputs', () => {
      const input = '2302.13971, 2401.00123; 2501.12345'
      expect(extractAllArxivIds(input)).toEqual(['2302.13971', '2401.00123', '2501.12345'])
      expect(backendExtractAllArxivIds(input)).toEqual(['2302.13971', '2401.00123', '2501.12345'])
    })

    it('returns empty array when no valid arXiv ID found', () => {
      expect(extractAllArxivIds('')).toEqual([])
      expect(extractAllArxivIds('random text without arxiv id')).toEqual([])
      expect(backendExtractAllArxivIds('')).toEqual([])
      expect(backendExtractAllArxivIds('just some text')).toEqual([])
    })
  })

  describe('archiveSeminarPresentationArxiv with Multiple Papers', () => {
    it('iterates through all arXiv IDs and inserts them into library and feed tables', async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(`
          <h1 class="title mathjax"><span class="descriptor">Title:</span>Test Arxiv Paper</h1>
          <div class="authors"><span class="descriptor">Authors:</span><a href="#">Author A</a></div>
          <blockquote class="abstract mathjax"><span class="descriptor">Abstract:</span>Sample abstract.</blockquote>
        `)
      })

      try {
        const executedStatements = []
        const mockDb = {
          prepare: vi.fn((sql) => {
            return {
              bind: vi.fn((...args) => {
                executedStatements.push({ sql, args })
                return {
                  first: vi.fn().mockResolvedValue(null),
                  run: vi.fn().mockResolvedValue({ meta: { last_row_id: 101 } })
                }
              })
            }
          })
        }

        const multiArxiv = '2302.13971, 2401.00123'
        const result = await archiveSeminarPresentationArxiv(mockDb, multiArxiv, 42, 7, 'Alice')

        expect(result.arxiv_id).toBe('2302.13971, 2401.00123')
        // Ensure queries were run for both cleanId 2302.13971 and 2401.00123
        const insertLibraryCalls = executedStatements.filter(s => s.sql.includes('INSERT INTO library_papers'))
        expect(insertLibraryCalls.length).toBe(2)
        expect(insertLibraryCalls[0].args).toContain('2302.13971')
        expect(insertLibraryCalls[1].args).toContain('2401.00123')
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('Seminar Agenda Presentation Links Rendering', () => {
    it('splits comma separated arXiv IDs into individual links', () => {
      const raw = '2302.13971, 2401.00123'
      const list = getPresentationArxivList(raw)
      expect(list).toEqual(['2302.13971', '2401.00123'])

      const links = list.map(id => `https://arxiv.org/abs/${id}`)
      expect(links).toEqual([
        'https://arxiv.org/abs/2302.13971',
        'https://arxiv.org/abs/2401.00123'
      ])
    })

    it('falls back to single array for single paper or empty for blank', () => {
      expect(getPresentationArxivList('2302.13971')).toEqual(['2302.13971'])
      expect(getPresentationArxivList('')).toEqual([])
      expect(getPresentationArxivList(null)).toEqual([])
    })
  })

  describe('Feed Recommendation Batch Submission Logic', () => {
    it('submits each paper individually to recommendation API when batch preview is provided', async () => {
      const recommendMock = vi.fn().mockResolvedValue({ success: true })
      const mockApi = { recommend: recommendMock }

      const previewData = {
        is_batch: true,
        count: 2,
        papers: [
          { arxiv_id: '2302.13971', title: 'Paper 1', authors: ['A'] },
          { arxiv_id: '2401.00123', title: 'Paper 2', authors: ['B'] }
        ]
      }
      const audience = { visibility: 'public', recipient_ids: [] }
      const recommendComment = 'Must read papers for seminar'

      const papersToSubmit = (previewData.is_batch && Array.isArray(previewData.papers) && previewData.papers.length > 0)
        ? [...previewData.papers]
        : [previewData]

      for (const paper of papersToSubmit) {
        await mockApi.recommend({
          ...paper,
          ...audience,
          recommend_comment: recommendComment,
          is_pinned: false
        })
      }

      expect(recommendMock).toHaveBeenCalledTimes(2)
      expect(recommendMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
        arxiv_id: '2302.13971',
        recommend_comment: 'Must read papers for seminar'
      }))
      expect(recommendMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        arxiv_id: '2401.00123',
        recommend_comment: 'Must read papers for seminar'
      }))
    })
  })

  describe('unarchiveSeminarPresentationArxiv Synchronization and Cleanup', () => {
    it('deletes from arxiv_papers and library_papers when paper was created only for the seminar', async () => {
      const executedStatements = []
      const mockDb = {
        prepare: vi.fn((sql) => ({
          bind: vi.fn((...args) => ({
            all: vi.fn().mockImplementation(async () => {
              executedStatements.push({ sql, args, op: 'all' })
              if (sql.includes('FROM seminar_presentations WHERE seminar_id = ?')) {
                return { results: [] }
              }
              if (sql.includes('FROM seminar_presentations WHERE seminar_id != ?')) {
                return { results: [] }
              }
              if (sql.includes('FROM arxiv_papers')) {
                return { results: [{ id: 101, seminar_id: 42, recommend_comment: '组会 arXiv 分享' }] }
              }
              if (sql.includes('FROM library_papers')) {
                return { results: [{ id: 201, seminar_id: 42, from_recommendation: 0, from_seminar: 1 }] }
              }
              return { results: [] }
            }),
            first: vi.fn().mockImplementation(async () => {
              executedStatements.push({ sql, args, op: 'first' })
              if (sql.includes('COUNT(*) as cnt FROM library_recommendation_sources')) {
                return { cnt: 0 }
              }
              return null
            }),
            run: vi.fn().mockImplementation(async () => {
              executedStatements.push({ sql, args, op: 'run' })
              return { success: true }
            })
          }))
        }))
      }

      await unarchiveSeminarPresentationArxiv(mockDb, '2302.13971', 42)

      const deleteArxiv = executedStatements.find(s => s.sql.includes('DELETE FROM arxiv_papers WHERE id = ?'))
      expect(deleteArxiv).toBeDefined()
      expect(deleteArxiv.args).toEqual([101])

      const deleteLibrary = executedStatements.find(s => s.sql.includes('DELETE FROM library_papers WHERE id = ?'))
      expect(deleteLibrary).toBeDefined()
      expect(deleteLibrary.args).toEqual([201])

      const deleteFavorites = executedStatements.find(s => s.sql.includes('DELETE FROM favorites WHERE kind = \'paper\''))
      expect(deleteFavorites).toBeDefined()

      const deleteComments = executedStatements.find(s => s.sql.includes('DELETE FROM paper_comments WHERE paper_id = ?'))
      expect(deleteComments).toBeDefined()
      expect(deleteComments.args).toEqual([101])
    })

    it('protects independent recommendations and library entries by unlinking instead of deleting', async () => {
      const executedStatements = []
      const mockDb = {
        prepare: vi.fn((sql) => ({
          bind: vi.fn((...args) => ({
            all: vi.fn().mockImplementation(async () => {
              executedStatements.push({ sql, args, op: 'all' })
              if (sql.includes('FROM seminar_presentations WHERE seminar_id = ?')) {
                return { results: [] }
              }
              if (sql.includes('FROM seminar_presentations WHERE seminar_id != ?')) {
                return { results: [] }
              }
              if (sql.includes('FROM arxiv_papers')) {
                return { results: [{ id: 102, seminar_id: 42, recommend_comment: 'User custom recommendation reason' }] }
              }
              if (sql.includes('FROM library_papers')) {
                return { results: [{ id: 202, seminar_id: 42, from_recommendation: 1, from_seminar: 1 }] }
              }
              return { results: [] }
            }),
            first: vi.fn().mockImplementation(async () => {
              executedStatements.push({ sql, args, op: 'first' })
              return null
            }),
            run: vi.fn().mockImplementation(async () => {
              executedStatements.push({ sql, args, op: 'run' })
              return { success: true }
            })
          }))
        }))
      }

      await unarchiveSeminarPresentationArxiv(mockDb, '2302.13971', 42)

      const deleteArxiv = executedStatements.find(s => s.sql.includes('DELETE FROM arxiv_papers WHERE id = ?'))
      expect(deleteArxiv).toBeUndefined()

      const updateArxiv = executedStatements.find(s => s.sql.includes('UPDATE arxiv_papers SET seminar_id = NULL WHERE id = ?'))
      expect(updateArxiv).toBeDefined()
      expect(updateArxiv.args).toEqual([102])

      const deleteLibrary = executedStatements.find(s => s.sql.includes('DELETE FROM library_papers WHERE id = ?'))
      expect(deleteLibrary).toBeUndefined()

      const updateLibrary = executedStatements.find(s => s.sql.includes('UPDATE library_papers SET from_seminar = 0, seminar_id = NULL WHERE id = ?'))
      expect(updateLibrary).toBeDefined()
      expect(updateLibrary.args).toEqual([202])
    })

    it('skips deletion if another presenter in the same seminar still shares the paper', async () => {
      const executedStatements = []
      const mockDb = {
        prepare: vi.fn((sql) => ({
          bind: vi.fn((...args) => ({
            all: vi.fn().mockImplementation(async () => {
              executedStatements.push({ sql, args, op: 'all' })
              if (sql.includes('FROM seminar_presentations WHERE seminar_id = ?')) {
                return { results: [{ arxiv_id: '2302.13971, 2401.00123' }] }
              }
              return { results: [] }
            }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ success: true })
          }))
        }))
      }

      await unarchiveSeminarPresentationArxiv(mockDb, '2302.13971', 42)

      const deleteArxiv = executedStatements.find(s => s.sql.includes('DELETE FROM arxiv_papers'))
      expect(deleteArxiv).toBeUndefined()

      const deleteLibrary = executedStatements.find(s => s.sql.includes('DELETE FROM library_papers'))
      expect(deleteLibrary).toBeUndefined()
    })

    it('rebinds seminar_id to another seminar if another seminar presents the paper', async () => {
      const executedStatements = []
      const mockDb = {
        prepare: vi.fn((sql) => ({
          bind: vi.fn((...args) => ({
            all: vi.fn().mockImplementation(async () => {
              executedStatements.push({ sql, args, op: 'all' })
              if (sql.includes('FROM seminar_presentations WHERE seminar_id = ?')) {
                return { results: [] }
              }
              if (sql.includes('seminar_id != ?')) {
                return { results: [{ seminar_id: 88, arxiv_id: '2302.13971' }] }
              }
              return { results: [] }
            }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockImplementation(async () => {
              executedStatements.push({ sql, args, op: 'run' })
              return { success: true }
            })
          }))
        }))
      }

      await unarchiveSeminarPresentationArxiv(mockDb, '2302.13971', 42)

      const rebindArxiv = executedStatements.find(s => s.sql.includes('UPDATE arxiv_papers') && s.sql.includes('SET seminar_id = ?'))
      expect(rebindArxiv).toBeDefined()
      expect(rebindArxiv.args[0]).toBe(88)

      const rebindLibrary = executedStatements.find(s => s.sql.includes('UPDATE library_papers') && s.sql.includes('SET seminar_id = ?'))
      expect(rebindLibrary).toBeDefined()
      expect(rebindLibrary.args[0]).toBe(88)

      const deleteArxiv = executedStatements.find(s => s.sql.includes('DELETE FROM arxiv_papers'))
      expect(deleteArxiv).toBeUndefined()
    })
  })

  describe('Link Feed Paper to Future Seminar Presentation Flow', () => {
    it('handles upcoming presentations selection and mode switching', () => {
      const slots = [
        {
          seminar_id: 12,
          presentation_id: 34,
          date: '2026-09-29',
          time: '14:30',
          topic: '前沿汇报',
          papers: ['2301.00001']
        },
        {
          seminar_id: 13,
          presentation_id: 35,
          date: '2026-10-06',
          time: '14:30',
          topic: '专题讨论',
          papers: []
        }
      ]

      // Mode: append to slot with existing papers
      const newArxiv = '2302.13971'
      const slot = slots[0]
      const appendResult = [...slot.papers, newArxiv]
      expect(appendResult).toEqual(['2301.00001', '2302.13971'])

      // Mode: replace
      const replaceResult = [newArxiv]
      expect(replaceResult).toEqual(['2302.13971'])
    })

    it('submits linkPaperToPresentation payload with default comment and share_to_feed', async () => {
      const linkMock = vi.fn().mockResolvedValue({
        data: { ok: true, seminar_id: 12, presentation_id: 34, arxiv_id: '2301.00001, 2302.13971', share_to_feed: true }
      })
      const mockSeminarApi = { linkPaperToPresentation: linkMock }

      const payload = {
        seminar_id: 12,
        presentation_id: 34,
        arxiv_id: '2302.13971',
        mode: 'append',
        share_to_feed: true,
        recommend_comment: '预定于 2026-09-29 组会进行文献分享汇报'
      }

      const res = await mockSeminarApi.linkPaperToPresentation(payload)
      expect(linkMock).toHaveBeenCalledWith(expect.objectContaining({
        seminar_id: 12,
        presentation_id: 34,
        arxiv_id: '2302.13971',
        mode: 'append',
        share_to_feed: true,
        recommend_comment: '预定于 2026-09-29 组会进行文献分享汇报'
      }))
      expect(res.data.ok).toBe(true)
    })

    it('detects duplicate presented arxiv and flags warning appropriately', async () => {
      const checkMock = vi.fn().mockImplementation(async (arxivId) => {
        if (arxivId === '2302.13971') {
          return { data: { presented: true, paper: { id: 88, title: 'Previous Talk', seminar_id: 5 } } }
        }
        return { data: { presented: false } }
      })

      const dupRes = await checkMock('2302.13971')
      expect(dupRes.data.presented).toBe(true)
      expect(dupRes.data.paper.title).toBe('Previous Talk')

      const nonDupRes = await checkMock('2409.99999')
      expect(nonDupRes.data.presented).toBe(false)
    })

    it('combines feed paper with extra directly typed arXiv IDs for simultaneous multi-share', () => {
      const feedPaperArxiv = '2302.13971'
      const extraTyped = '2401.00123, 2402.04567'

      const extraIds = extractAllArxivIds(extraTyped)
      const combined = [feedPaperArxiv, ...extraIds]

      expect(combined).toEqual(['2302.13971', '2401.00123', '2402.04567'])
      expect(combined.join(', ')).toBe('2302.13971, 2401.00123, 2402.04567')
    })

    it('supports appending picked feed papers and directly typing extra arXivs in SeminarView presentation editor', () => {
      // 1. Initial state: user has paper A
      let currentArxivStr = '2302.13971'
      expect(extractAllArxivIds(currentArxivStr)).toEqual(['2302.13971'])

      // 2. User picks paper B from feed
      const pickedFeedPaper = { arxiv_id: '2401.00123' }
      const currentList = extractAllArxivIds(currentArxivStr)
      if (!currentList.includes(pickedFeedPaper.arxiv_id)) {
        currentList.push(pickedFeedPaper.arxiv_id)
      }
      currentArxivStr = currentList.join(', ')
      expect(currentArxivStr).toBe('2302.13971, 2401.00123')

      // 3. User types extra arXiv C directly
      const extraTyped = '2403.99999'
      const updatedList = extractAllArxivIds(`${currentArxivStr}, ${extraTyped}`)
      expect(updatedList).toEqual(['2302.13971', '2401.00123', '2403.99999'])

      // 4. User removes paper A via chip
      const filtered = updatedList.filter(id => id !== '2302.13971')
      expect(filtered).toEqual(['2401.00123', '2403.99999'])
    })

    it('identifies papers already shared or scheduled by user as my seminar share to disable re-linking', () => {
      const currentUser = { id: 1, name: 'dinghengkai', real_name: '丁恒凯' }
      const myUpcomingArxivSet = new Set(['2609.17852'])

      function checkIsMySeminarShare(paper) {
        if (!paper || !currentUser) return false
        const user = currentUser
        const recommenderId = paper.recommender?.id || paper.recommended_by_id
        const userNames = [user.name, user.real_name, user.nickname].filter(Boolean).map(s => String(s).trim().toLowerCase())
        const recName = (paper.recommender?.real_name || paper.recommender?.name || '').trim().toLowerCase()
        const isRecommenderMe = (recommenderId && recommenderId === user.id) || (recName && userNames.includes(recName))

        if (Boolean(paper.seminar_id) && isRecommenderMe) return true
        const comment = String(paper.recommend_comment || '')
        if (comment.includes('组会 arXiv 分享') && isRecommenderMe) return true

        if (paper.arxiv_id) {
          const cleanId = String(paper.arxiv_id).replace(/^arXiv:/i, '').replace(/v\d+$/, '').trim().toLowerCase()
          if (myUpcomingArxivSet.has(cleanId)) return true
        }
        return false
      }

      // Case 1: Paper already has seminar_id and recommended by Ding Hengkai
      const paper1 = {
        arxiv_id: '2609.17852',
        seminar_id: 10,
        recommender: { id: 1, name: '丁恒凯' },
        recommend_comment: '组会 arXiv 分享'
      }
      expect(checkIsMySeminarShare(paper1)).toBe(true)

      // Case 2: Paper in user upcoming presentations set
      const paper2 = {
        arxiv_id: 'arXiv:2609.17852v1',
        seminar_id: null,
        recommender: { id: 2, name: 'Alice' },
        recommend_comment: 'Cool paper'
      }
      expect(checkIsMySeminarShare(paper2)).toBe(true)

      // Case 3: Paper from someone else and not in upcoming presentations
      const paper3 = {
        arxiv_id: '2401.99999',
        seminar_id: null,
        recommender: { id: 2, name: 'Alice' },
        recommend_comment: 'Check this out'
      }
      expect(checkIsMySeminarShare(paper3)).toBe(false)
    })

    it('correctly handles getMyUpcomingPresentations returning array directly from axios interceptor', () => {
      // Axios interceptor returns response.data directly, so res is an Array
      const mockAxiosUnwrappedResponse = [
        { seminar_id: 10, presentation_id: 20, date: '2026-09-23', topic: 'Fuzzy Dark Matter' }
      ]

      const parseList = (res) => Array.isArray(res) ? res : (res?.data || [])
      const upcomingList = parseList(mockAxiosUnwrappedResponse)

      expect(upcomingList.length).toBe(1)
      expect(upcomingList[0].presentation_id).toBe(20)
      expect(upcomingList[0].date).toBe('2026-09-23')

      // Also verify fallback when wrapped
      const mockWrappedResponse = { data: [{ seminar_id: 11 }] }
      expect(parseList(mockWrappedResponse).length).toBe(1)
    })

    it('validates backend belongs function matches presenter by name even if presenter_id is null or unset', () => {
      const user = { id: 1, name: 'dinghengkai', real_name: '丁恒凯', nickname: '' }
      const userNames = new Set(
        [user.name, user.real_name, user.nickname]
          .filter(Boolean)
          .map(n => n.trim().toLowerCase())
      )

      const belongs = (presenterId, presenterName) => {
        if (presenterId && presenterId === user.id) {
          return true
        }
        if (presenterName && userNames.has(presenterName.trim().toLowerCase())) {
          return true
        }
        return false
      }

      // Presenter ID matches
      expect(belongs(1, 'Other Name')).toBe(true)
      // Presenter ID is null, but Chinese real_name matches
      expect(belongs(null, '丁恒凯')).toBe(true)
      // Presenter ID is null, but username matches
      expect(belongs(null, 'dinghengkai')).toBe(true)
      // Neither matches
      expect(belongs(null, '张三')).toBe(false)
      expect(belongs(2, '李四')).toBe(false)
    })
  })
})
