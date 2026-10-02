import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveUserScope } from '../utils/userScope.js'
import {
  AI_SESSIONS_STORAGE_KEY,
  AI_ACTIVE_SESSION_ID_KEY,
  AI_CHAT_HISTORY_KEY,
  getAiSessionsStorageKey,
  getAiActiveSessionIdKey,
  loadAiSessions,
  saveAiSessions,
  loadActiveSessionId,
  saveActiveSessionId,
  clearAllAiSessions,
  createDefaultSession
} from './aiService.js'
import {
  RECENT_PAPERS_STORAGE_KEY,
  getRecentPapersStorageKey,
  getRecentArxivPapers,
  saveRecentArxivPaper
} from '../utils/arxivHtml.js'

describe('User Scope & AI Chat Session Isolation Suite', () => {
  let mockStorage = {}

  beforeEach(() => {
    mockStorage = {}
    global.localStorage = {
      getItem: vi.fn(k => mockStorage[k] ?? null),
      setItem: vi.fn((k, v) => { mockStorage[k] = String(v) }),
      removeItem: vi.fn(k => { delete mockStorage[k] }),
      clear: vi.fn(() => { mockStorage = {} })
    }
  })

  describe('resolveUserScope helper', () => {
    it('resolves explicit string or numeric scopes', () => {
      expect(resolveUserScope('user_101')).toBe('user_101')
      expect(resolveUserScope(42)).toBe('42')
      expect(resolveUserScope('   ')).toBe('')
    })

    it('resolves user object with id, username or email', () => {
      expect(resolveUserScope({ id: 101, username: 'alice' })).toBe('101')
      expect(resolveUserScope({ username: 'bob', email: 'bob@example.edu' })).toBe('bob')
      expect(resolveUserScope({ email: 'carol@example.edu' })).toBe('carol@example.edu')
    })

    it('falls back to localStorage laborbit_user / labhub_user when argument omitted', () => {
      mockStorage['laborbit_user'] = JSON.stringify({ id: 888, username: 'testuser' })
      expect(resolveUserScope()).toBe('888')

      delete mockStorage['laborbit_user']
      mockStorage['labhub_user'] = JSON.stringify({ username: 'lab_member' })
      expect(resolveUserScope()).toBe('lab_member')
    })

    it('returns empty string when unauthenticated/guest', () => {
      expect(resolveUserScope()).toBe('')
      expect(resolveUserScope(null)).toBe('')
    })
  })

  describe('Dynamic Storage Keys', () => {
    it('generates user-scoped storage keys when scope exists', () => {
      expect(getAiSessionsStorageKey('userA')).toBe('laborbit_ai_chat_sessions_userA')
      expect(getAiActiveSessionIdKey('userA')).toBe('laborbit_ai_active_session_id_userA')
      expect(getRecentPapersStorageKey('userA')).toBe('laborbit_arxiv_recent_papers_userA')
    })

    it('falls back to default global keys when no user scope exists', () => {
      expect(getAiSessionsStorageKey('')).toBe(AI_SESSIONS_STORAGE_KEY)
      expect(getAiActiveSessionIdKey('')).toBe(AI_ACTIVE_SESSION_ID_KEY)
      expect(getRecentPapersStorageKey('')).toBe(RECENT_PAPERS_STORAGE_KEY)
    })
  })

  describe('Multi-Account AI Session Sandbox Isolation', () => {
    it('isolates chat sessions completely between User A and User B', () => {
      const userA = { id: 'user_A', username: 'Researcher A' }
      const userB = { id: 'user_B', username: 'Researcher B' }

      // 1. User A 创建并保存会话
      const sessionA = {
        id: 'session_A_1',
        title: '宇宙学红移推演',
        createdAt: 1000,
        updatedAt: 1000,
        messages: [{ role: 'user', content: '请问宇宙膨胀速率 H0 最新的测量张力如何解释？' }]
      }
      saveAiSessions([sessionA], userA)
      saveActiveSessionId('session_A_1', userA)

      // 验证 User A 的会话确实存在
      const loadedA = loadAiSessions(userA)
      expect(loadedA).toHaveLength(1)
      expect(loadedA[0].title).toBe('宇宙学红移推演')
      expect(loadActiveSessionId(userA)).toBe('session_A_1')

      // 2. User B 首次登录读取会话：应当是全新的空白沙箱，绝无 User A 的任何记录
      const loadedB = loadAiSessions(userB)
      expect(loadedB).toHaveLength(1)
      expect(loadedB[0].title).toBe('新对话')
      expect(loadedB[0].messages).toEqual([])
      expect(loadActiveSessionId(userB)).toBe('')

      // 3. User B 进行独立的提问并保存
      const sessionB = {
        id: 'session_B_1',
        title: '蛋白质结构预测',
        createdAt: 2000,
        updatedAt: 2000,
        messages: [{ role: 'user', content: 'AlphaFold3 的扩散模型架构' }]
      }
      saveAiSessions([sessionB], userB)
      saveActiveSessionId('session_B_1', userB)

      // 4. 切回 User A：User A 的记录完全保持原样，未被 User B 覆盖
      const reloadedA = loadAiSessions(userA)
      expect(reloadedA).toHaveLength(1)
      expect(reloadedA[0].id).toBe('session_A_1')
      expect(reloadedA[0].title).toBe('宇宙学红移推演')
      expect(loadActiveSessionId(userA)).toBe('session_A_1')

      // 5. 切回 User B：User B 的记录同样独立完好
      const reloadedB = loadAiSessions(userB)
      expect(reloadedB).toHaveLength(1)
      expect(reloadedB[0].id).toBe('session_B_1')
      expect(reloadedB[0].title).toBe('蛋白质结构预测')
      expect(loadActiveSessionId(userB)).toBe('session_B_1')
    })

    it('smoothly migrates legacy un-scoped global sessions to the first logged-in user', () => {
      const legacySessions = [
        {
          id: 'legacy_session_1',
          title: '原先未隔离的研讨记录',
          createdAt: 500,
          updatedAt: 500,
          messages: [{ role: 'user', content: '引力透镜建模' }]
        }
      ]
      mockStorage[AI_SESSIONS_STORAGE_KEY] = JSON.stringify(legacySessions)
      mockStorage[AI_ACTIVE_SESSION_ID_KEY] = 'legacy_session_1'

      const userA = { id: 'migrated_user_1' }

      // 首次载入 userA
      const migrated = loadAiSessions(userA)
      expect(migrated).toHaveLength(1)
      expect(migrated[0].title).toBe('原先未隔离的研讨记录')
      expect(loadActiveSessionId(userA)).toBe('legacy_session_1')

      // 验证旧版全局键已被清理，避免第二个账号拾取旧记录
      expect(mockStorage[AI_SESSIONS_STORAGE_KEY]).toBeUndefined()
      expect(mockStorage[AI_ACTIVE_SESSION_ID_KEY]).toBeUndefined()

      // 第二个用户 userB 登录进入时，不会读到该旧记录
      const userB = { id: 'new_user_2' }
      const sessionsB = loadAiSessions(userB)
      expect(sessionsB).toHaveLength(1)
      expect(sessionsB[0].title).toBe('新对话')
      expect(sessionsB[0].messages).toEqual([])
    })

    it('smoothly migrates legacy single chat history format (AI_CHAT_HISTORY_KEY)', () => {
      const legacyMsgs = [
        { role: 'user', content: '早期单条会话历史', timestamp: 100 },
        { role: 'assistant', content: '回答内容', timestamp: 200 }
      ]
      mockStorage[AI_CHAT_HISTORY_KEY] = JSON.stringify(legacyMsgs)

      const user = { id: 'single_migrated_user' }
      const loaded = loadAiSessions(user)

      expect(loaded).toHaveLength(1)
      expect(loaded[0].title).toBe('早期单条会话历史')
      expect(loaded[0].messages).toHaveLength(2)
      expect(mockStorage[AI_CHAT_HISTORY_KEY]).toBeUndefined()
    })

    it('clears only the current user session sandbox when clearAllAiSessions is called', () => {
      const userA = { id: 'user_A' }
      const userB = { id: 'user_B' }

      saveAiSessions([{ id: 'sA', title: 'User A Session', messages: [] }], userA)
      saveAiSessions([{ id: 'sB', title: 'User B Session', messages: [] }], userB)

      clearAllAiSessions(userA)

      // User A 已清空
      expect(mockStorage[getAiSessionsStorageKey(userA)]).toBeUndefined()
      // User B 的会话毫发无损
      expect(mockStorage[getAiSessionsStorageKey(userB)]).toBeDefined()
    })
  })

  describe('Recent Arxiv Papers User Isolation', () => {
    it('isolates recent papers per user and smoothly migrates legacy papers', () => {
      const userA = { id: 'user_A' }
      const userB = { id: 'user_B' }

      // 遗留旧全局数据
      mockStorage[RECENT_PAPERS_STORAGE_KEY] = JSON.stringify([
        { id: '2312.00752', title: 'Legacy Paper', timestamp: 100 }
      ])

      // User A 载入并继承旧数据
      const recentsA = getRecentArxivPapers(userA)
      expect(recentsA).toHaveLength(1)
      expect(recentsA[0].id).toBe('2312.00752')

      // 旧全局键已迁移清理
      expect(mockStorage[RECENT_PAPERS_STORAGE_KEY]).toBeUndefined()

      // User A 保存新论文
      saveRecentArxivPaper('2401.00001', 'User A Exclusive Paper', userA)
      expect(getRecentArxivPapers(userA)).toHaveLength(2)

      // User B 查看最近文献为空
      expect(getRecentArxivPapers(userB)).toHaveLength(0)

      // User B 保存自己的文献
      saveRecentArxivPaper('2402.99999', 'User B Paper', userB)
      expect(getRecentArxivPapers(userB)).toHaveLength(1)
      expect(getRecentArxivPapers(userB)[0].id).toBe('2402.99999')

      // User A 文献列表保持独立
      expect(getRecentArxivPapers(userA)).toHaveLength(2)
      expect(getRecentArxivPapers(userA)[0].id).toBe('2401.00001')
    })
  })
})
