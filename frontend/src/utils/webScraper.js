/**
 * 网页深度抓取与会议/学术报告信息提取工具 (前端与测试共享逻辑)
 * 支持主页抓取、活动菜单与子栏目发现（Key dates、摘要征集、报名注册、会场、签证等）、
 * JSON-LD 结构化元数据提取、噪音与无关文本过滤清洗
 */

export function decodeHtmlEntities(str = '') {
  if (!str) return ''
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&bull;/gi, '•')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10))
      } catch {
        return ''
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16))
      } catch {
        return ''
      }
    })
}

/**
 * 过滤与清洗 HTML 文本，剔除时区列表、多语言列表、导航/页脚、弹窗等无关噪音
 */
export function cleanHtmlText(html = '') {
  if (!html) return ''
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // 剔除下拉选择框与选项（防止带入全世界几百个时区或语言列表）
    .replace(/<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>/gi, ' ')
    .replace(/<option\b[^<]*(?:(?!<\/option>)<[^<]*)*<\/option>/gi, ' ')
    // 剔除导航与页眉页脚
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<dialog\b[^<]*(?:(?!<\/dialog>)<[^<]*)*<\/dialog>/gi, ' ')
    // 剔除特定噪音容器（时区选择器、语言切换栏、通知弹窗、跳过链接、工具栏等）
    .replace(/<(?:div|section|aside)\b[^>]*\b(?:class|id)=["'][^"']*(?:timezone|language|toolbar|flashed|announcement|bypass|modal|dropdown|event-service-toolbar)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section|aside)>/gi, ' ')

  text = text
    .replace(/<\/(?:p|div|h[1-6]|li|tr|section|article|header|footer|aside|blockquote|table)>/gi, '\n')
    .replace(/<(?:br|hr)\s*\/?>/gi, '\n')

  text = text.replace(/<[^>]+>/g, ' ')
  text = decodeHtmlEntities(text)

  const lines = text
    .split(/\r?\n/)
    .map(line => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter(line => {
      if (!line || line.length === 0) return false
      // 过滤时区格式，如 "Africa/Abidjan", "America/New_York", "Asia/Shanghai"
      if (/^[A-Za-z]+(?:\/[A-Za-z_]+)+$/.test(line)) return false
      // 过滤时区 UI 提示文案
      if (/^(?:Choose timezone|Your profile timezone:|Use timezone based on:|Select a custom timezone|Custom|Event\/category)\b/i.test(line)) return false
      // 过滤多语言切换列表中的纯语言名
      if (/^(?:Deutsch|English|Español|Français|Italiano|Magyar|Polski|Português|Suomi|Svenska|Türkçe|Čeština|Монгол|Українська|中文|日本語)\s*(?:\([^)]+\))?$/i.test(line)) return false
      // 过滤日程视图格式切换
      if (/^Indico style(?:\s*-\s*.*)?$/i.test(line) || /^Indico Weeks View$/i.test(line)) return false
      // 过滤常见无关网站提示
      if (/^(?:Skip to main content|Go to the Indico Home Page|Powered by Indico|Oldest event|Older event|Newer event|Newest event)$/i.test(line)) return false
      return true
    })

  const deduplicatedLines = []
  let prev = ''
  for (const line of lines) {
    if (line !== prev) {
      deduplicatedLines.push(line)
      prev = line
    }
  }

  return deduplicatedLines.join('\n')
}

/**
 * 从页面 HTML 中优先提取主体内容容器，剔除包裹的导航 chrome
 */
export function extractMainContent(html = '') {
  if (!html) return ''
  const contentContainerRegexes = [
    /<div\b[^>]*\bclass=["'][^"']*(?:conference-page|page-content|conferenceDetails)[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    /<div\b[^>]*\bclass=["'][^"']*mainContent[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<div\b[^>]*\bid=["']main-content["'][^>]*>([\s\S]*?)<\/div>/i
  ]

  for (const regex of contentContainerRegexes) {
    const match = html.match(regex)
    if (match && match[1]) {
      const extracted = cleanHtmlText(match[1])
      if (extracted.trim().length > 60) {
        return extracted
      }
    }
  }

  return cleanHtmlText(html)
}

/**
 * 解析页面中的 JSON-LD (Schema.org Event) 结构化活动数据
 */
export function extractJsonLdEvent(html = '') {
  if (!html) return null
  const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      const eventObj = Array.isArray(data) 
        ? data.find(item => item && (item['@type'] === 'Event' || item['type'] === 'Event'))
        : ((data && (data['@type'] === 'Event' || data['type'] === 'Event')) ? data : null)

      if (eventObj) {
        const title = eventObj.name || ''
        const startDate = eventObj.startDate || ''
        const endDate = eventObj.endDate || ''
        let location = ''
        if (typeof eventObj.location === 'object' && eventObj.location) {
          const locName = eventObj.location.name || ''
          const locAddr = typeof eventObj.location.address === 'string'
            ? eventObj.location.address
            : (eventObj.location.address?.streetAddress || '')
          location = locName && locAddr ? `${locName} (${locAddr})` : (locName || locAddr)
        } else if (typeof eventObj.location === 'string') {
          location = eventObj.location
        }
        const description = eventObj.description || ''
        const url = eventObj.url || ''
        return {
          title,
          startDate,
          endDate,
          location,
          description,
          url
        }
      }
    } catch {}
  }
  return null
}

