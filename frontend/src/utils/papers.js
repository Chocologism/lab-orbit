export const isJournal = paper => /^(doi:|url:|custom:)/i.test(paper.arxiv_id || '')
export const paperLabel = paper => !paper.arxiv_id ? (paper.journal || '期刊论文') : paper.arxiv_id.startsWith('doi:') ? `DOI:${paper.arxiv_id.slice(4)}` : paper.arxiv_id.startsWith('url:') ? (paper.journal || '期刊论文') : paper.arxiv_id.startsWith('custom:') ? '组会文献' : `arXiv:${paper.arxiv_id}`
export const paperSource = paper => paper.source_url || (paper.arxiv_id?.startsWith('doi:') ? `https://doi.org/${paper.arxiv_id.slice(4)}` : isJournal(paper) ? '' : `https://arxiv.org/abs/${paper.arxiv_id}`)
export const paperRead = paper => paper.pdf_url || (isJournal(paper) ? paperSource(paper) : `https://arxiv.org/pdf/${paper.arxiv_id}`)
export const paperReadLabel = paper => !paper.pdf_url && isJournal(paper) ? '文献原文 ↗' : '打开 PDF ↗'

export const extractAllArxivIds = (input) => {
  if (!input) return []
  const clean = String(input).trim()
  const ids = []
  const seen = new Set()

  const modernRegex = /(?:arxiv(?:\.org\/(?:abs|pdf)\/|:)|(?<=[^\w.]|^))(\d{4}\.\d{4,5}(?:v\d+)?)(?!\d)(?:\.pdf)?/gi
  for (const match of clean.matchAll(modernRegex)) {
    const id = match[1]
    if (!id) continue
    const base = id.replace(/v\d+$/, '').toLowerCase()
    if (!seen.has(base)) {
      seen.add(base)
      ids.push(id)
    }
  }

  const oldRegex = /(?:arxiv(?:\.org\/(?:abs|pdf)\/|:)|(?<=[^\w.]|^))([a-zA-Z\-]+(?:\.[a-zA-Z]+)?\/\d{7})(?:\.pdf)?/gi
  for (const match of clean.matchAll(oldRegex)) {
    const id = match[1]
    if (!id) continue
    const base = id.toLowerCase()
    if (!seen.has(base)) {
      seen.add(base)
      ids.push(id)
    }
  }

  return ids
}

export const getPresentationArxivList = (arxivStr) => {
  if (!arxivStr) return []
  const ids = extractAllArxivIds(arxivStr)
  if (ids.length > 0) return ids
  const raw = String(arxivStr).trim()
  return raw ? [raw] : []
}
