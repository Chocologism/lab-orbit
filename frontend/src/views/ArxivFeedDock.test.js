import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'

describe('ArxivFeedView compact action dock and seminar slot picker', () => {
  const filePath = path.resolve(__dirname, 'ArxivFeedView.vue')
  const content = fs.readFileSync(filePath, 'utf8')
  const parsed = parse(content)
  const template = parsed.descriptor.template?.content || ''
  const style = parsed.descriptor.styles[0]?.content || ''

  it('renders compact action dock with brave-shrimp-86 style', () => {
    expect(template).toContain('class="paper-meta-actions paper-action-dock"')
    expect(template).toContain('dock-item pdf')
    expect(template).toContain('dock-item ai-discuss')
    expect(template).toContain('dock-item translate-flip')
    expect(template).toContain('dock-item zotero')
    expect(template).toContain('class="pdf-link button small secondary"')
    expect(template).toContain('class="discuss-ai-btn button small secondary"')
    expect(template).toContain('class="zotero-push-btn button small secondary"')
  })

  it('contains dedicated tooltip labels for all dock actions', () => {
    expect(template).toContain('class="tooltip"')
    expect(template).toContain('{{ paperReadLabel(paper) }}')
    expect(template).toContain('与AI讨论')
    expect(template).toContain('选为组会分享')
    expect(template).toContain('已是组会分享')
    expect(template).toContain('存入 Zotero')
  })

  it('includes brave-shrimp-86 cubic-bezier animation and dock styles', () => {
    expect(style).toContain('.paper-action-dock')
    expect(style).toContain('.dock-btn')
    expect(style).toContain('cubic-bezier(0.68, -0.55, 0.265, 1.55)')
    expect(style).toContain('.dock-item .tooltip')
    expect(style).toContain('border-radius: 50%')
  })

  it('hides native radio button dot in seminar slot picker', () => {
    expect(style).toContain('.seminar-slot-option input[type="radio"]')
    expect(style).toContain('opacity: 0')
    expect(style).toContain('pointer-events: none')
    expect(style).toContain('.seminar-slot-option.active')
  })

  it('integrates SlidingSegmented for feed toolbar scope filter', () => {
    expect(template).toContain('<SlidingSegmented class="segmented"')
    expect(content).toContain("import SlidingSegmented from '../components/SlidingSegmented.vue'")
  })
})
