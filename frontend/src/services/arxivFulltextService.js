import {
  cleanArxivId,
  fetchArxivPaperFulltext,
  parseTitleFromMarkdown,
  isNoiseTitle,
  isNoiseHeaderLine,
  isLikelyAuthorLine
} from '../utils/arxivHtml.js'

export const SOURCE_MARKDOWN = 'markdown'
export const SOURCE_HTML = 'html'
export const SOURCE_TEX = 'tex'

export const SOURCE_OPTIONS = [
  {
    id: SOURCE_MARKDOWN,
    name: '已有 Markdown',
    label: '已有 Markdown (推荐 · 毫秒级)',
    badge: '推荐 · 极速',
    description: '通过 alphaXiv 全球 CDN 静态缓存获取，仅约 50KB 纯文本，秒开且格式规整'
  },
  {
    id: SOURCE_HTML,
    name: '官方 HTML',
    label: '官方 HTML (高保真公式)',
    badge: '公式保真',
    description: '通过 arXiv 官方 LaTeXML 服务抓取并转换为 Markdown，精准保留复杂数学公式'
  },
  {
    id: SOURCE_TEX,
    name: 'LaTeX .tex 源码',
    label: 'LaTeX .tex 源码 (最高保真原文)',
    badge: '原著源码',
    description: '直接从 arXiv 源码包解压主 .tex 文件，保留作者编写的原始 LaTeX 宏与文本'
  }
]

const CACHE_PREFIX = 'csbd_arxiv_ft_'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 天缓存

/**
 * 读取本地缓存
 */
export function getCachedPaperFulltext(cleanId, source) {
  if (!cleanId || typeof localStorage === 'undefined') return null
  try {
    const key = `${CACHE_PREFIX}${cleanId}_${source}`
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return entry.data
  } catch (_) {
    return null
  }
}

/**
 * 写入本地缓存
 */
