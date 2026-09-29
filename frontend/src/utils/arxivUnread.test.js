import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateArxivUnread, getCachedArxivUnread, broadcastArxivUnread, clearArxivUnread, ARXIV_UNREAD_EVENT } from './arxivUnread'

describe('arxivUnread utilities', () => {
  const currentUserId = 42

  it('returns 0 unread and false hasDirect for empty or invalid feed', () => {
    expect(calculateArxivUnread([], currentUserId)).toEqual({ unreadCount: 0, hasDirect: false })
    expect(calculateArxivUnread(null, currentUserId)).toEqual({ unreadCount: 0, hasDirect: false })
    expect(calculateArxivUnread([], null)).toEqual({ unreadCount: 0, hasDirect: false })
  })

  it('does not count papers recommended by the current user themselves', () => {
    const papers = [
      {
        id: 1,
        recommended_by_id: 42,
        is_read_by_me: false,
        visibility: 'public'
      },
      {
        id: 2,
        recommender: { id: 42 },
        is_read_by_me: false,
        visibility: 'direct',
        recipients: [{ id: 42 }]
      }
    ]
    const result = calculateArxivUnread(papers, currentUserId)
    expect(result).toEqual({ unreadCount: 0, hasDirect: false })
  })

  it('does not count papers already marked as read', () => {
    const papers = [
      {
        id: 1,
        recommended_by_id: 99,
        is_read_by_me: true,
        visibility: 'public'
      },
      {
        id: 2,
        recommended_by_id: 99,
        is_read_by_me: true,
        visibility: 'direct',
        recipients: [{ id: 42 }]
      }
    ]
    const result = calculateArxivUnread(papers, currentUserId)
    expect(result).toEqual({ unreadCount: 0, hasDirect: false })
  })

  it('returns unreadCount with hasDirect: false for public recommendations only (red badge)', () => {
    const papers = [
      {
        id: 1,
        recommended_by_id: 99,
        is_read_by_me: false,
        visibility: 'public'
      },
      {
        id: 2,
        recommended_by_id: 100,
        is_read_by_me: false,
        visibility: 'public'
      }
    ]
    const result = calculateArxivUnread(papers, currentUserId)
    expect(result).toEqual({ unreadCount: 2, hasDirect: false })
  })

  it('returns hasDirect: true when there is a direct recommendation targeted to current user (gold badge)', () => {
    const papers = [
      {
        id: 1,
        recommended_by_id: 99,
        is_read_by_me: false,
        visibility: 'public'
      },
      {
        id: 2,
        recommended_by_id: 100,
        is_read_by_me: false,
        visibility: 'direct',
        recipients: [{ id: 42 }, { id: 43 }]
      }
    ]
    const result = calculateArxivUnread(papers, currentUserId)
    expect(result).toEqual({ unreadCount: 2, hasDirect: true })
  })

  it('ignores direct recommendations targeted to others where current user is not a recipient', () => {
    const papers = [
      {
        id: 1,
        recommended_by_id: 99,
        is_read_by_me: false,
        visibility: 'public'
      },
      {
        id: 2,
        recommended_by_id: 100,
        is_read_by_me: false,
        visibility: 'direct',
        recipients: [{ id: 999 }]
      }
    ]
    const result = calculateArxivUnread(papers, currentUserId)
    expect(result).toEqual({ unreadCount: 1, hasDirect: false })
  })

  it('switches hasDirect back to false when user has read the direct recommendation but public remains unread', () => {
    const papers = [
      {
        id: 1,
        recommended_by_id: 99,
        is_read_by_me: false,
        visibility: 'public'
      },
      {
        id: 2,
        recommended_by_id: 100,
        is_read_by_me: true, // read
        visibility: 'direct',
        recipients: [{ id: 42 }]
      }
    ]
    const result = calculateArxivUnread(papers, currentUserId)
    expect(result).toEqual({ unreadCount: 1, hasDirect: false })
  })

  let store = {}
  let listeners = {}

  beforeEach(() => {
    store = {}
    listeners = {}
    global.localStorage = {
      getItem: vi.fn(key => (store[key] !== undefined ? store[key] : null)),
      setItem: vi.fn((key, val) => {
        store[key] = String(val)
      }),
      removeItem: vi.fn(key => {
        delete store[key]
      }),
      clear: vi.fn(() => {
        store = {}
      })
    }
    global.window = {
      addEventListener: vi.fn((ev, cb) => {
        if (!listeners[ev]) listeners[ev] = []
        listeners[ev].push(cb)
      }),
      removeEventListener: vi.fn((ev, cb) => {
        if (listeners[ev]) {
          listeners[ev] = listeners[ev].filter(l => l !== cb)
        }
      }),
      dispatchEvent: vi.fn(event => {
        const cbs = listeners[event.type] || []
        cbs.forEach(cb => cb(event))
        return true
      })
    }
    global.CustomEvent = class CustomEvent {
      constructor(type, eventInitDict) {
        this.type = type
        this.detail = eventInitDict?.detail
      }
    }
  })

  it('broadcasts unread event and stores summary in localStorage', () => {
    const eventSpy = vi.fn()
    global.window.addEventListener(ARXIV_UNREAD_EVENT, eventSpy)

    broadcastArxivUnread({ unreadCount: 5, hasDirect: true })

    expect(eventSpy).toHaveBeenCalled()
    const cached = getCachedArxivUnread()
    expect(cached).toEqual({ unreadCount: 5, hasDirect: true })

    global.window.removeEventListener(ARXIV_UNREAD_EVENT, eventSpy)
  })

  it('clears unread badge count and direct state to 0 and broadcasts event', () => {
    // First set some unread
    broadcastArxivUnread({ unreadCount: 3, hasDirect: true })
    expect(getCachedArxivUnread()).toEqual({ unreadCount: 3, hasDirect: true })

    const eventSpy = vi.fn()
    global.window.addEventListener(ARXIV_UNREAD_EVENT, eventSpy)

    const cleared = clearArxivUnread()
    expect(cleared).toEqual({ unreadCount: 0, hasDirect: false })
    expect(getCachedArxivUnread()).toEqual({ unreadCount: 0, hasDirect: false })
    expect(eventSpy).toHaveBeenCalled()

    global.window.removeEventListener(ARXIV_UNREAD_EVENT, eventSpy)
  })

  it('counts only papers published after lastViewedPaperId when lastViewedPaperId is specified', () => {
    const papers = [
      { id: 10, recommended_by_id: 99, is_read_by_me: false, visibility: 'public' },
      { id: 11, recommended_by_id: 99, is_read_by_me: false, visibility: 'public' },
      { id: 12, recommended_by_id: 100, is_read_by_me: false, visibility: 'public' },
      { id: 13, recommended_by_id: 42, is_read_by_me: false, visibility: 'public' } // own paper
    ]

    // User previously viewed up to paper 11
    const result = calculateArxivUnread(papers, currentUserId, 11)
    // Only paper 12 is new (id 13 is own paper)
    expect(result).toEqual({ unreadCount: 1, hasDirect: false })

    // User previously viewed up to paper 13
    const resultUpToDate = calculateArxivUnread(papers, currentUserId, 13)
    expect(resultUpToDate).toEqual({ unreadCount: 0, hasDirect: false })
  })

  it('triggers gold badge (hasDirect: true) when a new recommendation since last view is directed to current user', () => {
    const papers = [
      { id: 10, recommended_by_id: 99, is_read_by_me: true, visibility: 'public' },
      { id: 15, recommended_by_id: 88, is_read_by_me: false, visibility: 'direct', recipients: [{ id: currentUserId }] }
    ]

    // User previously viewed up to paper 10
    const result = calculateArxivUnread(papers, currentUserId, 10)
    expect(result).toEqual({ unreadCount: 1, hasDirect: true })

    // After viewing paper 15
    const resultAfterView = calculateArxivUnread(papers, currentUserId, 15)
    expect(resultAfterView).toEqual({ unreadCount: 0, hasDirect: false })
  })
})
