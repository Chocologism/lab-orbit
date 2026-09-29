/**
 * 全站多源业务语义模糊检索服务 (Site Semantic Search Service)
 * 纯前端内存缓存 + 零压力按需检索
 * 涵盖：
 * 1. 文献推荐流与公共文献库（含标题、作者、摘要、中英文译文、推荐人、研读记录）
 * 2. 课题组重要通知与学术邮箱邮件
 * 3. 组会排期、学术报告与研讨会议
 * 4. 资料库全部资源卡片
 */

import {
  arxivApi,
  libraryApi,
  noticeApi,
  mailboxApi,
  seminarApi,
  talkApi,
  resourceApi
} from '../api/client'
import { PAPER_TRANSLATIONS_STORAGE_KEY } from './aiService'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 分钟本地内存缓存，彻底避免对 Cloudflare 的多余请求

const memoryCache = {
  feed: { data: null, timestamp: 0 },
  library: { data: null, timestamp: 0 },
  notices: { data: null, timestamp: 0 },
  emails: { data: null, timestamp: 0 },
  seminars: { data: null, timestamp: 0 },
  talks: { data: null, timestamp: 0 },
  resources: { data: null, timestamp: 0 }
}

/**
 * 清除本地搜索缓存（在需要强制刷新时使用）
 */
export function invalidateSearchCache(domain = null) {
  if (domain && memoryCache[domain]) {
    memoryCache[domain] = { data: null, timestamp: 0 }
  } else {
    for (const key of Object.keys(memoryCache)) {
      memoryCache[key] = { data: null, timestamp: 0 }
    }
  }
}

async function getCachedData(key, fetcher) {
  const now = Date.now()
  const entry = memoryCache[key]
  if (entry && entry.data && (now - entry.timestamp) < CACHE_TTL_MS) {
    return entry.data
  }
  try {
    const fresh = await fetcher()
    memoryCache[key] = {
      data: fresh,
      timestamp: now
    }
    return fresh
  } catch (err) {
    console.warn(`[siteSearchService] 获取 ${key} 数据失败，回退为空:`, err)
    return entry?.data || []
  }
}

/**
 * 停用词过滤与关键词拆解
 */
const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '那', '帮我', '一下', '请问', '怎么', '什么', '查一下', '搜一下',
  '找一下', '检索', '查询', '找找', '有哪些', '谁在', '什么时候', '哪里', '关于',
  'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'about'
])

