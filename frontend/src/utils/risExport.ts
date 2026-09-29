import { decodeHtmlEntities } from './latex'

export interface PaperForRis {
  id?: number | string
  arxiv_id?: string
  title?: string
  authors?: string[] | string
  abstract?: string
  published_date?: string
  published?: string
  journal?: string
  doi?: string
  source_url?: string
  pdf_url?: string
  recommend_comment?: string
  recommender?: {
    name?: string
    real_name?: string
    identity?: string
  }
}

export interface PaperTranslationForRis {
  title?: string
  abstract?: string
}

/**
 * 将论文对象转为标准 RIS (Research Information Systems) 学术格式文本
 */
export function generatePaperRis(
  paper: PaperForRis,
  translation?: PaperTranslationForRis | null
): string {
  if (!paper) return ''

  const rawArxiv = String(paper.arxiv_id || '').trim()
  const cleanId = rawArxiv.replace(/^arXiv:/i, '').replace(/v\d+$/, '').trim()
  const title = decodeHtmlEntities(String(paper.title || cleanId).trim()).replace(/\r?\n/g, ' ')
  const abstract = decodeHtmlEntities(String(paper.abstract || '').trim()).replace(/\r?\n/g, ' ')
  const publishedDate = String(paper.published_date || paper.published || '').trim()
  const journal = String(paper.journal || '').trim()
  const doi = String(paper.doi || '').trim()

  const lines: string[] = []

  // Document Type: PREP (Preprint) or JOUR (Journal Article)
  lines.push('TY  - PREP')
  lines.push(`TI  - ${title}`)

  // Authors
  let authorsList: string[] = []
  if (Array.isArray(paper.authors)) {
    authorsList = paper.authors
  } else if (typeof paper.authors === 'string' && paper.authors) {
    authorsList = paper.authors.split(',').map(s => s.trim()).filter(Boolean)
  }

  for (const author of authorsList) {
    const cleanAuthor = author.trim()
    if (cleanAuthor) {
      lines.push(`AU  - ${cleanAuthor}`)
    }
  }

  // Publication date
  if (publishedDate) {
    lines.push(`DA  - ${publishedDate}`)
    const yearMatch = publishedDate.match(/\b(19\d{2}|20\d{2})\b/)
    if (yearMatch) {
      lines.push(`PY  - ${yearMatch[1]}`)
    }
  }

  // Journal or publication venue
  if (journal) {
    lines.push(`JF  - ${journal}`)
  }

  // DOI
  if (doi) {
    lines.push(`DO  - ${doi}`)
  }

  // URLs
  if (cleanId) {
    lines.push(`UR  - https://arxiv.org/abs/${cleanId}`)
    lines.push(`L1  - https://arxiv.org/pdf/${cleanId}.pdf`)
    lines.push(`M3  - arXiv:${cleanId}`)
  } else if (paper.source_url) {
    lines.push(`UR  - ${paper.source_url}`)
  }

  // Abstract
  if (abstract) {
    lines.push(`AB  - ${abstract}`)
  }

  // Notes: Recommender & Recommendation Comment
  const recommenderName = paper.recommender?.real_name || paper.recommender?.name || ''
  if (recommenderName) {
    const roleTag = paper.recommender?.identity === 'teacher' ? ' (导师)' : ''
    lines.push(`N1  - 推荐人: ${recommenderName}${roleTag}`)
  }

  if (paper.recommend_comment) {
    const cleanComment = decodeHtmlEntities(String(paper.recommend_comment)).replace(/\r?\n/g, ' ')
    lines.push(`N1  - 推荐理由: ${cleanComment}`)
  }

  // Notes: Chinese Academic Translation
  if (translation?.title) {
    lines.push(`N1  - 【学术中文标题】: ${decodeHtmlEntities(translation.title).replace(/\r?\n/g, ' ')}`)
  }
  if (translation?.abstract) {
    lines.push(`N1  - 【学术中文摘要】: ${decodeHtmlEntities(translation.abstract).replace(/\r?\n/g, ' ')}`)
  }

  lines.push('DB  - LabOrbit')
  lines.push('ER  - ')
  lines.push('') // Trailing newline

  return lines.join('\n')
}

/**
 * 触发 RIS 文件浏览器下载，MIME 类型指定为 application/x-research-info-systems 以唤起本地 Zotero
 */
export function downloadRisFile(
  paper: PaperForRis,
  translation?: PaperTranslationForRis | null
): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false

  const content = generatePaperRis(paper, translation)
  if (!content) return false

  const rawArxiv = String(paper.arxiv_id || '').trim()
  const cleanId = rawArxiv.replace(/^arXiv:/i, '').replace(/v\d+$/, '').trim()
  const baseName = cleanId || 'paper'
  const filename = `${baseName}_zotero.ris`

  const blob = new Blob([content], { type: 'application/x-research-info-systems;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)

  return true
}
