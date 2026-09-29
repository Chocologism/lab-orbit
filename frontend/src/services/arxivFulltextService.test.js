import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SOURCE_MARKDOWN,
  SOURCE_HTML,
  SOURCE_TEX,
  SOURCE_OPTIONS,
  getCachedPaperFulltext,
  setCachedPaperFulltext,
  extractMainTexFromTar,
  fetchAlphaxivMarkdown,
  fetchPaperFulltextBySource
} from './arxivFulltextService.js'

describe('arxivFulltextService - Multi-source Fulltext Extraction', () => {
  let mockStore = {}

  beforeEach(() => {
    mockStore = {}
    global.localStorage = {
      getItem: vi.fn(k => mockStore[k] ?? null),
      setItem: vi.fn((k, v) => { mockStore[k] = String(v) }),
      removeItem: vi.fn(k => { delete mockStore[k] }),
      clear: vi.fn(() => { mockStore = {} })
    }
    vi.restoreAllMocks()
  })

  it('defines the three required fulltext sources with correct metadata', () => {
    expect(SOURCE_OPTIONS).toHaveLength(3)
    const ids = SOURCE_OPTIONS.map(o => o.id)
    expect(ids).toContain(SOURCE_MARKDOWN)
    expect(ids).toContain(SOURCE_HTML)
    expect(ids).toContain(SOURCE_TEX)
  })

  it('sets and retrieves local cached paper content', () => {
    const paperId = '1801.01505'
    const testData = {
      ok: true,
      source: SOURCE_MARKDOWN,
      fullText: '# Title\nContent',
      wordCount: 15
    }

    expect(getCachedPaperFulltext(paperId, SOURCE_MARKDOWN)).toBeNull()
    setCachedPaperFulltext(paperId, SOURCE_MARKDOWN, testData)

    const cached = getCachedPaperFulltext(paperId, SOURCE_MARKDOWN)
    expect(cached).not.toBeNull()
    expect(cached.fullText).toBe('# Title\nContent')
    expect(cached.wordCount).toBe(15)
  })

  it('extractMainTexFromTar extracts main .tex file from tar bytes', () => {
    // Construct a minimal 512-byte tar header + content block for ms.tex
    const tarBytes = new Uint8Array(1024)
    const encoder = new TextEncoder()

    // Filename "ms.tex" at offset 0
    const nameBytes = encoder.encode('ms.tex')
    tarBytes.set(nameBytes, 0)

    // Content at offset 512
    const content = '\\documentclass{article}\n\\begin{document}\nHello\\end{document}'
    const contentBytes = encoder.encode(content)

    // File size in octal at offset 124 (11 chars zero-padded + space)
    const sizeStr = contentBytes.length.toString(8).padStart(11, '0') + ' '
    tarBytes.set(encoder.encode(sizeStr), 124)

    tarBytes.set(contentBytes, 512)

    const extracted = extractMainTexFromTar(tarBytes)
    expect(extracted).toContain('\\begin{document}')
    expect(extracted).toContain('Hello')
  })

  it('fetchAlphaxivMarkdown correctly calls alphaxiv endpoint and parses markdown', async () => {
    const fakeMarkdown = '# Supernova Analysis\n\nABSTRACT\nThis paper discusses neutrino cosmologies.\n\n## Section 1\nDetails here.'
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => fakeMarkdown
    })

    const res = await fetchAlphaxivMarkdown('1801.01505')
    expect(res.ok).toBe(true)
    expect(res.source).toBe(SOURCE_MARKDOWN)
    expect(res.fullText).toBe(fakeMarkdown)
    expect(res.title).toBe('Supernova Analysis')
    expect(res.abstract).toContain('This paper discusses neutrino cosmologies.')
  })

  it('fetchPaperFulltextBySource returns cached data immediately when available', async () => {
    const paperId = '2401.00001'
    setCachedPaperFulltext(paperId, SOURCE_MARKDOWN, {
      ok: true,
      source: SOURCE_MARKDOWN,
      fullText: 'Cached Markdown Content',
      wordCount: 23
    })

    const fetchSpy = vi.fn()
    global.fetch = fetchSpy

    const res = await fetchPaperFulltextBySource(paperId, SOURCE_MARKDOWN)
    expect(res.ok).toBe(true)
    expect(res.cached).toBe(true)
    expect(res.fullText).toBe('Cached Markdown Content')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fetchPaperFulltextBySource falls back to html when markdown fails with autoFallback=true', async () => {
    // 1st call to alphaxiv fails with 404
    // 2nd call to arxiv html returns html (> 200 chars to satisfy markdown length requirement)
    const detailedHtml = `
      <article class="ltx_document">
        <h1 class="ltx_title_document">Gravitational Waves in Binary Black Hole Mergers</h1>
        <div class="ltx_authors">Albert Einstein, Nathan Rosen</div>
        <div class="ltx_abstract">Observation results of gravitational wave signatures and ripples across spacetime curvature.</div>
        <p>We present comprehensive cosmological and relativistic observations demonstrating the detection of gravitational waves emitted by colliding binary black holes in distant galaxies, confirming general relativistic field equations with unprecedented precision.</p>
      </article>
    `
    global.fetch = vi.fn().mockImplementation((url) => {
      if (String(url).includes('alphaxiv')) {
        return Promise.resolve({
          status: 404,
          ok: false,
          text: async () => 'Not found'
        })
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        text: async () => detailedHtml
      })
    })

    const res = await fetchPaperFulltextBySource('2301.00002', SOURCE_MARKDOWN, { autoFallback: true })
    expect(res.ok).toBe(true)
    expect(res.source).toBe(SOURCE_HTML)
    expect(res.title).toContain('Gravitational Waves')
    expect(res.abstract).toContain('Observation results')
    expect(res.fullText).toContain('binary black holes')
  })
})
