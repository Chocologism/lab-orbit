/**
 * arXiv HTML 全文抓取与学术 Markdown 解析工具
 * 纯浏览器客户端直连抓取（arXiv 官方 HTML 端点原生开启 Access-Control-Allow-Origin: *）
 * 0 云端服务消耗，高效保真还原论文标题、作者、摘要、各级章节与 LaTeX 数学公式。
 */

/**
 * 规范化 arXiv 编号（支持纯 ID、版本号、以及完整 URL 如 https://arxiv.org/abs/...）
 * @param {string} rawId
 * @returns {string} 如 '2609.19132v1' 或 '2401.00001'
 */
export function cleanArxivId(rawId) {
  if (!rawId || typeof rawId !== 'string') return ''
  let cleaned = rawId.trim()
  const urlMatch = cleaned.match(/(?:arxiv\.org\/(?:abs|pdf|html)\/|arxiv:)([\w.-]+)/i)
  if (urlMatch && urlMatch[1]) {
    cleaned = urlMatch[1]
  }
  return cleaned
    .replace(/^https?:\/\/arxiv\.org\/(abs|pdf|html)\//i, '')
    .replace(/^arxiv:\s*/i, '')
    .replace(/\.pdf$/i, '')
    .trim()
}

import { resolveUserScope } from './userScope.js'

export { resolveUserScope }

export const RECENT_PAPERS_STORAGE_KEY = 'laborbit_arxiv_recent_papers'
export const META_CACHE_PREFIX = 'laborbit_arxiv_meta_'

/**
 * 获取特定用户的最近文献本地存储键
 */
export function getRecentPapersStorageKey(userOrScope) {
  const scope = resolveUserScope(userOrScope)
  return scope ? `laborbit_arxiv_recent_papers_${scope}` : RECENT_PAPERS_STORAGE_KEY
}

/**
 * 校验标题是否为草稿标识、排版声明、LaTeX 宏包或无效噪音
 * @param {string} title
 * @returns {boolean}
 */
export function isNoiseTitle(title) {
  if (!title || typeof title !== 'string') return true
  const t = title.trim()
  if (t.length < 3) return true
  if (/^(draft\s+version|typeset\s+using|compiled\s+using|a\s+te?x\s+style|te?x\s+style|te?x\s+twocolumn|latex\s+twocolumn)/i.test(t)) return true
  if (/^(mnras\b|arxiv:\s*\d|accepted\b|received\b|under\s+review)/i.test(t)) return true
  if (/^\d{4}\.\d{4,5}(v\d+)?$/i.test(t)) return true
  if (/^aastex/i.test(t)) return true
  if (/^(\\documentclass|\\usepackage|%)/i.test(t)) return true
  return false
}

/**
 * 判断单行文本是否属于论文开头的排版/草稿/期刊元数据噪音行
 * @param {string} l
 * @returns {boolean}
 */
export function isNoiseHeaderLine(l) {
  if (!l || l.length <= 1) return true
  if (/^(draft\s+version|typeset\s+using|compiled\s+using|a\s+te?x\s+style|te?x\s+style|te?x\s+twocolumn|latex\s+twocolumn)/i.test(l)) return true
  if (/^(mnras|preprint|arxiv|title:|accepted|received|submitted|published|in\s+press|under\s+review)/i.test(l)) return true
  if (/^(aastex|revtex|ieee|acm|springer|elsevier|iop|nature|science)\b/i.test(l)) return true
  if (/^(vol\.|volume\s+\d+|no\.|page\s+\d+|doi:|\b\d{4}\b.*\b(arxiv|preprint)\b)/i.test(l)) return true
  if (/^(\\documentclass|\\usepackage|%)/i.test(l)) return true
  return false
}

/**
 * 判断单行文本是否可能为作者或机构信息
 * @param {string} l
 * @returns {boolean}
 */
export function isLikelyAuthorLine(l) {
  if (!l) return false
  if (/(university|department|institute|laboratory|center|faculty|college|school|@|email)/i.test(l)) return true
  if (/[A-Za-z]+(\s+[A-Za-z]\.?)?\s*,(\s*\d+)?\s*$/.test(l.trim())) return true
  if (/^[A-Z][\p{L}'-]+(\s+[A-Z]\.?)?\s+[A-Z][\p{L}'-]+$/u.test(l.trim())) return true
  if (/^[A-Z][\p{L}'-]+(\s+[A-Z]\.?)?\s+[A-Z][\p{L}'-]+\s+(and|&)\s+[A-Z][\p{L}'-]+\s+[A-Z][\p{L}'-]+$/u.test(l.trim())) return true
  return false
}

/**
 * 判断标题第一行是否应与第二行副标题合并
 * @param {string} line1
 * @param {string} line2
 * @returns {boolean}
 */
export function shouldJoinSubtitle(line1, line2) {
  if (!line2 || isLikelyAuthorLine(line2)) return false
  const trimmed1 = line1.trim()
  if (/[:\-–—]$/.test(trimmed1)) return true
  if (/\b(with|of|in|for|and|to|at|from|by|on|a|the|an|using|via|under|over|through|across|between|towards?|into|about)$/i.test(trimmed1)) return true
  if (trimmed1.length < 85 && !/[.!?]$/.test(trimmed1) && !isLikelyAuthorLine(line2)) return true
  return false
}

/**
 * 从原始 Markdown 文本中精准提取学术文章真名标题
 * @param {string} text
 * @returns {string}
 */
export function parseTitleFromMarkdown(text) {
  if (!text) return ''
  const lines = text.split('\n')
  const headerLines = []
  for (let i = 0; i < Math.min(lines.length, 50); i++) {
    const l = lines[i].trim()
    if (!l) continue
    if (isNoiseHeaderLine(l)) continue
    if (/^ABSTRACT/i.test(l)) break
    headerLines.push(l)
  }
  if (headerLines.length === 0) return ''
  let title = headerLines[0].replace(/^#+\s*/, '')
  if (headerLines.length > 1 && shouldJoinSubtitle(title, headerLines[1])) {
    title += ' ' + headerLines[1].trim()
  }
  return title.trim()
}

/**
 * 获取本地研讨过的最近 arXiv 文献列表（支持按用户隔离）
 * @param {string|number|object} [userOrScope]
 * @returns {Array<{id: string, title: string, timestamp: number}>}
 */
export function getRecentArxivPapers(userOrScope) {
  if (typeof localStorage === 'undefined') return []
  try {
    const targetKey = getRecentPapersStorageKey(userOrScope)
    const raw = localStorage.getItem(targetKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        let changed = false
        const sanitized = parsed.map(item => {
          if (isNoiseTitle(item.title)) {
            const metaRaw = localStorage.getItem(`${META_CACHE_PREFIX}${item.id}`)
            if (metaRaw) {
              try {
                const parsedMeta = JSON.parse(metaRaw)
                if (parsedMeta?.title && !isNoiseTitle(parsedMeta.title)) {
                  changed = true
                  return { ...item, title: parsedMeta.title }
                }
              } catch (_) {}
            }
            return { ...item, title: `arXiv:${item.id}` }
          }
          return item
        })
        if (changed) {
          localStorage.setItem(targetKey, JSON.stringify(sanitized))
        }
        return sanitized
      }
    }

    // 若当前为特定用户且专属键为空，检查旧版未隔离的全局历史并迁移
    if (targetKey !== RECENT_PAPERS_STORAGE_KEY) {
      const legacyRaw = localStorage.getItem(RECENT_PAPERS_STORAGE_KEY)
      if (legacyRaw) {
        const parsedLegacy = JSON.parse(legacyRaw)
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          const sanitized = parsedLegacy.map(item => isNoiseTitle(item.title) ? { ...item, title: `arXiv:${item.id}` } : item)
          localStorage.setItem(targetKey, JSON.stringify(sanitized))
          localStorage.removeItem(RECENT_PAPERS_STORAGE_KEY)
          return sanitized
        }
      }
    }
    return []
  } catch (_) {
    return []
  }
}