export function tokenizeQuery(query) {
  if (!query || typeof query !== 'string') return []
  let clean = query.trim().toLowerCase()
  const tokens = []

  // 1. 优先捕获 arXiv 编号或带小数点的专业标识
  const arxivMatches = clean.match(/\b\d{4}\.\d{4,5}(?:v\d+)?\b/g) || []
  for (const m of arxivMatches) {
    tokens.push(m)
    clean = clean.replace(m, ' ')
  }

  // 2. 按长度从长到短将中文停用词替换为空格，避免粘连干扰
  const sortedChineseStopWords = Array.from(STOP_WORDS)
    .filter(sw => /[\u4e00-\u9fa5]/.test(sw))
    .sort((a, b) => b.length - a.length)
  for (const sw of sortedChineseStopWords) {
    clean = clean.replaceAll(sw, ' ')
  }

  // 3. 提取英文单词/数字和中文字符片段
  const rawTokens = clean.split(/[\s,，.。!！?？;；:：、/\\|'"`~@#$%^&*()_+=\-[\]{}<>]+/).filter(Boolean)

  for (const t of rawTokens) {
    if (STOP_WORDS.has(t)) continue
    tokens.push(t)
    // 若是连续较长的中文字符串，额外切分成二元和三元字组增强召回
    if (/[\u4e00-\u9fa5]/.test(t) && t.length >= 4) {
      for (let i = 0; i < t.length - 1; i++) {
        tokens.push(t.slice(i, i + 2))
      }
    }
  }
  return Array.from(new Set(tokens.filter(t => t.length >= 2 || /[\u4e00-\u9fa5]/.test(t))))
}

/**
 * 文本命中评分
 */
function scoreTextMatch(tokens, ...fields) {
  let score = 0
  const combined = fields.filter(Boolean).map(f => String(f).toLowerCase()).join(' ')
  if (!combined) return 0

  for (const token of tokens) {
    if (!token) continue
    const idx = combined.indexOf(token)
    if (idx !== -1) {
      score += 10
      // 头部命中加分
      if (idx === 0) score += 5
    }
  }
  return score
}

/**
 * 1. 检索文献推荐流与公共文献库（含研讨论文历史与中文译本）
 */
export async function searchLiterature(tokens, rawQuery) {
  const [feedRaw, libraryRaw] = await Promise.all([
    getCachedData('feed', () => arxivApi.getFeed('all').catch(() => [])),
    getCachedData('library', () => libraryApi.list('', 'all').catch(() => []))
  ])

  const feedList = Array.isArray(feedRaw) ? feedRaw : []
  const libraryList = Array.isArray(libraryRaw) ? libraryRaw : []

  // 读取本地存储的中文译本记录缓存
  let localTranslations = {}
  try {
    const rawTr = localStorage.getItem(PAPER_TRANSLATIONS_STORAGE_KEY)
    if (rawTr) localTranslations = JSON.parse(rawTr)
  } catch (_) {}

  // 读取论文讨论历史（包含用户与 AI 讨论某篇文献时的对话片段）
  const discussHistories = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('csbd_paper_chat_') || key.startsWith('csbd_paper_discuss_'))) {
        const paperId = key.replace(/^csbd_paper_(chat|discuss)_/, '')
        const val = localStorage.getItem(key)
        if (val) discussHistories[paperId] = val.slice(0, 3000)
      }
    }
  } catch (_) {}

  const results = []
  const seenArxiv = new Set()

  // 1.1 检索推荐流文献
  for (const paper of feedList) {
    const arxivClean = String(paper.arxiv_id || '').replace(/^arxiv:/i, '').replace(/v\d+$/, '').trim()
    const translation = localTranslations[arxivClean] || localTranslations[paper.arxiv_id] || {}
    const discussText = discussHistories[arxivClean] || discussHistories[paper.arxiv_id] || ''

    const titleEn = paper.title || ''
    const titleZh = paper.title_zh || translation.title || ''
    const abstractEn = paper.abstract || ''
    const abstractZh = paper.abstract_zh || translation.abstract || ''
    const authors = Array.isArray(paper.authors) ? paper.authors.join(' ') : (paper.authors || '')
    const recommender = paper.recommender?.name || paper.recommender?.real_name || ''
    const comment = paper.recommend_comment || ''

    let score = 0
    // 标题权重极高
    score += scoreTextMatch(tokens, titleEn, titleZh) * 2.5
    // 推荐人、作者权重高
    score += scoreTextMatch(tokens, authors, recommender) * 2.0
    // 摘要与研读重点
    score += scoreTextMatch(tokens, abstractEn, abstractZh, comment) * 1.0
    // 研讨对话历史
    if (discussText) {
      score += scoreTextMatch(tokens, discussText) * 0.8
    }
    // arXiv 号直接命中
    if (arxivClean && rawQuery.includes(arxivClean)) {
      score += 50
    }

    if (score > 8) {
      seenArxiv.add(arxivClean)
      results.push({
        id: paper.id,
        type: 'literature_feed',
        title: titleZh ? `${titleZh} (${titleEn})` : titleEn,
        arxiv_id: arxivClean ? `arXiv:${arxivClean}` : '',
        recommender: recommender ? `推荐人: ${recommender}` : '',
        authors: authors.slice(0, 60),
        comment: comment ? `推荐理由: ${comment.slice(0, 80)}` : '',
        score,
        link: `/arxiv?paper_id=${paper.id}`
      })
    }
  }

  // 1.2 检索文献库中剩余文献
  for (const paper of libraryList) {
    const arxivClean = String(paper.arxiv_id || '').replace(/^arxiv:/i, '').replace(/v\d+$/, '').trim()
    if (arxivClean && seenArxiv.has(arxivClean)) continue

    const title = paper.title || ''
    const authors = Array.isArray(paper.authors) ? paper.authors.join(' ') : (paper.authors || '')
    const abstract = paper.abstract || ''

    let score = scoreTextMatch(tokens, title) * 2.0 + scoreTextMatch(tokens, authors) * 1.5 + scoreTextMatch(tokens, abstract) * 0.8
    if (arxivClean && rawQuery.includes(arxivClean)) {
      score += 50
    }

    if (score > 8) {
      results.push({
        id: paper.id,
        type: 'literature_library',
        title,
        arxiv_id: arxivClean ? `arXiv:${arxivClean}` : '',
        recommender: '',
        authors: authors.slice(0, 60),
        comment: '',
        score,
        link: `/library?q=${encodeURIComponent(arxivClean || title.slice(0, 30))}`
      })
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5)
}

