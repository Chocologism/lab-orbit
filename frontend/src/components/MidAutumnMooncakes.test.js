import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse, compileScript } from '@vue/compiler-sfc'
import { isMidAutumnFestival } from '../utils/midAutumn'

describe('MidAutumnMooncakes component', () => {
  const filePath = path.resolve(__dirname, 'MidAutumnMooncakes.vue')
  const content = fs.readFileSync(filePath, 'utf8')

  it('compiles SFC script setup properly', () => {
    const parsed = parse(content)
    const compiled = compileScript(parsed.descriptor, { id: 'test-mid-autumn-mooncakes' })
    const bindings = compiled.bindings || {}

    expect(bindings.isMidAutumn).toBeDefined()
    expect(bindings.mooncakes).toBeDefined()
  })

  it('contains essential template and style properties for falling animation and non-interactivity', () => {
    // 容器必须有 pointer-events: none 和 user-select: none，防止遮挡页面交互
    expect(content).toContain('pointer-events: none')
    expect(content).toContain('user-select: none')

    // 必须包含全屏定位与动画层
    expect(content).toContain('mid-autumn-mooncakes-container')
    expect(content).toContain('mooncake-fall-track')
    expect(content).toContain('mooncake-sway')
    expect(content).toContain('/assets/icons/mooncake.svg')
    expect(content).toContain('draggable="false"')

    // 必须有平滑下落和摆动关键帧
    expect(content).toContain('@keyframes mooncake-fall')
    expect(content).toContain('@keyframes mooncake-sway-motion')

    // 必须有减弱动态效果支持
    expect(content).toContain('prefers-reduced-motion')
  })

  it('verifies that Mid-Autumn Festival is correctly identified for today (2026-09-25)', () => {
    const today = new Date(2026, 8, 25)
    expect(isMidAutumnFestival(today)).toBe(true)
  })
})