/**
 * 保存研讨文献到本地历史（支持按用户隔离，防伪防噪声标题污染）
 * @param {string} paperId 
 * @param {string} title 
 * @param {string|number|object} [userOrScope]
 */
export function saveRecentArxivPaper(paperId, title = '', userOrScope) {
  const clean = cleanArxivId(paperId)
  if (!clean || typeof localStorage === 'undefined') return
  try {
    const targetKey = getRecentPapersStorageKey(userOrScope)
    const list = getRecentArxivPapers(userOrScope)
    const existing = list.find(p => p.id === clean)
    const filtered = list.filter(p => p.id !== clean)

    let effectiveTitle = (title && typeof title === 'string') ? title.trim() : ''
    // 若传入标题为噪音（如草稿或样式声明），优先使用已保存的有效标题；否则退回编号
    if (isNoiseTitle(effectiveTitle)) {
      effectiveTitle = (existing && !isNoiseTitle(existing.title)) ? existing.title : `arXiv:${clean}`
    }

    filtered.unshift({
      id: clean,
      title: effectiveTitle,
      timestamp: Date.now()
    })
    localStorage.setItem(targetKey, JSON.stringify(filtered.slice(0, 12)))
  } catch (_) {}
}

/**
 * 从本地研讨历史中删除指定 arXiv 文献
 * @param {string} paperId
 * @param {string|number|object} [userOrScope]
 */
