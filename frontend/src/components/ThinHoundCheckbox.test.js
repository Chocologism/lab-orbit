import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'
import ThinHoundCheckbox from './ThinHoundCheckbox.vue'

describe('ThinHoundCheckbox component', () => {
  const filePath = path.resolve(__dirname, 'ThinHoundCheckbox.vue')
  const content = fs.readFileSync(filePath, 'utf8')
  const parsed = parse(content)

  it('defines component properly', () => {
    expect(ThinHoundCheckbox).toBeDefined()
  })

  it('contains check-input and checkbox-svg in template', () => {
    const template = parsed.descriptor.template?.content || ''
    expect(template).toContain('class="check-input"')
    expect(template).toContain('class="checkbox-svg"')
    expect(template).toContain('class="thin-hound-wrapper"')
  })

  it('strictly suppresses text selection and selection highlights in CSS', () => {
    const style = parsed.descriptor.styles[0]?.content || ''
    expect(style).toContain('user-select: none !important')
    expect(style).toContain('-webkit-user-select: none !important')
    expect(style).toContain('background: transparent !important')
    expect(style).toContain('.thin-hound-wrapper::selection')
  })

  it('slows down hand-drawn stroke animation to 0.62s for playful perceptible drawing process', () => {
    const style = parsed.descriptor.styles[0]?.content || ''
    expect(style).toContain('0.62s cubic-bezier(0.22, 1, 0.36, 1)')
    expect(style).toContain('stroke-dashoffset')
    expect(style).toContain('.path1')
  })

  it('supports array v-model and value prop in script setup', () => {
    const script = parsed.descriptor.scriptSetup?.content || ''
    expect(script).toContain('[Boolean, Array]')
    expect(script).toContain('Array.isArray(props.modelValue)')
    expect(script).toContain("['update:modelValue', 'change']")
    expect(script).toContain('props.value')
  })
})
