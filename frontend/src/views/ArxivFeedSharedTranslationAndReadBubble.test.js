import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'

describe('ArxivFeed Shared Translation and Unread Bubble Dismissal', () => {
  const feedVuePath = path.resolve(__dirname, 'ArxivFeedView.vue')
  const feedContent = fs.readFileSync(feedVuePath, 'utf8')
  const parsed = parse(feedContent)
  const template = parsed.descriptor.template?.content || ''
  const script = parsed.descriptor.scriptSetup?.content || ''
  const style = parsed.descriptor.styles[0]?.content || ''

  const navbarPath = path.resolve(__dirname, '../components/Navbar.vue')
  const navbarContent = fs.readFileSync(navbarPath, 'utf8')

  const mobileNavPath = path.resolve(__dirname, '../components/MobileNavBar.vue')
  const mobileNavContent = fs.readFileSync(mobileNavPath, 'utf8')

  it('renders flip button when translation exists without requiring isAiReady', () => {
    expect(template).toContain('v-if="getPaperTranslation(paper)"')
    expect(template).toContain('class="translate-flip-btn button small"')
    expect(template).toContain("isChineseView(paper) ? '译文 (中)' : '原文 (EN)'")
  })

  it('provides admin-only AI re-translate button when translation exists and user is admin', () => {
    expect(template).toContain("v-if=\"currentUser?.role === 'admin' && isAiReady\"")
    expect(template).toContain('class="retranslate-action-btn button small secondary"')
    expect(template).toContain("@click=\"handleTranslatePaper(paper, true)\"")
    expect(template).toContain("AI重译")
  })

  it('provides first-time translate button for untranslated paper and saves to backend', () => {
    expect(template).toContain("@click=\"handleTranslatePaper(paper, false)\"")
    expect(script).toContain('arxivApi.saveTranslation(paper.id')
    expect(script).toContain("paper.title_zh = result.title")
    expect(script).toContain("paper.abstract_zh = result.abstract")
  })

  it('reads paper.title_zh and paper.abstract_zh in getPaperTranslation', () => {
    expect(script).toContain('if (paper?.title_zh && paper?.abstract_zh)')
    expect(script).toContain('title: paper.title_zh')
    expect(script).toContain('abstract: paper.abstract_zh')
  })

  it('defaults isChineseView to true when paper has translation', () => {
    expect(script).toContain('return Boolean(getPaperTranslation(paper))')
  })

  it('instantly clears unread badge and calls markArxivFeedViewed when entering /arxiv without marking all as read', () => {
    expect(script).toContain('markArxivFeedViewed()')
    expect(script).not.toContain('arxivApi.markAllRead()')
    expect(script).toContain('is_read_by_me: Boolean(paper.is_read_by_me)')
    expect(navbarContent).toContain("if (newPath === '/arxiv')")
    expect(navbarContent).toContain('markArxivFeedViewed()')
    expect(mobileNavContent).toContain("if (newPath === '/arxiv')")
    expect(mobileNavContent).toContain('markArxivFeedViewed()')
  })

  it('includes retranslate-action-btn in style declarations', () => {
    expect(style).toContain('.retranslate-action-btn')
    expect(style).toContain('.paper-meta .retranslate-action-btn')
  })
})