export function removeRecentArxivPaper(paperId, userOrScope) {
  const clean = cleanArxivId(paperId)
  if (!clean || typeof localStorage === 'undefined') return
  try {
    const targetKey = getRecentPapersStorageKey(userOrScope)
    const list = getRecentArxivPapers(userOrScope)
    const filtered = list.filter(p => p.id !== clean)
    localStorage.setItem(targetKey, JSON.stringify(filtered))
  } catch (_) {}
}

/**
 * 权威解析 arXiv 文献真实标题与元信息（多层纯前端直连与智能容灾回退）
 * 优先级：
 * 1. 本地元数据缓存快速命中 (0ms)
 * 2. DataCite 官方元数据中心 (arXiv 官方 DOI 注册机构，原生支持 CORS，纯前端直连)
 * 3. OpenAlex 全球开放学术图谱 (原生支持 CORS，极速容灾，纯前端直连)
 * 4. alphaXiv 预编译 Markdown 解析 (优先走同源代理 /api/arxiv/proxy-markdown)
 * 5. 本地后端 /api/arxiv/preview 接口 (附带认证 Token)
 * 6. Semantic Scholar 开放接口 (降级备选)
 *
 * @param {string} rawId
 * @param {Object} [options]
 * @returns {Promise<{id: string, title: string, authors?: string, abstract?: string}|null>}
 */
