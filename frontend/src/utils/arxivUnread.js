/**
 * 文献推荐流新文献与未读提示管理工具
 * 支持自上次查看以来新出现的文献篇数统计、定向推送（金色徽标）检测及跨组件事件广播
 */

import { arxivApi } from '../api/client'

export const ARXIV_UNREAD_EVENT = 'laborbit-arxiv-unread-updated'
const STORAGE_KEY = 'laborbit_arxiv_unread_summary'
const LAST_VIEWED_KEY = 'laborbit_arxiv_last_viewed_paper_id'

/**
 * 纯函数：根据文献流列表与当前用户 ID 计算新文献篇数及是否包含定向推送给自己的文献
 * 规则：
 * 1. 当前用户自己推荐的文献不计入新文献通知
 * 2. 若传入 lastViewedPaperId，则仅统计 paper.id > lastViewedPaperId 的最新文献（不论其是否已读）
 * 3. 若未传入 lastViewedPaperId，则回退统计当前用户未读（!paper.is_read_by_me）的文献数（向后兼容）
 * 4. 若新文献中至少有一篇为定向推荐且当前用户为接收者，则 hasDirect 为 true（呈现金色气泡）
 * 
 * @param {Array} feedPapers
 * @param {number|string} currentUserId
 * @param {number|string|null} [lastViewedPaperId]
 * @returns {{ unreadCount: number, hasDirect: boolean }}
 */
export function calculateArxivUnread(feedPapers, currentUserId, lastViewedPaperId) {
  if (!Array.isArray(feedPapers) || !currentUserId) {
    return { unreadCount: 0, hasDirect: false }
  }

  const uid = Number(currentUserId)
  let unreadCount = 0
  let hasDirect = false

  for (const paper of feedPapers) {
    if (!paper) continue
    const recommenderId = Number(paper.recommender?.id || paper.recommended_by_id)
    // 自己推荐的不计入新文献提醒
    if (recommenderId === uid) continue

    // 若指定了 lastViewedPaperId，则仅统计 ID 大于该值的最新推荐
    if (lastViewedPaperId !== undefined && lastViewedPaperId !== null) {
      if (Number(paper.id) <= Number(lastViewedPaperId)) continue
    } else {
      // 兼容旧模式：未指定 lastViewedPaperId 时，按未读标记统计
      if (paper.is_read_by_me) continue
    }

    // 检查可见性与定向接收
    if (paper.visibility === 'direct') {
      const isRecipient = Array.isArray(paper.recipients) && paper.recipients.some(r => Number(r.id) === uid)
      if (isRecipient) {
        unreadCount++
        hasDirect = true
      }
    } else {
      unreadCount++
    }
  }

  return { unreadCount, hasDirect }
}

/**
 * 获取本地缓存的上次查看最大文献 ID
 */
export function getLastViewedPaperId() {
  try {
    const val = localStorage.getItem(LAST_VIEWED_KEY)
    return val ? Number(val) : 0
  } catch {
    return 0
  }
}

/**
 * 设置本地存储的上次查看最大文献 ID
 */
export function setLastViewedPaperId(paperId) {
  try {
    if (paperId !== undefined && paperId !== null) {
      localStorage.setItem(LAST_VIEWED_KEY, String(paperId))
    }
  } catch {}
}

/**
 * 获取本地缓存的未读概要
 */
export function getCachedArxivUnread() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { unreadCount: 0, hasDirect: false }
    const parsed = JSON.parse(raw)
    return {
      unreadCount: Number(parsed.unreadCount || 0),
      hasDirect: Boolean(parsed.hasDirect)
    }
  } catch {
    return { unreadCount: 0, hasDirect: false }
  }
}

/**
 * 广播未读状态更新
 */
export function broadcastArxivUnread(summary) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(summary))
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ARXIV_UNREAD_EVENT, { detail: summary }))
  }
}

/**
 * 从后端拉取最新的文献未读统计并广播
 */
export async function refreshArxivUnread() {
  try {
    const data = await arxivApi.getUnreadSummary()
    const summary = {
      unreadCount: Number(data?.unread_count || 0),
      hasDirect: Boolean(data?.has_direct)
    }
    if (data?.last_paper_id) {
      setLastViewedPaperId(data.last_paper_id)
    }
    broadcastArxivUnread(summary)
    return summary
  } catch {
    return getCachedArxivUnread()
  }
}

/**
 * 即时清除文献推荐流未读提示（点击或进入模块时调用）
 */
export function clearArxivUnread(maxPaperId) {
  if (maxPaperId) {
    setLastViewedPaperId(maxPaperId)
  }
  const summary = { unreadCount: 0, hasDirect: false }
  broadcastArxivUnread(summary)
  return summary
}

/**
 * 标记推荐流已查看（向后端报告最新浏览进度并清除气泡）
 */
export async function markArxivFeedViewed(maxPaperId) {
  clearArxivUnread(maxPaperId)
  try {
    const res = await arxivApi.markFeedViewed()
    if (res?.last_paper_id) {
      setLastViewedPaperId(res.last_paper_id)
    }
  } catch {}
}
