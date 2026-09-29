import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'

describe('AssistantView Paper Discussion integration', () => {
  const filePath = path.resolve(__dirname, 'AssistantView.vue')
  const content = fs.readFileSync(filePath, 'utf8')
  const parsed = parse(content)

  it('decouples paper discussions into dedicated arxiv copilot tab and removes session-paper-banner from ordinary chat', () => {
    const template = parsed.descriptor.template?.content || ''
    // Ordinary chat template should no longer have the legacy paper banner
    expect(template).not.toContain('class="session-paper-banner"')
    expect(template).not.toContain('v-if="currentSession?.paperContext"')
    // Arxiv copilot component is mounted in arxiv mode
    expect(template).toContain('<ArxivPaperCopilot')
    expect(template).toContain(':initial-paper-id="arxivPaperId"')
  })

  it('uses clean chat icons for sidebar session list without old paperContext tagging', () => {
    const template = parsed.descriptor.template?.content || ''
    expect(template).not.toContain(":class=\"{ 'is-paper': Boolean(session.paperContext) }\"")
    expect(template).not.toContain('session.paperContext ? \'article\' : \'chat\'')
    expect(template).not.toContain('class="session-arxiv-tag"')
    expect(template).toContain('class="session-lead-icon"')
  })

  it('uses SlidingSegmented for mode switcher without alphaxiv-pill text and bound to activeMode', () => {
    const template = parsed.descriptor.template?.content || ''
    expect(template).toContain('<SlidingSegmented class="assistant-mode-tabs" :active-key="activeMode">')
    expect(template).toContain('普通对话')
    expect(template).toContain('与 arXiv 对话')
    expect(template).not.toContain('alphaXiv 伴读')
  })

  it('directly activates arxiv mode on discussArxiv or paperId query in script setup', () => {
    const script = parsed.descriptor.scriptSetup?.content || ''
    expect(script).toContain("activeMode.value = 'arxiv'")
    expect(script).toContain('cleanArxivId(route.query.paperId || route.query.discussArxiv)')
    expect(script).toContain("paperContext: null")
  })

  it('binds mode tab active styling to var(--accent)', () => {
    const style = parsed.descriptor.styles[0]?.content || ''
    expect(style).toContain('.assistant-mode-tabs')
    expect(style).toContain('.mode-tab-btn.active')
    expect(style).toContain('color: var(--accent)')
  })
})
