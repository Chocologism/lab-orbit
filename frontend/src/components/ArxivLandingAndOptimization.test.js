import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'
import {
  cleanArxivId,
  getRecentArxivPapers,
  saveRecentArxivPaper
} from '../utils/arxivHtml.js'

describe('Arxiv Landing Screen & Performance Optimization Suite', () => {
  let mockStorage = {}

  beforeEach(() => {
    mockStorage = {}
    global.localStorage = {
      getItem: vi.fn(k => mockStorage[k] ?? null),
      setItem: vi.fn((k, v) => { mockStorage[k] = String(v) }),
      removeItem: vi.fn(k => { delete mockStorage[k] }),
      clear: vi.fn(() => { mockStorage = {} })
    }
  })

  it('thoroughly cleans arXiv URLs and identifiers', () => {
    expect(cleanArxivId('2312.00752')).toBe('2312.00752')
    expect(cleanArxivId('arXiv:2312.00752v2')).toBe('2312.00752v2')
    expect(cleanArxivId('https://arxiv.org/abs/2312.00752')).toBe('2312.00752')
    expect(cleanArxivId('https://arxiv.org/pdf/2312.00752.pdf')).toBe('2312.00752')
    expect(cleanArxivId('https://arxiv.org/html/2312.00752v1')).toBe('2312.00752v1')
  })

  it('persists and retrieves recent arXiv papers correctly in localStorage', () => {
    saveRecentArxivPaper('2312.00752', 'Gemini: A Family of Highly Capable Multimodal Models')
    saveRecentArxivPaper('2401.00001', 'Deep Learning Cosmology')

    const recents = getRecentArxivPapers()
    expect(recents).toHaveLength(2)
    expect(recents[0].id).toBe('2401.00001')
    expect(recents[1].id).toBe('2312.00752')

    // Deduplication check
    saveRecentArxivPaper('2312.00752', 'Updated Title')
    const updated = getRecentArxivPapers()
    expect(updated).toHaveLength(2)
    expect(updated[0].id).toBe('2312.00752')
    expect(updated[0].title).toBe('Updated Title')
  })

  it('confirms AssistantView has no hardcoded 1801.01505 fallback', () => {
    const assistantPath = path.resolve(__dirname, '../views/AssistantView.vue')
    const content = fs.readFileSync(assistantPath, 'utf8')
    expect(content).not.toContain("'1801.01505'")
    expect(content).not.toContain('"1801.01505"')
    expect(content).toContain("cleanArxivId(route.query.paperId || route.query.discussArxiv) || ''")
  })

  it('confirms ArxivPaperCopilot includes the landing screen and no 1801.01505 default', () => {
    const copilotPath = path.resolve(__dirname, './ArxivPaperCopilot.vue')
    const content = fs.readFileSync(copilotPath, 'utf8')
    const parsed = parse(content)

    expect(content).not.toContain("default: '1801.01505'")
    expect(content).not.toContain("|| '1801.01505'")

    const template = parsed.descriptor.template?.content || ''
    expect(template).toContain('class="arxiv-landing-screen"')
    expect(template).toContain('class="landing-input-box"')
    expect(template).toContain('class="recent-papers-list"')
    expect(template).toContain('class="feed-papers-list"')
  })

  it('confirms ArxivPdfViewer has no 1801.01505 seed and uses clean placeholder', () => {
    const pdfViewerPath = path.resolve(__dirname, './ArxivPdfViewer.vue')
    const content = fs.readFileSync(pdfViewerPath, 'utf8')

    expect(content).not.toContain('1801.01505')
    expect(content).toContain('getRecentArxivPapers(')
    expect(content).toContain('placeholder="如 2312.00752 或 arXiv 链接"')
  })

  it('verifies back-to-guide and back-to-landing interactions are present and clear', () => {
    const copilotPath = path.resolve(__dirname, './ArxivPaperCopilot.vue')
    const copilotContent = fs.readFileSync(copilotPath, 'utf8')
    expect(copilotContent).toContain('返回引导页')
    expect(copilotContent).toContain('title="保存当前研讨并返回伴读引导卡片页（历史记录随时可在下方继续）"')

    const pdfViewerPath = path.resolve(__dirname, './ArxivPdfViewer.vue')
    const pdfContent = fs.readFileSync(pdfViewerPath, 'utf8')
    expect(pdfContent).toContain('back-landing-btn')
    expect(pdfContent).toContain('title="退出当前文献，返回 arXiv 伴读工作台首页"')
    expect(pdfContent).toContain("emit('paper-change', '')")
  })

  it('strictly verifies sky blue colors (#38bdf8 / 56, 189, 248) are removed in favor of var(--accent)', () => {
    const copilotPath = path.resolve(__dirname, './ArxivPaperCopilot.vue')
    const copilotContent = fs.readFileSync(copilotPath, 'utf8')
    expect(copilotContent).not.toMatch(/#38bdf8/i)
    expect(copilotContent).not.toContain('56, 189, 248')
    expect(copilotContent).not.toMatch(/#0284c7/i)
    expect(copilotContent).not.toMatch(/#0ea5e9/i)

    const pdfViewerPath = path.resolve(__dirname, './ArxivPdfViewer.vue')
    const pdfContent = fs.readFileSync(pdfViewerPath, 'utf8')
    expect(pdfContent).not.toMatch(/#38bdf8/i)
    expect(pdfContent).not.toContain('56, 189, 248')
  })
})
