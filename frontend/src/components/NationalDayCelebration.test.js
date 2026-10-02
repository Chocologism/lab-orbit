import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse, compileScript } from '@vue/compiler-sfc'
import { isNationalDayHoliday } from '../utils/nationalDay'

describe('NationalDayCelebration component', () => {
  const filePath = path.resolve(__dirname, 'NationalDayCelebration.vue')
  const content = fs.readFileSync(filePath, 'utf8')

  it('compiles SFC script setup properly', () => {
    const parsed = parse(content)
    const compiled = compileScript(parsed.descriptor, { id: 'test-national-day-celebration' })
    const bindings = compiled.bindings || {}

    expect(bindings.isNationalDay).toBeDefined()
    expect(bindings.flags).toBeDefined()
    expect(bindings.balloons).toBeDefined()
    expect(bindings.BALLOON_SVG_PATH).toBeDefined()
  })

  it('contains essential template and style properties for falling flags and rising balloons', () => {
    // 容器必须有 pointer-events: none 和 user-select: none，防止遮挡页面交互
    expect(content).toContain('pointer-events: none')
    expect(content).toContain('user-select: none')

    // 必须包含全屏定位与双轨动画层
    expect(content).toContain('national-day-celebration-container')
    expect(content).toContain('national-flag-fall-track')
    expect(content).toContain('national-flag-sway')
    expect(content).toContain('/assets/icons/national-flag.svg')
    expect(content).toContain('celebration-balloon-rise-track')
    expect(content).toContain('celebration-balloon-sway')
    expect(content).toContain('celebration-balloon-svg')
    expect(content).toContain('draggable="false"')

    // 必须包含红旗自上而下飘落关键帧
    expect(content).toContain('@keyframes national-flag-fall')
    expect(content).toContain('@keyframes national-flag-sway-motion')

    // 必须包含气球自下而上缓缓升空关键帧
    expect(content).toContain('@keyframes celebration-balloon-rise')
    expect(content).toContain('@keyframes celebration-balloon-sway-motion')

    // 必须有减弱动态效果支持
    expect(content).toContain('prefers-reduced-motion')
  })

  it('configures celebratory palette for colorful balloons', () => {
    // 包含喜庆红、金黄、玫瑰红、天蓝、暖橙、紫罗兰等多样配色
    expect(content).toContain('#ef4444')
    expect(content).toContain('#f59e0b')
    expect(content).toContain('#f43f5e')
    expect(content).toContain('#38bdf8')
    expect(content).toContain('#fb923c')
    expect(content).toContain('#c084fc')
  })

  it('verifies National Day holiday is correctly identified for 2026-10-02 (current date)', () => {
    const today = new Date(2026, 9, 2) // Month index 9 is October
    expect(isNationalDayHoliday(today)).toBe(true)
  })
})