export function resolveAbsoluteUrl(href = '', base = '') {
  try {
    return new URL(href, base).href
  } catch {
    return ''
  }
}

const POSTER_KEYWORD_REGEX = /(?:poster|banner|flyer|haibao|fengmian|cover|kv|headline|main-pic|keynote|theme|topic|visual)/i
const IGNORE_IMAGE_REGEX = /(?:favicon|\.ico$|\.svg$|avatar|headshot|user-icon|arrow|badge|button|tracker|spacer|pixel|logo-mini|wechat|weixin|qq|facebook|twitter|linkedin|qrcode|share-icon)/i

// 核心活动子页面匹配关键词（新增 visa/签证、key-dates/关键日期等）
const SUBPAGE_KEYWORD_REGEX = /(?:program|schedule|agenda|timetable|calendar|registration|register|signup|submission|abstract|cfp|venue|hotel|accommodation|location|travel|speakers|keynote|committee|organization|dates|key-dates|important-dates|visa|fees|poster|flyer|invitation|announcement|日程|议程|注册|报名|投稿|征文|摘要|地点|会场|交通|住宿|酒店|签证|海报|组委会|组织机构|报告人|嘉宾|重要日期|关键日期|截止日期|截稿日期|大会日程)/i

const REGISTRATION_EXTERNAL_REGEX = /(?:wjx\.cn|wj\.qq\.com|huodongxing\.com|forms\.gle|docs\.google\.com\/forms|jinshuju\.net|wenjuan\.com)/i

