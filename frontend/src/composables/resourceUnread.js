import { ref } from 'vue'
import { personalApi, resourceApi } from '../api/client'

export const RESOURCE_UNREAD_EVENT = 'resource-unread-updated'

const unreadResourceCount = ref(0)
const unreadBookIds = ref(new Set())
const preferredCategory = ref('')

function getViewedKey() {
  const token = localStorage.getItem('laborbit_token') || localStorage.getItem('labhub_token') || 'guest'
  const user = localStorage.getItem('laborbit_user') || localStorage.getItem('labhub_user') || ''
  let id = 'guest'
  try {
    const parsed = JSON.parse(user)
    if (parsed?.id) id = String(parsed.id)
  } catch {}
  return `laborbit_resource_viewed_records_${id}_${token.slice(-8)}`
}

function getViewedRecords() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(getViewedKey()) || '{}')
  } catch {
    return {}
  }
}

function saveViewedRecords(records) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getViewedKey(), JSON.stringify(records))
  } catch {}
}

export function computeUnreadBooks(books = [], favorites = []) {
  const favMap = new Map()
  for (const f of favorites) {
    if (f.kind === 'book') {
      favMap.set(String(f.target), f.saved_at || f.created_at || null)
    }
  }

  const records = getViewedRecords()
  const unreadSet = new Set()
  let firstCategory = ''

  for (const b of books) {
    const bookIdStr = String(b.id)
    if (!favMap.has(bookIdStr)) continue

    // 仅当卡片存在明确的 updated_at 时才参与更新判断
    if (!b.updated_at) continue

    const updateTime = new Date(b.updated_at).getTime()
    if (isNaN(updateTime)) continue

    const lastViewed = records[bookIdStr]
    if (lastViewed) {
      const viewedTime = new Date(lastViewed).getTime()
      if (!isNaN(viewedTime) && updateTime > viewedTime + 500) {
        unreadSet.add(b.id)
        unreadSet.add(bookIdStr)
        if (!firstCategory && b.category) firstCategory = b.category
      }
    } else {
      // 用户未曾查阅过更新，与收藏时间/创建时间对比
      const savedAt = favMap.get(bookIdStr)
      const baseTime = savedAt ? new Date(savedAt).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0)
      if (!isNaN(baseTime) && updateTime > baseTime + 1000) {
        unreadSet.add(b.id)
        unreadSet.add(bookIdStr)
        if (!firstCategory && b.category) firstCategory = b.category
      }
    }
  }

  return {
    unreadCount: Math.floor(unreadSet.size / 2) || (unreadSet.size ? 1 : 0),
    unreadSet,
    preferredCategory: firstCategory
  }
}

export function useResourceUnread() {
  async function refresh() {
    try {
      const token = localStorage.getItem('laborbit_token') || localStorage.getItem('labhub_token')
      if (!token) {
        unreadResourceCount.value = 0
        unreadBookIds.value = new Set()
        preferredCategory.value = ''
        return
      }

      const [favData, booksData] = await Promise.all([
        personalApi.favorites().catch(() => []),
        resourceApi.getBooks().catch(() => [])
      ])

      const { unreadCount, unreadSet, preferredCategory: cat } = computeUnreadBooks(booksData, favData)
      unreadResourceCount.value = unreadCount
      unreadBookIds.value = unreadSet
      preferredCategory.value = cat

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(RESOURCE_UNREAD_EVENT, {
          detail: {
            count: unreadCount,
            category: cat
          }
        }))
      }
    } catch {}
  }

  function markBookAsViewed(bookId) {
    const strId = String(bookId)
    const numId = Number(bookId)
    if (!unreadBookIds.value.has(strId) && !unreadBookIds.value.has(numId)) {
      return
    }

    // 从未读集合中移除
    unreadBookIds.value.delete(strId)
    unreadBookIds.value.delete(numId)
    unreadResourceCount.value = Math.max(0, Math.floor(unreadBookIds.value.size / 2))

    // 记录最新查阅时间戳
    const records = getViewedRecords()
    records[strId] = new Date().toISOString()
    saveViewedRecords(records)

    if (unreadResourceCount.value === 0) {
      preferredCategory.value = ''
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RESOURCE_UNREAD_EVENT, {
        detail: {
          count: unreadResourceCount.value,
          category: preferredCategory.value
        }
      }))
    }
  }

  function isBookUnread(bookId) {
    return unreadBookIds.value.has(String(bookId)) || unreadBookIds.value.has(Number(bookId))
  }

  return {
    unreadResourceCount,
    unreadBookIds,
    preferredCategory,
    refresh,
    markBookAsViewed,
    isBookUnread
  }
}

const defaultUnreadInstance = useResourceUnread()

export function refreshResourceUnread() {
  return defaultUnreadInstance.refresh()
}

export function hasAnyResourceUnread() {
  return defaultUnreadInstance.unreadResourceCount.value > 0
}