export async function resolveArxivPaperMetadata(rawId, { signal, timeout = 6000 } = {}) {
  const clean = cleanArxivId(rawId)
  if (!clean) return null

  // 1. 本地缓存快速命中
  if (typeof localStorage !== 'undefined') {
    try {
      const cached = localStorage.getItem(`${META_CACHE_PREFIX}${clean}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed?.title && !isNoiseTitle(parsed.title)) {
          return parsed
        }
      }
    } catch (_) {}
  }

  // 2. 权威 DataCite 官方元数据中心 (arXiv 官方 DOI 注册机构，全量支持浏览器 CORS，纯前端直连)
  try {
    const dcCtrl = new AbortController()
    const dcTimer = setTimeout(() => dcCtrl.abort(), timeout)
    if (signal) signal.addEventListener('abort', () => dcCtrl.abort(), { once: true })

    const dcRes = await fetch(`https://api.datacite.org/dois/10.48550/arxiv.${clean}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: dcCtrl.signal
    })
    clearTimeout(dcTimer)
    if (dcRes.ok) {
      const dcData = await dcRes.json()
      const rawTitle = dcData?.data?.attributes?.titles?.[0]?.title
      if (rawTitle && !isNoiseTitle(rawTitle)) {
        const creators = dcData?.data?.attributes?.creators || []
        const authorNames = creators.map(c => c.name).filter(Boolean).slice(0, 6).join(', ')
        const meta = {
          id: clean,
          title: rawTitle.replace(/\s+/g, ' ').trim(),
          authors: authorNames,
          abstract: dcData?.data?.attributes?.descriptions?.[0]?.description || ''
        }
        try {
          localStorage.setItem(`${META_CACHE_PREFIX}${clean}`, JSON.stringify(meta))
        } catch (_) {}
        return meta
      }
    }
  } catch (_) {}

  // 3. OpenAlex 全球开放学术图谱 (原生支持 CORS，极速容灾，纯前端直连)
  try {
    const oaCtrl = new AbortController()
    const oaTimer = setTimeout(() => oaCtrl.abort(), timeout)
    if (signal) signal.addEventListener('abort', () => oaCtrl.abort(), { once: true })

    const oaRes = await fetch(`https://api.openalex.org/works/doi:10.48550/arXiv.${clean}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: oaCtrl.signal
    })
    clearTimeout(oaTimer)
    if (oaRes.ok) {
      const oaData = await oaRes.json()
      if (oaData?.title && !isNoiseTitle(oaData.title)) {
        const authorships = Array.isArray(oaData.authorships) ? oaData.authorships : []
        const authorNames = authorships.map(a => a.author?.display_name).filter(Boolean).slice(0, 6).join(', ')
        const meta = {
          id: clean,
          title: oaData.title.replace(/\s+/g, ' ').trim(),
          authors: authorNames,
          abstract: ''
        }
        try {
          localStorage.setItem(`${META_CACHE_PREFIX}${clean}`, JSON.stringify(meta))
        } catch (_) {}
        return meta
      }
    }
  } catch (_) {}

  // 4. 同源代理或 alphaXiv 已预编译 Markdown 解析 (包含公式及全文)
  const candidateMdUrls = [
    `/api/arxiv/proxy-markdown/${clean}`,
    `https://www.alphaxiv.org/abs/${clean}.md`
  ]
  for (const url of candidateMdUrls) {
    try {
      const mdCtrl = new AbortController()
      const mdTimer = setTimeout(() => mdCtrl.abort(), timeout)
      if (signal) signal.addEventListener('abort', () => mdCtrl.abort(), { once: true })

      const mdRes = await fetch(url, { signal: mdCtrl.signal })
      clearTimeout(mdTimer)
      if (mdRes.ok) {
        const text = await mdRes.text()
        const title = parseTitleFromMarkdown(text)
        if (title && !isNoiseTitle(title)) {
          const meta = {
            id: clean,
            title: title.replace(/\s+/g, ' ').trim(),
            authors: '',
            abstract: ''
          }
          try {
            localStorage.setItem(`${META_CACHE_PREFIX}${clean}`, JSON.stringify(meta))
          } catch (_) {}
          return meta
        }
      }
    } catch (_) {}
  }

  // 5. 本地后端 /api/arxiv/preview 接口 (若处于登录状态并部署了后端)
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true })

    const headers = { 'Content-Type': 'application/json' }
    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('laborbit_token') || localStorage.getItem('labhub_token')
      if (token) headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch('/api/arxiv/preview', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url_or_id: clean }),
      signal: ctrl.signal
    })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      if (data?.title && !isNoiseTitle(data.title)) {
        const meta = {
          id: clean,
          title: data.title.replace(/\s+/g, ' ').trim(),
          authors: data.authors || '',
          abstract: data.abstract || ''
        }
        try {
          localStorage.setItem(`${META_CACHE_PREFIX}${clean}`, JSON.stringify(meta))
        } catch (_) {}
        return meta
      }
    }
  } catch (_) {}

  // 6. Semantic Scholar 开放接口 (补充降级备选)
  try {
    const s2Ctrl = new AbortController()
    const s2Timer = setTimeout(() => s2Ctrl.abort(), timeout)
    if (signal) signal.addEventListener('abort', () => s2Ctrl.abort(), { once: true })

    const s2Res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/ARXIV:${clean}?fields=title,authors,abstract`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: s2Ctrl.signal
    })
    s2Timer && clearTimeout(s2Timer)
    if (s2Res.ok) {
      const s2Data = await s2Res.json()
      if (s2Data?.title && !isNoiseTitle(s2Data.title)) {
        const meta = {
          id: clean,
          title: s2Data.title.replace(/\s+/g, ' ').trim(),
          authors: Array.isArray(s2Data.authors) ? s2Data.authors.map(a => a.name).join(', ') : '',
          abstract: s2Data.abstract || ''
        }
        try {
          localStorage.setItem(`${META_CACHE_PREFIX}${clean}`, JSON.stringify(meta))
        } catch (_) {}
        return meta
      }
    }
  } catch (_) {}

  return null
}


/**
 * 获取 arXiv 官方 HTML 页面 URL
 * @param {string} rawId 
 * @returns {string}
 */
export function getArxivHtmlUrl(rawId) {
  const id = cleanArxivId(rawId)
  return id ? `https://arxiv.org/html/${id}` : ''
}

