import { describe, it, expect, vi } from 'vitest'
import { cleanArxivId, getArxivHtmlUrl, parseArxivHtmlToMarkdown, fetchArxivPaperFulltext } from './arxivHtml'

describe('arxivHtml utility', () => {
  it('cleans various arxiv ID formats', () => {
    expect(cleanArxivId('2609.19132v1')).toBe('2609.19132v1')
    expect(cleanArxivId('arXiv:2609.19132v1')).toBe('2609.19132v1')
    expect(cleanArxivId('ARXIV:2401.00001')).toBe('2401.00001')
    expect(cleanArxivId(' 2502.03530.pdf ')).toBe('2502.03530')
    expect(cleanArxivId('https://arxiv.org/abs/2312.00752')).toBe('2312.00752')
    expect(cleanArxivId('https://arxiv.org/pdf/2312.00752.pdf')).toBe('2312.00752')
    expect(cleanArxivId('')).toBe('')
    expect(cleanArxivId(null)).toBe('')
  })

  it('generates standard arxiv html urls', () => {
    expect(getArxivHtmlUrl('2609.19132v1')).toBe('https://arxiv.org/html/2609.19132v1')
    expect(getArxivHtmlUrl('arXiv:2401.00001')).toBe('https://arxiv.org/html/2401.00001')
    expect(getArxivHtmlUrl('')).toBe('')
  })

  it('parses LaTeXML HTML into structured markdown with LaTeX math preservation', () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>arXiv:2609.19132 - Dark Matter Density in Galaxies</title>
        </head>
        <body>
          <div class="ltx_page_navbar">Navigation links to be stripped</div>
          <div class="ltx_TOC">TOC to be stripped</div>
          <article class="ltx_document">
            <h1 class="ltx_title ltx_title_document">Dark Matter Density in Nearby Galaxies</h1>
            <div class="ltx_authors">Yu-Chen Wang, Yingjie Peng</div>
            <div class="ltx_abstract">
              <h6 class="ltx_title">Abstract</h6>
              <p class="ltx_p">We present a comprehensive study of dark matter density profiles.</p>
            </div>
            <section class="ltx_section">
              <h2 class="ltx_title">1 Introduction</h2>
              <p class="ltx_p">
                Galactic halos follow the profile described by
                <math class="ltx_Math" alttext="\\rho(r)" display="inline">
                  <semantics>
                    <annotation encoding="application/x-tex">\\rho(r) = \\frac{\\rho_0}{(r/r_s)(1+r/r_s)^2}</annotation>
                  </semantics>
                </math>
                where <math class="ltx_Math" alttext="r_s"><semantics><annotation encoding="application/x-tex">r_s</annotation></semantics></math> is the scale radius.
              </p>
            </section>
            <section class="ltx_section">
              <h2 class="ltx_title">2 Observations and Methods</h2>
              <p class="ltx_p">The observations were conducted using MaNGA survey data.</p>
              <ul>
                <li>Sample selection criteria</li>
                <li>Kinematic fitting</li>
              </ul>
            </section>
            <section class="ltx_bibliography">
              <h2>References</h2>
              <p>Reference 1, Reference 2...</p>
            </section>
          </article>
        </body>
      </html>
    `

    const parsed = parseArxivHtmlToMarkdown(mockHtml, '2609.19132')
    expect(parsed.title).toContain('Dark Matter Density in Nearby Galaxies')
    expect(parsed.authors).toContain('Yu-Chen Wang')
    expect(parsed.abstract).toContain('comprehensive study of dark matter density profiles')
    expect(parsed.markdown).toContain('$\\rho(r) = \\frac{\\rho_0}{(r/r_s)(1+r/r_s)^2}$')
    expect(parsed.markdown).toContain('$r_s$')
    expect(parsed.markdown).not.toContain('Navigation links to be stripped')
    expect(parsed.markdown).not.toContain('TOC to be stripped')
    expect(parsed.wordCount).toBeGreaterThan(100)
  })

  it('safely handles empty or invalid html content', () => {
    const emptyParsed = parseArxivHtmlToMarkdown('', 'test')
    expect(emptyParsed.title).toBe('')
    expect(emptyParsed.markdown).toBe('')
    expect(emptyParsed.wordCount).toBe(0)
  })

  it('handles 404 response in fetchArxivPaperFulltext', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      text: async () => 'Not Found'
    })

    const res = await fetchArxivPaperFulltext('2001.00001')
    expect(res.ok).toBe(false)
    expect(res.error).toContain('404')

    globalThis.fetch = originalFetch
  })

  it('correctly identifies noise titles and header lines', async () => {
    const { isNoiseTitle, isNoiseHeaderLine } = await import('./arxivHtml')
    expect(isNoiseTitle('Draft version September 17, 2026 Typeset using L')).toBe(true)
    expect(isNoiseTitle('A TEX style file v3.0')).toBe(true)
    expect(isNoiseTitle('Compiled using MNRAS LaTeX style file v3.0')).toBe(true)
    expect(isNoiseTitle('arXiv:2609.17852')).toBe(true)
    expect(isNoiseTitle('2609.17852')).toBe(true)
    expect(isNoiseTitle('1801.01505')).toBe(true)
    expect(isNoiseTitle('')).toBe(true)
    expect(isNoiseTitle('Attention Is All You Need')).toBe(false)
    expect(isNoiseTitle('A Generalist Framework for Multi-Task Learning')).toBe(false)

    expect(isNoiseHeaderLine('Draft version September 17, 2026 Typeset using LaTeX')).toBe(true)
    expect(isNoiseHeaderLine('A TEX style file v3.0')).toBe(true)
    expect(isNoiseHeaderLine('Preprint 10 October 2018')).toBe(true)
    expect(isNoiseHeaderLine('Deep Residual Learning for Image Recognition')).toBe(false)
  })

  it('accurately parses paper titles from raw markdown while filtering draft and style noise', async () => {
    const { parseTitleFromMarkdown } = await import('./arxivHtml')

    // 模拟 arXiv:2609.17852 实际排版噪音
    const mdWithDraftNoise = `
Draft version September 17, 2026 Typeset using LaTeX default style in AASTeX631

The Origin of Chemical Inhomogeneity in Globular Clusters:
Evidence from High-Precision Stellar Spectroscopy

Alice Smith, Bob Jones
Department of Astronomy, Harvard University

ABSTRACT
Globular clusters show complex multiple stellar populations...
`
    const extracted1 = parseTitleFromMarkdown(mdWithDraftNoise)
    expect(extracted1).toBe('The Origin of Chemical Inhomogeneity in Globular Clusters: Evidence from High-Precision Stellar Spectroscopy')

    // 模拟 arXiv:1801.01505 实际宏包排版噪音
    const mdWithTexStyleNoise = `
A TEX style file v3.0
MNRAS 000, 1-15 (2018)
Compiled using MNRAS LaTeX style file v3.0

Magnetic Reconnection in Relativistic Magnetized Turbulence

John Doe
Max Planck Institute for Astrophysics

ABSTRACT
We investigate magnetic reconnection using 3D simulations...
`
    const extracted2 = parseTitleFromMarkdown(mdWithTexStyleNoise)
    expect(extracted2).toBe('Magnetic Reconnection in Relativistic Magnetized Turbulence')
  })

  it('supports removing paper from recent papers and sanitizes existing noise titles', async () => {
    const store = {}
    const originalLocalStorage = globalThis.localStorage
    globalThis.localStorage = {
      getItem: vi.fn(key => (store[key] !== undefined ? store[key] : null)),
      setItem: vi.fn((key, val) => {
        store[key] = String(val)
      }),
      removeItem: vi.fn(key => {
        delete store[key]
      }),
      clear: vi.fn(() => {
        for (const k in store) delete store[k]
      })
    }

    try {
      const {
        getRecentArxivPapers,
        saveRecentArxivPaper,
        removeRecentArxivPaper
      } = await import('./arxivHtml')

      const userScope = { username: 'test_researcher' }

      // 写入初始测试数据（包含正常论文和一篇噪音标题文献）
      saveRecentArxivPaper('2312.00752', 'Mamba: Linear-Time Sequence Modeling with Selective State Spaces', userScope)
      saveRecentArxivPaper('2609.17852', 'Draft version September 17, 2026 Typeset using L', userScope)

    let list = getRecentArxivPapers(userScope)
    expect(list.some(p => p.id === '2312.00752')).toBe(true)
    // 验证读取时自动将噪音标题净化为 fallback
    const noiseItem = list.find(p => p.id === '2609.17852')
    expect(noiseItem.title).toBe('arXiv:2609.17852')

    // 执行删除 2609.17852
    removeRecentArxivPaper('2609.17852', userScope)

    list = getRecentArxivPapers(userScope)
    expect(list.some(p => p.id === '2609.17852')).toBe(false)
    expect(list.some(p => p.id === '2312.00752')).toBe(true)

    // 验证 saveRecentArxivPaper 拒绝噪音标题覆盖已存在的有效标题
    saveRecentArxivPaper('2312.00752', 'Draft version 2026', userScope)
    list = getRecentArxivPapers(userScope)
    const mamba = list.find(p => p.id === '2312.00752')
    // 验证 getRecentArxivPapers 当存在有效元数据缓存时自动就地自愈
    const { META_CACHE_PREFIX } = await import('./arxivHtml')
    localStorage.setItem(
      `${META_CACHE_PREFIX}2609.17852`,
      JSON.stringify({ id: '2609.17852', title: 'Resolving 3 Exotic Hyperbolic-Umbilic Lensing Configurations' })
    )
    saveRecentArxivPaper('2609.17852', 'arXiv:2609.17852', userScope)
    list = getRecentArxivPapers(userScope)
    const healed = list.find(p => p.id === '2609.17852')
    expect(healed.title).toBe('Resolving 3 Exotic Hyperbolic-Umbilic Lensing Configurations')

    // 清理
    removeRecentArxivPaper('2312.00752', userScope)
    removeRecentArxivPaper('2609.17852', userScope)
    } finally {
      globalThis.localStorage = originalLocalStorage
    }
  })

  it('resolves paper metadata via DataCite official registry with CORS compatibility', async () => {
    const { resolveArxivPaperMetadata } = await import('./arxivHtml')

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockImplementation(async (url) => {
      if (url.includes('datacite.org')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              attributes: {
                titles: [{ title: 'Resolving 3 Exotic Hyperbolic-Umbilic Lensing Configurations in the "Cosmic Mantis"' }],
                creators: [{ name: 'Cerny, Catherine' }, { name: 'Sharon, Keren' }]
              }
            }
          })
        }
      }
      return { ok: false, status: 404 }
    })

    try {
      const meta = await resolveArxivPaperMetadata('2609.17852')
      expect(meta).not.toBeNull()
      expect(meta.title).toBe('Resolving 3 Exotic Hyperbolic-Umbilic Lensing Configurations in the "Cosmic Mantis"')
      expect(meta.authors).toContain('Cerny, Catherine')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