export function setCachedPaperFulltext(cleanId, source, data) {
  if (!cleanId || !data || typeof localStorage === 'undefined') return
  try {
    const key = `${CACHE_PREFIX}${cleanId}_${source}`
    const entry = {
      timestamp: Date.now(),
      data
    }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch (_) {}
}

/**
 * 1. 抓取 alphaXiv 已预编译的 Markdown 文件
 */
export async function fetchAlphaxivMarkdown(cleanId, { signal, timeout = 15000 } = {}) {
  const candidateUrls = [
    `/api/arxiv/proxy-markdown/${cleanId}`,
    `https://www.alphaxiv.org/abs/${cleanId}.md`
  ]

  let lastError = ''

  for (const url of candidateUrls) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      })
      clearTimeout(timer)

      if (res.status === 200) {
        const text = await res.text()
        const isHtml = text.trim().startsWith('<') && (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('<article') || text.includes('<head') || text.includes('<body'))
        if (text && text.length > 50 && !isHtml) {
          // 提取标题、作者、发布日期与摘要全文
          let title = ''
          let authors = ''
          let abstract = ''
          let submittedDate = ''

          // 匹配发布或预印日期，如 Preprint 10 October 2018 或 Submitted 09 Oct 2018
          const dateMatch = text.match(/(?:Preprint|Submitted|Date:)\s+([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i)
          if (dateMatch) {
            submittedDate = dateMatch[1]
          }

          const parsedTitle = parseTitleFromMarkdown(text)
          if (parsedTitle && !isNoiseTitle(parsedTitle)) {
            title = parsedTitle
          }

          const lines = text.split('\n')
          const headerLines = []
          for (let i = 0; i < Math.min(lines.length, 50); i++) {
            const l = lines[i].trim()
            if (!l) continue
            if (isNoiseHeaderLine(l)) continue
            if (/^ABSTRACT/i.test(l)) break
            headerLines.push(l)
          }

          if (!title && headerLines.length > 0) {
            title = headerLines[0].replace(/^#+\s*/, '')
          }

          // 提取可能紧跟在标题后的作者行
          for (let i = 0; i < headerLines.length; i++) {
            const hl = headerLines[i].replace(/^#+\s*/, '')
            if (title && title.includes(hl)) continue
            if (isLikelyAuthorLine(hl) || hl.includes(',') || hl.includes('&') || /\band\b/i.test(hl)) {
              authors = hl
              break
            }
          }

          // 规范化作者姓名列表并剥离 LaTeX 角标
          if (authors) {
            authors = authors
              .replace(/[0-9?,*†‡]/g, '')
              .replace(/\band\b/gi, ',')
              .replace(/\s+/g, ' ')
              .replace(/,\s*,/g, ',')
              .trim()
          }

          // 提取完整 Abstract (避免截断)
          const absMatch = text.match(/(?:ABSTRACT|Abstract|摘要)\s*[\n\r]+([\s\S]*?)(?:\n\s*(?:\d+\.?\s+INTRODUCTION|1\s+Introduction|Key words|Keywords|##|\n\n\n))/i)
          if (absMatch && absMatch[1]) {
            abstract = absMatch[1].trim()
          } else {
            const absIdx = text.search(/ABSTRACT|Abstract|摘要/i)
            if (absIdx !== -1) {
              abstract = text.slice(absIdx, absIdx + 3000).replace(/^(ABSTRACT|Abstract|摘要)\s*/i, '').trim()
            }
          }

          return {
            ok: true,
            source: SOURCE_MARKDOWN,
            fullText: text,
            wordCount: text.length,
            title: title || `arXiv:${cleanId}`,
            abstract: abstract || '',
            authors: authors || '',
            submittedDate: submittedDate || ''
          }
        }
      }
      lastError = `HTTP ${res.status}`
    } catch (err) {
      clearTimeout(timer)
      lastError = err.message || '网络请求受限'
    }
  }

  return {
    ok: false,
    source: SOURCE_MARKDOWN,
    fullText: '',
    wordCount: 0,
    error: `抓取已有 Markdown 异常: ${lastError || '未能获取文件'}`
  }
}

/**
 * 2. 抓取 arXiv 官方 LaTeXML HTML
 */
export async function fetchArxivHtmlSource(cleanId, { signal, timeout = 25000 } = {}) {
  const res = await fetchArxivPaperFulltext(cleanId, { signal, timeout })
  if (res.ok) {
    return {
      ok: true,
      source: SOURCE_HTML,
      fullText: res.fullText,
      wordCount: res.wordCount,
      title: res.title,
      authors: res.authors,
      abstract: res.abstract
    }
  }
  return {
    ok: false,
    source: SOURCE_HTML,
    fullText: '',
    wordCount: 0,
    error: res.error || '获取 arXiv HTML 失败'
  }
}

/**
 * 解压 tar 字节包并提取主 .tex 源码文件
 */
export function extractMainTexFromTar(tarBytes) {
  const decoder = new TextDecoder('utf-8')
  let ptr = 0
  const texFiles = []

  while (ptr + 512 <= tarBytes.length) {
    const header = tarBytes.subarray(ptr, ptr + 512)
    // 遇到连续 0 字节块标识结束
    if (header.every(b => b === 0)) break

    let nameEnd = 0
    while (nameEnd < 100 && header[nameEnd] !== 0) nameEnd++
    const name = decoder.decode(header.subarray(0, nameEnd)).trim()

    let sizeStr = ''
    for (let i = 124; i < 136; i++) {
      if (header[i] === 0 || header[i] === 32) continue
      sizeStr += String.fromCharCode(header[i])
    }
    const size = parseInt(sizeStr, 8) || 0
    ptr += 512

    if (name && (name.endsWith('.tex') || name.endsWith('.latex') || name.endsWith('.ltx'))) {
      const fileData = tarBytes.subarray(ptr, ptr + size)
      texFiles.push({ name, size, data: fileData })
    }
    ptr += Math.ceil(size / 512) * 512
  }

  if (texFiles.length === 0) return ''

  // 寻找包含 \begin{document} 或最大的 tex 文件
  let mainFile = texFiles[0]
  for (const f of texFiles) {
    const content = decoder.decode(f.data)
    if (content.includes('\\begin{document}')) {
      mainFile = f
      break
    }
    if (f.size > mainFile.size) {
      mainFile = f
    }
  }

  return decoder.decode(mainFile.data)
}

/**
 * 3. 抓取 arXiv 源码包 (.tar.gz 或 .gz) 并提取 .tex 文件
 */
export async function fetchArxivTexSource(cleanId, { signal, timeout = 30000 } = {}) {
  const url = `https://arxiv.org/e-print/${cleanId}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal
    })
    clearTimeout(timer)

    if (!res.ok) {
      return {
        ok: false,
        source: SOURCE_TEX,
        fullText: '',
        wordCount: 0,
        error: `获取 arXiv 源码包失败 (HTTP ${res.status})`
      }
    }

    const arrayBuffer = await res.arrayBuffer()
    const rawBytes = new Uint8Array(arrayBuffer)

    // 检查是否具备 Gzip Magic Number (1f 8b)
    if (rawBytes.length < 2 || rawBytes[0] !== 0x1f || rawBytes[1] !== 0x8b) {
      // 部分较老文献或直接返回纯文本的情况
      const directText = new TextDecoder('utf-8').decode(rawBytes)
      if (directText.includes('\\begin{document}') || directText.includes('\\documentclass')) {
        return {
          ok: true,
          source: SOURCE_TEX,
          fullText: directText,
          wordCount: directText.length
        }
      }
      return {
        ok: false,
        source: SOURCE_TEX,
        fullText: '',
        wordCount: 0,
        error: 'arXiv 源码非标准 Gzip 格式'
      }
    }

    // 现代浏览器标准流式解压
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip')
      const writer = ds.writable.getWriter()
      writer.write(rawBytes)
      writer.close()

      const reader = ds.readable.getReader()
      const chunks = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0)
      const decompressed = new Uint8Array(totalLen)
      let offset = 0
      for (const c of chunks) {
        decompressed.set(c, offset)
        offset += c.length
      }

      // 判断是 tar 归档还是单个 .tex 源码
      let texContent = extractMainTexFromTar(decompressed)
      if (!texContent) {
        // 单个纯文本 .tex.gz 文件
        texContent = new TextDecoder('utf-8').decode(decompressed)
      }

      if (texContent && texContent.length > 100) {
        return {
          ok: true,
          source: SOURCE_TEX,
          fullText: texContent,
          wordCount: texContent.length,
          title: `arXiv:${cleanId} (.tex)`,
          authors: '',
          abstract: ''
        }
      }
    }

    return {
      ok: false,
      source: SOURCE_TEX,
      fullText: '',
      wordCount: 0,
      error: '无法从源码压缩包中解压有效的 .tex 文件'
    }
  } catch (err) {
    clearTimeout(timer)
    return {
      ok: false,
      source: SOURCE_TEX,
      fullText: '',
      wordCount: 0,
      error: `获取或解压 LaTeX 源码出错: ${err.message || '网络连接异常'}`
    }
  }
}

/**
 * 统一调度：按指定数据源获取论文全文（集成缓存与自动回退策略）
 * @param {string} rawId arXiv 编号
 * @param {'markdown'|'html'|'tex'} source 指定数据源
 * @param {Object} options
 * @param {boolean} [options.skipCache=false] 是否跳过本地缓存强制刷新
 * @param {boolean} [options.autoFallback=true] 失败时是否自动降级到备选源
 * @param {AbortSignal} [options.signal] 取消信号
 */
export async function fetchPaperFulltextBySource(rawId, source = SOURCE_MARKDOWN, { skipCache = false, autoFallback = true, signal } = {}) {
  const cleanId = cleanArxivId(rawId)
  if (!cleanId) {
    return {
      ok: false,
      source,
      fullText: '',
      wordCount: 0,
      error: '无效的 arXiv 编号'
    }
  }

  // 1. 尝试读取本地缓存
  if (!skipCache) {
    const cached = getCachedPaperFulltext(cleanId, source)
    if (cached) {
      return {
        ...cached,
        cached: true
      }
    }
  }

  // 2. 根据指定的源执行抓取
  let result = null

  if (source === SOURCE_MARKDOWN) {
    result = await fetchAlphaxivMarkdown(cleanId, { signal })
    // 若已有 Markdown 失败且开启自动降级，顺延尝试官方 HTML
    if (!result.ok && autoFallback) {
      const fallbackRes = await fetchArxivHtmlSource(cleanId, { signal })
      if (fallbackRes.ok) {
        result = fallbackRes
      }
    }
  } else if (source === SOURCE_HTML) {
    result = await fetchArxivHtmlSource(cleanId, { signal })
    // 若 HTML 404 且开启自动降级，尝试 Markdown
    if (!result.ok && autoFallback) {
      const fallbackRes = await fetchAlphaxivMarkdown(cleanId, { signal })
      if (fallbackRes.ok) {
        result = fallbackRes
      }
    }
  } else if (source === SOURCE_TEX) {
    result = await fetchArxivTexSource(cleanId, { signal })
    // 若 TeX 失败且开启自动降级，尝试 Markdown
    if (!result.ok && autoFallback) {
      const fallbackRes = await fetchAlphaxivMarkdown(cleanId, { signal })
      if (fallbackRes.ok) {
        result = fallbackRes
      }
    }
  }

  if (result && result.ok) {
    setCachedPaperFulltext(cleanId, result.source, result)
  }

  return result
}