/**
 * 预处理 HTML 中的数学公式与无关标记
 * 将 LaTeXML 的 <math> 标注提取为标准 LaTeX 行内 ($...$) 或块级 ($$...$$) 公式
 * @param {string} html 
 * @returns {string}
 */
function preprocessArxivHtml(html) {
  if (!html) return ''

  // 1. 提取 <math> 标签内的 LaTeX TeX 源码
  let text = html.replace(/<math[^>]*>([\s\S]*?)<\/math>/gi, (match) => {
    const isDisplay = match.includes('display="block"') || match.includes('display=\'block\'')
    // 优先提取 <annotation encoding="application/x-tex">TeX</annotation>
    const annotMatch = match.match(/<annotation[^>]*encoding=["']application\/x-tex["'][^>]*>([\s\S]*?)<\/annotation>/i)
    if (annotMatch && annotMatch[1]) {
      const tex = annotMatch[1].trim()
      return isDisplay ? `\n\n$$\n${tex}\n$$\n\n` : ` $${tex}$ `
    }
    // 降级提取 alttext 属性
    const altMatch = match.match(/alttext=["']([^"']*)["']/i)
    if (altMatch && altMatch[1]) {
      const tex = altMatch[1].trim()
      return isDisplay ? `\n\n$$\n${tex}\n$$\n\n` : ` $${tex}$ `
    }
    return match
  })

  // 2. 移除对正文研读无用且大幅增加 Token 开销的导航与目录标记
  text = text.replace(/<div class=["'][^"']*ltx_page_navbar[^"']*["'][\s\S]*?<\/div>/gi, '')
  text = text.replace(/<div class=["'][^"']*ltx_TOC[^"']*["'][\s\S]*?<\/div>/gi, '')
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '')
  text = text.replace(/<header class=["'][^"']*ltx_header[^"']*["'][\s\S]*?<\/header>/gi, '')
  text = text.replace(/<div class=["'][^"']*ltx_page_sidebar[^"']*["'][\s\S]*?<\/div>/gi, '')
  text = text.replace(/<div class=["'][^"']*ltx_page_footer[^"']*["'][\s\S]*?<\/div>/gi, '')
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')

  return text
}

/**
 * 递归解析 DOM 节点为清晰的 Markdown 文本
 * @param {Node} node 
 * @returns {string}
 */
function nodeToMarkdown(node) {
  if (!node) return ''

  // 文本节点
  if (node.nodeType === 3) { // Node.TEXT_NODE
    return node.nodeValue || ''
  }

  if (node.nodeType !== 1) { // 不是元素节点
    return ''
  }

  const el = node
  const tag = el.tagName.toLowerCase()

  // 忽略不可见或已处理标签
  if (['script', 'style', 'nav', 'noscript'].includes(tag)) {
    return ''
  }

  // 参考文献部分通常体量巨大且以引用元数据为主，精简保留或跳过
  if (el.classList && el.classList.contains('ltx_bibliography')) {
    return '\n\n## References\n*(参考文献列表已略，如需特定文献引用可在提问中指出)*\n\n'
  }

  // 子节点递归
  const childTexts = []
  for (let i = 0; i < el.childNodes.length; i++) {
    childTexts.push(nodeToMarkdown(el.childNodes[i]))
  }
  const childrenMarkdown = childTexts.join('')

  // 根据元素类型格式化
  switch (tag) {
    case 'h1':
      return `\n\n# ${childrenMarkdown.trim()}\n\n`
    case 'h2':
      return `\n\n## ${childrenMarkdown.trim()}\n\n`
    case 'h3':
      return `\n\n### ${childrenMarkdown.trim()}\n\n`
    case 'h4':
    case 'h5':
    case 'h6':
      return `\n\n#### ${childrenMarkdown.trim()}\n\n`
    case 'p':
      return `\n\n${childrenMarkdown.trim()}\n\n`
    case 'blockquote':
      return `\n\n> ${childrenMarkdown.trim()}\n\n`
    case 'ul':
      return `\n\n${childrenMarkdown}\n\n`
    case 'ol':
      return `\n\n${childrenMarkdown}\n\n`
    case 'li':
      return `\n- ${childrenMarkdown.trim()}`
    case 'strong':
    case 'b':
      return ` **${childrenMarkdown.trim()}** `
    case 'em':
    case 'i':
      return ` *${childrenMarkdown.trim()}* `
    case 'code':
      return ` \`${childrenMarkdown.trim()}\` `
    case 'figcaption':
      return `\n\n*图表说明: ${childrenMarkdown.trim()}*\n\n`
    case 'table':
      return `\n\n${childrenMarkdown.trim()}\n\n`
    case 'tr':
      return `\n${childrenMarkdown.trim()}`
    case 'th':
    case 'td':
      return ` | ${childrenMarkdown.trim()} `
    default:
      return childrenMarkdown
  }
}

/**
 * 将 arXiv HTML 字符串转换为学术 Markdown 文本
 * @param {string} htmlString 原始 HTML
 * @param {string} arxivId arXiv 编号
 * @returns {{ title: string, authors: string, abstract: string, markdown: string, wordCount: number }}
 */
export function parseArxivHtmlToMarkdown(htmlString, arxivId = '') {
  if (!htmlString || typeof htmlString !== 'string') {
    return {
      title: '',
      authors: '',
      abstract: '',
      markdown: '',
      wordCount: 0
    }
  }

  const cleanHtml = preprocessArxivHtml(htmlString)

  // 1. 尝试使用浏览器环境的 DOMParser
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(cleanHtml, 'text/html')

      // 提取标题
      const titleEl = doc.querySelector('.ltx_title_document') || doc.querySelector('h1') || doc.querySelector('title')
      let title = titleEl ? titleEl.textContent.replace(/^arXiv:\S+\s*/i, '').trim() : ''

      // 提取作者
      const authorsEl = doc.querySelector('.ltx_authors')
      let authors = authorsEl ? authorsEl.textContent.trim().replace(/\s+/g, ' ') : ''

      // 提取摘要
      const abstractEl = doc.querySelector('.ltx_abstract')
      let abstract = ''
      if (abstractEl) {
        abstract = abstractEl.textContent.replace(/^Abstract:?\s*/i, '').trim()
      }

      // 获取文章正文根节点
      const mainEl = doc.querySelector('.ltx_document') || doc.querySelector('article') || doc.body
      let rawMarkdown = nodeToMarkdown(mainEl)

      // 去除连续 3 个以上的换行
      rawMarkdown = rawMarkdown.replace(/\n{3,}/g, '\n\n').trim()

      return {
        title,
        authors,
        abstract,
        markdown: rawMarkdown,
        wordCount: rawMarkdown.length
      }
    } catch (_) {
      // DOMParser 异常时降级使用正则清洗
    }
  }

  // 2. 正则兜底解析器（支持 Node 环境及纯文本降级）
  let title = ''
  const titleMatch = cleanHtml.match(/<h1[^>]*class=["'][^"']*ltx_title_document[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                     cleanHtml.match(/<title>([^<]+)<\/title>/i)
  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]+>/g, '').replace(/^arXiv:\S+\s*/i, '').trim()
  }

  let authors = ''
  const authorsMatch = cleanHtml.match(/<div[^>]*class=["'][^"']*ltx_authors[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
  if (authorsMatch) {
    authors = authorsMatch[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ')
  }

  let abstract = ''
  const absMatch = cleanHtml.match(/<div[^>]*class=["'][^"']*ltx_abstract[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
  if (absMatch) {
    abstract = absMatch[1].replace(/<[^>]+>/g, '').replace(/^Abstract:?\s*/i, '').trim()
  }

  // 剥离剩余 HTML 标签并保留换行
  let rawMarkdown = cleanHtml
    .replace(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, '\n\n## $1\n\n')
    .replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, '\n\n### $1\n\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    title,
    authors,
    abstract,
    markdown: rawMarkdown,
    wordCount: rawMarkdown.length
  }
}

/**
 * 纯客户端异步抓取并解析 arXiv 论文全文
 * @param {string} rawId arXiv 编号
 * @param {Object} options
 * @param {AbortSignal} [options.signal] 取消信号
 * @param {number} [options.timeout=20000] 超时时间毫秒数
 * @returns {Promise<{ ok: boolean, fullText: string, title: string, authors: string, abstract: string, wordCount: number, error?: string, isFallback?: boolean }>}
 */
export async function fetchArxivPaperFulltext(rawId, { signal, timeout = 20000 } = {}) {
  const cleanId = cleanArxivId(rawId)
  if (!cleanId) {
    return {
      ok: false,
      fullText: '',
      title: '',
      authors: '',
      abstract: '',
      wordCount: 0,
      error: '无效的 arXiv 论文编号'
    }
  }

  const htmlUrl = getArxivHtmlUrl(cleanId)

  // 带有超时的控制器
  const timeoutCtrl = new AbortController()
  const timer = setTimeout(() => timeoutCtrl.abort(), timeout)

  // 若传入外部 signal，联动触发
  if (signal) {
    signal.addEventListener('abort', () => timeoutCtrl.abort(), { once: true })
  }

  try {
    const res = await fetch(htmlUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: timeoutCtrl.signal
    })
    clearTimeout(timer)

    if (res.status === 200) {
      const htmlText = await res.text()
      const parsed = parseArxivHtmlToMarkdown(htmlText, cleanId)
      if (parsed.markdown && parsed.markdown.length > 200) {
        return {
          ok: true,
          fullText: parsed.markdown,
          title: parsed.title,
          authors: parsed.authors,
          abstract: parsed.abstract,
          wordCount: parsed.wordCount
        }
      }
    }

    if (res.status === 404) {
      return {
        ok: false,
        fullText: '',
        title: '',
        authors: '',
        abstract: '',
        wordCount: 0,
        error: '该论文在 arXiv 上尚未生成实验性 HTML 网页版本 (HTTP 404)'
      }
    }

    return {
      ok: false,
      fullText: '',
      title: '',
      authors: '',
      abstract: '',
      wordCount: 0,
      error: `抓取 arXiv HTML 失败，服务器返回 HTTP ${res.status}`
    }
  } catch (err) {
    clearTimeout(timer)
    if (signal?.aborted || timeoutCtrl.signal.aborted) {
      return {
        ok: false,
        fullText: '',
        title: '',
        authors: '',
        abstract: '',
        wordCount: 0,
        error: '获取 arXiv HTML 超时，请检查网络环境'
      }
    }
    return {
      ok: false,
      fullText: '',
      title: '',
      authors: '',
      abstract: '',
      wordCount: 0,
      error: `抓取 arXiv HTML 网络错误: ${err.message || '网络连接异常'}`
    }
  }
}
