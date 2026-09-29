import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'
import SlidingSegmented from './SlidingSegmented.vue'

describe('SlidingSegmented component', () => {
  const filePath = path.resolve(__dirname, 'SlidingSegmented.vue')
  const content = fs.readFileSync(filePath, 'utf8')
  const parsed = parse(content)

  it('defines component and props properly', () => {
    expect(SlidingSegmented).toBeDefined()
  })

  it('contains glass-glider and slot in template', () => {
    const template = parsed.descriptor.template?.content || ''
    expect(template).toContain('glass-glider')
    expect(template).toContain('<slot></slot>')
    expect(template).toContain('class="sliding-segmented"')
  })

  it('defines dynamic glider positioning, border-radius conformance, and observers in script setup', () => {
    const script = parsed.descriptor.scriptSetup?.content || ''
    expect(script).toContain('gliderStyle')
    expect(script).toContain('updateGlider')
    expect(script).toContain('MutationObserver')
    expect(script).toContain('ResizeObserver')
    expect(script).toContain('activeEl')
    expect(script).toContain('offsetLeft')
    expect(script).toContain('offsetWidth')
    expect(script).toContain('borderRadius')
    expect(script).toContain('getComputedStyle')
  })

  it('includes cubic-bezier animation, glider-radius variable, and glassmorphism styling in CSS', () => {
    const style = parsed.descriptor.styles[0]?.content || ''
    expect(style).toContain('cubic-bezier(0.37, 1.95, 0.66, 0.56)')
    expect(style).toContain('backdrop-filter: blur(12px)')
    expect(style).toContain('.glass-glider')
    expect(style).toContain('linear-gradient')
    expect(style).toContain('var(--glider-radius, 8px)')
    expect(style).toContain('border-radius 0.25s ease')
  })

  it('suppresses horizontal scrollbars during animation and overflow', () => {
    const style = parsed.descriptor.styles[0]?.content || ''
    expect(style).toContain('scrollbar-width: none')
    expect(style).toContain('-ms-overflow-style: none')
    expect(style).toContain('.sliding-segmented::-webkit-scrollbar')
    expect(style).toContain('display: none !important')
  })
})
