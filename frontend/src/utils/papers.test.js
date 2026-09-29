import { describe, it, expect } from 'vitest'
import { isJournal, paperLabel, paperSource, paperRead, paperReadLabel, extractAllArxivIds, getPresentationArxivList } from './papers'

describe('frontend papers utils', () => {
  it('identifies journal / non-arxiv papers properly', () => {
    expect(isJournal({ arxiv_id: '2502.03530' })).toBe(false)
    expect(isJournal({ arxiv_id: 'doi:10.1038/s41586-020-2649-2' })).toBe(true)
    expect(isJournal({ arxiv_id: 'url:https://example.com' })).toBe(true)
    expect(isJournal({ arxiv_id: 'custom:1741764000' })).toBe(true)
    expect(isJournal({})).toBe(false)
  })

  it('formats paperLabel accurately for arXiv, DOI, and custom papers', () => {
    expect(paperLabel({ arxiv_id: '2502.03530' })).toBe('arXiv:2502.03530')
    expect(paperLabel({ arxiv_id: 'doi:10.1038/s41586-020-2649-2' })).toBe('DOI:10.1038/s41586-020-2649-2')
    expect(paperLabel({ arxiv_id: 'custom:1741764000' })).toBe('组会文献')
    expect(paperLabel({ arxiv_id: '', journal: 'Nature' })).toBe('Nature')
    expect(paperLabel({})).toBe('期刊论文')
  })

  it('generates paperSource correctly', () => {
    expect(paperSource({ arxiv_id: '2502.03530' })).toBe('https://arxiv.org/abs/2502.03530')
    expect(paperSource({ arxiv_id: 'doi:10.1038/abc' })).toBe('https://doi.org/10.1038/abc')
    expect(paperSource({ source_url: 'https://example.com/paper' })).toBe('https://example.com/paper')
  })

  it('generates paperRead and paperReadLabel correctly', () => {
    expect(paperRead({ arxiv_id: '2502.03530' })).toBe('https://arxiv.org/pdf/2502.03530')
    expect(paperRead({ arxiv_id: '2502.03530', pdf_url: 'https://cdn.example.com/test.pdf' })).toBe('https://cdn.example.com/test.pdf')
    expect(paperReadLabel({ arxiv_id: '2502.03530' })).toBe('打开 PDF ↗')
    expect(paperReadLabel({ arxiv_id: 'doi:10.1038/abc' })).toBe('文献原文 ↗')
  })

  it('parses arXiv HTML abstract page correctly', async () => {
    const { parseArxivAbsHtml } = await import('../../functions/api/utils/papers')
    const sampleHtml = `
      <h1 class="title mathjax"><span class="descriptor">Title:</span>Dark Matter-Baryon Separability Predicts the Dynamics of an Almost-Dark Galaxy</h1>
      <div class="authors"><span class="descriptor">Authors:</span><a href="...">Oem Trivedi</a>, <a href="...">Abraham Loeb</a></div>
      <blockquote class="abstract mathjax"><span class="descriptor">Abstract:</span>We extend the Dark Matter-Baryon Separability Condition...</blockquote>
      <meta name="citation_date" content="2026/09/09" />
      <span class="primary-subject">Cosmology and Nongalactic Astrophysics (astro-ph.CO)</span>
    `
    const meta = parseArxivAbsHtml(sampleHtml, '2609.10661')
    expect(meta.title).toBe('Dark Matter-Baryon Separability Predicts the Dynamics of an Almost-Dark Galaxy')
    expect(meta.authors).toEqual(['Oem Trivedi', 'Abraham Loeb'])
    expect(meta.published_date).toBe('2026-09-09')
    expect(meta.primary_category).toBe('astro-ph.CO')
    expect(meta.abstract).toBe('We extend the Dark Matter-Baryon Separability Condition...')
    expect(meta.pdf_url).toBe('https://arxiv.org/pdf/2609.10661.pdf')
    expect(meta.source_url).toBe('https://arxiv.org/abs/2609.10661')
  })

  it('extractAllArxivIds extracts and deduplicates multiple modern and legacy arXiv IDs', () => {
    const input = 'Check out https://arxiv.org/abs/2302.13971v2 and 2401.00123; also hep-th/9901001 and https://arxiv.org/pdf/2302.13971.pdf'
    const result = extractAllArxivIds(input)
    expect(result).toEqual(['2302.13971v2', '2401.00123', 'hep-th/9901001'])
  })

  it('extractAllArxivIds ignores calendar dates and IP addresses without false positives', () => {
    const text = 'Meeting on 2024.12.01 at server 192.168.1.1 about arXiv:2302.13971'
    const result = extractAllArxivIds(text)
    expect(result).toEqual(['2302.13971'])
  })

  it('getPresentationArxivList handles multiple, single, empty, and non-arxiv strings', () => {
    expect(getPresentationArxivList('2302.13971, 2401.00123')).toEqual(['2302.13971', '2401.00123'])
    expect(getPresentationArxivList('https://arxiv.org/abs/2302.13971')).toEqual(['2302.13971'])
    expect(getPresentationArxivList('')).toEqual([])
    expect(getPresentationArxivList(null)).toEqual([])
    expect(getPresentationArxivList('Custom Topic Presentation')).toEqual(['Custom Topic Presentation'])
  })
})