/**
 * 2. 检索课题组重要通知与学术邮箱
 */
export async function searchNoticesAndEmails(tokens, rawQuery) {
  const [noticesRaw, emailsRaw] = await Promise.all([
    getCachedData('notices', () => noticeApi.list().catch(() => [])),
    getCachedData('emails', () => mailboxApi.getEmails({ limit: 40 }).catch(() => []))
  ])

  const noticeList = Array.isArray(noticesRaw) ? noticesRaw : (noticesRaw?.items || [])
  const emailList = Array.isArray(emailsRaw) ? emailsRaw : (emailsRaw?.items || emailsRaw?.emails || [])

  const results = []

  // 2.1 检索通知
  for (const n of noticeList) {
    const title = n.title || ''
    const content = n.content || ''
    const category = n.category || ''
    const publisher = n.publisher_name || n.author || ''

    const score = scoreTextMatch(tokens, title) * 2.5 +
      scoreTextMatch(tokens, publisher, category) * 1.5 +
      scoreTextMatch(tokens, content) * 1.0

    if (score > 8) {
      results.push({
        id: n.id,
        type: 'notice',
        title: `【通知】${title}`,
        detail: content.slice(0, 100),
        meta: `分类: ${category} | 日期: ${n.created_at ? n.created_at.slice(0, 10) : ''}`,
        score,
        link: `/notices?id=${n.id}`
      })
    }
  }

  // 2.2 检索邮箱邮件
  for (const e of emailList) {
    const subject = e.subject || ''
    const sender = e.sender || e.from || ''
    const snippet = e.snippet || e.body_text || ''
    const date = e.date || ''

    const score = scoreTextMatch(tokens, subject) * 2.5 +
      scoreTextMatch(tokens, sender) * 2.0 +
      scoreTextMatch(tokens, snippet) * 1.0

    if (score > 8) {
      results.push({
        id: e.id,
        type: 'email',
        title: `【邮件】${subject}`,
        detail: snippet.slice(0, 100),
        meta: `发件人: ${sender} | 日期: ${date.slice(0, 10)}`,
        score,
        link: `/mailbox?email_id=${e.id}`
      })
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5)
}

/**
 * 3. 检索组会排期、学术报告与会议日程
 */
export async function searchSchedule(tokens, rawQuery) {
  const [seminarsRaw, talksRaw] = await Promise.all([
    getCachedData('seminars', () => seminarApi.getSeminars().catch(() => [])),
    getCachedData('talks', () => talkApi.list().catch(() => []))
  ])

  const seminarList = Array.isArray(seminarsRaw) ? seminarsRaw : []
  const talkList = Array.isArray(talksRaw) ? talksRaw : []

  const results = []

  // 3.1 检索组会排期
  for (const s of seminarList) {
    const topic = s.topic || ''
    const presenter = s.presenter_name || s.name || ''
    const location = s.location || ''
    const date = s.date || ''
    const papers = Array.isArray(s.papers) ? s.papers.join(' ') : (s.papers || s.arxiv_id || '')
    const status = s.status || ''

    const score = scoreTextMatch(tokens, presenter) * 3.0 +
      scoreTextMatch(tokens, topic) * 2.5 +
      scoreTextMatch(tokens, papers, location) * 1.5 +
      scoreTextMatch(tokens, date) * 1.0

    if (score > 8) {
      results.push({
        id: s.id,
        type: 'seminar',
        title: `【组会】${date} ${presenter ? presenter + ' 汇报' : '组会'}`,
        detail: topic ? `主题: ${topic}` : (papers ? `分享文献: ${papers}` : '暂无详细主题'),
        meta: `地点: ${location || '未定'} | 状态: ${status === 'completed' ? '已结束' : '待举行'}`,
        score,
        link: `/seminars?view=timeline&target_seminar=${s.id}`
      })
    }
  }

  // 3.2 检索学术报告与会议
  for (const t of talkList) {
    const title = t.title || ''
    const speaker = t.speaker || ''
    const inst = t.institution || ''
    const venue = t.venue || t.location || ''
    const date = t.date || ''
    const abs = t.abstract || ''

    const score = scoreTextMatch(tokens, title) * 2.5 +
      scoreTextMatch(tokens, speaker, inst) * 2.0 +
      scoreTextMatch(tokens, abs, venue) * 1.0

    if (score > 8) {
      results.push({
        id: t.id,
        type: 'talk',
        title: `【学术报告】${title}`,
        detail: abs.slice(0, 100),
        meta: `主讲人: ${speaker} (${inst}) | 日期: ${date} | 地点: ${venue}`,
        score,
        link: `/seminars?tab=talks`
      })
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5)
}

/**
 * 4. 检索资料库卡片
 */
export async function searchResources(tokens, rawQuery) {
  const booksRaw = await getCachedData('resources', () => resourceApi.getBooks('').catch(() => []))
  const books = Array.isArray(booksRaw) ? booksRaw : []

  const results = []

  for (const card of books) {
    const title = card.title || ''
    const author = card.author || ''
    const analyst = card.submitter_name || card.analyst || ''
    const category = card.category || ''
    const desc = card.description || ''
    const tags = Array.isArray(card.tags) ? card.tags.join(' ') : (card.tags || '')

    const score = scoreTextMatch(tokens, title) * 2.5 +
      scoreTextMatch(tokens, author, analyst, category) * 2.0 +
      scoreTextMatch(tokens, desc, tags) * 1.0

    if (score > 8) {
      results.push({
        id: card.id,
        type: 'resource',
        title: `【资料卡片】${title}`,
        detail: desc ? desc.slice(0, 100) : '暂无卡片描述',
        meta: `分类: ${category} | 作者/分析人: ${author || analyst || '未知'}`,
        score,
        link: `/resources?category=${encodeURIComponent(category)}&highlight=${encodeURIComponent(card.id)}`
      })
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5)
}

/**
 * 意图门控：判断用户问题是否可能涉及全站检索
 */
export function hasPlatformSearchIntent(query) {
  if (!query || typeof query !== 'string') return false
  const q = query.trim().toLowerCase()
  if (q.length < 2) return false

  const pattern = /(文献|论文|文章|arxiv|推荐流|文献库|通知|公告|邮件|收件箱|信件|日程|组会|周会|学术报告|讲座|会议|汇报|报告人|分享人|主讲|资料|资源|卡片|算力|使用方法|功能|怎么用|入口|谁讲|谁汇报|哪天|时间|有没有|查一下|找一下|搜一下|查看)/i
  return pattern.test(q)
}

/**
 * 统一执行全站多源语义检索
 */
export async function searchAllPlatformData(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return []
  const tokens = tokenizeQuery(rawQuery)
  if (tokens.length === 0) return []

  const [literatures, notices, schedules, resources] = await Promise.all([
    searchLiterature(tokens, rawQuery),
    searchNoticesAndEmails(tokens, rawQuery),
    searchSchedule(tokens, rawQuery),
    searchResources(tokens, rawQuery)
  ])

  const all = [...literatures, ...notices, ...schedules, ...resources]
  return all.sort((a, b) => b.score - a.score).slice(0, 8)
}