export function parsePageHtml(html = '', pageUrl = '') {
  let title = ''
  const ogTitleMatch = html.match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i)
  if (ogTitleMatch) {
    title = decodeHtmlEntities(ogTitleMatch[1].trim())
  } else {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (titleMatch) {
      title = decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim())
    } else {
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
      if (h1Match) {
        title = decodeHtmlEntities(h1Match[1].replace(/<[^>]+>/g, '').trim())
      }
    }
  }

  let description = ''
  const descMatch = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
  if (descMatch) {
    description = decodeHtmlEntities(descMatch[1].trim())
  }

  const jsonLdEvent = extractJsonLdEvent(html)

  const imagesMap = new Map()

  const ogImageMatches = [
    html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i),
    html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i),
    html.match(/<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)
  ]
  for (const m of ogImageMatches) {
    if (m && m[1]) {
      const abs = resolveAbsoluteUrl(m[1].trim(), pageUrl)
      if (abs && !IGNORE_IMAGE_REGEX.test(abs)) {
        imagesMap.set(abs, (imagesMap.get(abs) || 0) + 15)
      }
    }
  }

  const imgTagRegex = /<img\b([^>]+)>/gi
  let imgMatch
  while ((imgMatch = imgTagRegex.exec(html)) !== null) {
    const attrs = imgMatch[1]
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i) || attrs.match(/\bdata-src=["']([^"']+)["']/i)
    if (!srcMatch || !srcMatch[1]) continue

    const rawSrc = srcMatch[1].trim()
    if (rawSrc.startsWith('data:') && !rawSrc.startsWith('data:image/jpeg') && !rawSrc.startsWith('data:image/png')) {
      continue
    }

    const absUrl = resolveAbsoluteUrl(rawSrc, pageUrl)
    if (!absUrl || absUrl.startsWith('data:')) continue
    if (IGNORE_IMAGE_REGEX.test(absUrl)) continue

    let score = 2
    const contextStr = `${attrs} ${absUrl}`
    if (POSTER_KEYWORD_REGEX.test(contextStr)) {
      score += 10
    }
    if (/\.(jpe?g|png|webp)($|\?)/i.test(absUrl)) {
      score += 2
    }
    if (/\b(?:width|height)=["'](?:[1-9]|10|20|30|40)["']/i.test(attrs)) {
      score -= 5
    }

    if (score > 0) {
      imagesMap.set(absUrl, Math.max(imagesMap.get(absUrl) || 0, score))
    }
  }

  const images = Array.from(imagesMap.entries())
    .map(([url, score]) => ({ url, score }))
    .sort((a, b) => b.score - a.score)

  let targetOrigin = ''
  let targetPath = ''
  try {
    const targetUrlObj = new URL(pageUrl)
    targetOrigin = targetUrlObj.origin
    targetPath = targetUrlObj.pathname.replace(/\/+$/, '')
  } catch {}

  const candidateLinksMap = new Map()
  let registrationUrl = ''

  // 1. 优先提取专属活动侧边栏/导航菜单中的所有栏目链接（如 Indico 的 conf_leftMenu / Event menu）
  const menuBlockMatch = html.match(/<(?:div|nav)\b[^>]*\b(?:class|id)=["'][^"']*(?:conf_leftMenu|event-menu|side-menu|conference-menu)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|nav)>/i)
    || html.match(/<h2\b[^>]*\bclass=["'][^"']*event-menu-heading[^"']*["'][^>]*>[\s\S]*?<ul\b[^>]*>([\s\S]*?)<\/ul>/i)

  if (menuBlockMatch) {
    const menuHtml = menuBlockMatch[1]
    const menuTagRegex = /<a\b([^>]*)\bhref=["']([^"'#]+)["']([^>]*)>([\s\S]*?)<\/a>/gi
    let mMatch
    while ((mMatch = menuTagRegex.exec(menuHtml)) !== null) {
      const rawHref = mMatch[2].trim()
      const linkText = decodeHtmlEntities(mMatch[4].replace(/<[^>]+>/g, '').trim())
      const absHref = resolveAbsoluteUrl(rawHref, pageUrl)
      if (!absHref || absHref.startsWith('javascript:') || absHref.startsWith('mailto:')) continue

      // 归一化 URL，去除 view/lang 查询参数及末尾斜杠
      let cleanKey = absHref
      try {
        const u = new URL(absHref)
        u.hash = ''
        u.searchParams.delete('view')
        u.searchParams.delete('lang')
        u.searchParams.delete('locale')
        cleanKey = u.href.replace(/\/+$/, '')
      } catch {}

      // 排除与主页自身完全相同的链接或纯 overview 链接
      if (cleanKey === pageUrl.replace(/\/+$/, '') || cleanKey === `${pageUrl.replace(/\/+$/, '')}/overview`) {
        continue
      }

      // 活动菜单内链接赋予最高基准分 (30 分)
      let menuScore = 30
      if (/key-dates|dates|日期|截止/i.test(cleanKey + ' ' + linkText)) menuScore += 10
      if (/abstract|submission|摘要|征集|投稿/i.test(cleanKey + ' ' + linkText)) menuScore += 8
      if (/registration|register|报名|注册/i.test(cleanKey + ' ' + linkText)) menuScore += 8
      if (/venue|hotel|location|会场|地点|酒店/i.test(cleanKey + ' ' + linkText)) menuScore += 6
      if (/visa|签证/i.test(cleanKey + ' ' + linkText)) menuScore += 6

      candidateLinksMap.set(cleanKey, { url: absHref, text: linkText, score: menuScore })
    }
  }

  // 2. 遍历页面所有 a 标签进行补充探测
  const aTagRegex = /<a\b([^>]*)\bhref=["']([^"'#]+)["']([^>]*)>([\s\S]*?)<\/a>/gi
  let aMatch
  while ((aMatch = aTagRegex.exec(html)) !== null) {
    const rawHref = aMatch[2].trim()
    const linkText = decodeHtmlEntities(aMatch[4].replace(/<[^>]+>/g, '').trim())
    const combinedContext = `${rawHref} ${linkText}`

    const absHref = resolveAbsoluteUrl(rawHref, pageUrl)
    if (!absHref || absHref.startsWith('javascript:') || absHref.startsWith('mailto:') || absHref.startsWith('tel:')) {
      continue
    }

    if (REGISTRATION_EXTERNAL_REGEX.test(absHref)) {
      registrationUrl = absHref
    } else if (!registrationUrl && /(?:register|registration|signup|baoming)/i.test(combinedContext) && !/(?:login|signin)/i.test(combinedContext)) {
      registrationUrl = absHref
    }

    // 过滤登录、登出、帮助、语言切换及常见无用链接
    if (/(?:login|signin|logout|register_account|change-language|getindico\.io|learn\.getindico)/i.test(absHref)) {
      continue
    }

    // 过滤日历视图格式导出链接（如 ?view=standard, ?view=standard_inline_minutes）
    if (/[?&]view=(?:standard|standard_inline_minutes|standard_numbered|standard_numbered_inline_minutes|indico_weeks_view)/i.test(absHref)) {
      continue
    }

    // 归一化 URL
    let cleanKey = absHref
    try {
      const u = new URL(absHref)
      u.hash = ''
      u.searchParams.delete('view')
      u.searchParams.delete('lang')
      u.searchParams.delete('locale')
      cleanKey = u.href.replace(/\/+$/, '')
    } catch {}

    if (cleanKey === pageUrl.replace(/\/+$/, '') || cleanKey === `${pageUrl.replace(/\/+$/, '')}/overview`) {
      continue
    }

    let linkOrigin = ''
    let linkPath = ''
    try {
      const u = new URL(absHref)
      linkOrigin = u.origin
      linkPath = u.pathname.replace(/\/+$/, '')
    } catch {
      continue
    }

    if (targetOrigin && linkOrigin === targetOrigin) {
      if (/\.(zip|rar|tar|gz|exe|dmg|mp4|avi|mp3|ics|xml)$/i.test(absHref)) {
        continue
      }

      const isSubPath = targetPath && linkPath.startsWith(targetPath)
      const matchesKeyword = SUBPAGE_KEYWORD_REGEX.test(combinedContext)

      if (matchesKeyword || isSubPath) {
        let score = 6
        if (/key-dates|dates|important-dates|重要日期|关键日期|截止日期|截稿日期/i.test(combinedContext)) score += 12
        if (/submission|abstract|cfp|call for abstracts|投稿|征文|摘要/i.test(combinedContext)) score += 10
        if (/registration|register|signup|registration info|注册|报名/i.test(combinedContext)) score += 10
        if (/venue|hotel|accommodation|location|travel|地点|会场|交通|住宿|酒店/i.test(combinedContext)) score += 9
        if (/visa|visa-information|签证/i.test(combinedContext)) score += 9
        if (/program|schedule|agenda|timetable|calendar|日程|议程/i.test(combinedContext)) score += 8
        if (/speakers|keynote|报告人|嘉宾/i.test(combinedContext)) score += 7
        if (/committee|organization|组委会|组织机构/i.test(combinedContext)) score += 5
        if (isSubPath) score += 5

        if (!candidateLinksMap.has(cleanKey) || (candidateLinksMap.get(cleanKey)?.score || 0) < score) {
          candidateLinksMap.set(cleanKey, { url: absHref, text: linkText, score })
        }
      }
    }
  }

  const candidateLinks = Array.from(candidateLinksMap.values())
    .sort((a, b) => b.score - a.score)

  const cleanedText = extractMainContent(html)

  return {
    title,
    description,
    jsonLdEvent,
    images,
    candidateLinks,
    registrationUrl,
    cleanedText
  }
}
