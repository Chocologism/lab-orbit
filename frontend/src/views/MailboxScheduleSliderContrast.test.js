import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'

describe('MailboxView Schedule Type Slider Contrast', () => {
  const filePath = path.resolve(__dirname, 'MailboxView.vue')
  const content = fs.readFileSync(filePath, 'utf8')
  const parsed = parse(content)

  it('renders SlidingSegmented for schedule-type-segmented in template', () => {
    const template = parsed.descriptor.template?.content || ''
    expect(template).toContain('<SlidingSegmented class="schedule-type-segmented">')
    expect(template).toContain('class="schedule-type-btn"')
  })

  it('ensures schedule-type-btn.active has high-contrast white text and does not use dark ink', () => {
    const styles = parsed.descriptor.styles.map(s => s.content).join('\n')
    expect(styles).toContain('.schedule-type-btn.active')
    expect(styles).not.toContain('.schedule-type-btn.active {\n  background: var(--accent);\n  color: var(--accent-ink')
    expect(styles).toMatch(/\.schedule-type-btn\.active\s*\{[^}]*color:\s*#ffffff\s*!important/)
    expect(styles).toMatch(/\.schedule-type-btn\.active\s*\{[^}]*background:\s*transparent\s*!important/)
  })
})
