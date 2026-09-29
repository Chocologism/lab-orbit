import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'

describe('DemoModeBanner Live Demo Dock & Persistence', () => {
  const componentPath = path.resolve(__dirname, 'DemoModeBanner.vue')
  const content = fs.readFileSync(componentPath, 'utf8')
  const parsed = parse(content)
  const template = parsed.descriptor.template?.content || ''
  const styles = parsed.descriptor.styles?.map(s => s.content).join('\n') || ''

  it('keeps demo dock visible during tutorial without being hidden by showTutorial', () => {
    expect(template).toContain('v-if="isDemo"')
    expect(template).not.toContain('!showTutorial')
  })

  it('renders role switch, tutorial start and reset action buttons', () => {
    expect(template).toContain('handleStartTutorial')
    expect(template).toContain('handleToggleRole')
    expect(template).toContain('handleReset')
    expect(template).toContain('功能向导')
    expect(template).toContain('切身份')
    expect(template).toContain('重置')
  })

  it('places demo dock on top of tutorial overlay with high z-index', () => {
    expect(styles).toContain('z-index: 100000')
  })
})
