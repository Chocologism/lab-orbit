import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse, compileScript } from '@vue/compiler-sfc'

describe('ForecastAtmosphere Orbit Background integration', () => {
  const filePath = path.resolve(__dirname, 'ForecastAtmosphere.vue')
  const content = fs.readFileSync(filePath, 'utf8')

  it('compiles script setup properly with immediate orbit url and video references', () => {
    const parsed = parse(content)
    const compiled = compileScript(parsed.descriptor, { id: 'test-forecast-atmosphere' })
    const bindings = compiled.bindings || {}

    expect(bindings.defaultVideoRef).toBeDefined()
    expect(bindings.localVideoRef).toBeDefined()
    expect(bindings.rawOrbitUrl).toBeDefined()
    expect(bindings.isOrbitPlaying).toBeDefined()
    expect(bindings.loadRawOrbit).toBeDefined()
    expect(bindings.isUserIdle).toBeDefined()
    expect(bindings.IDLE_TIMEOUT_MS).toBeDefined()
    expect(bindings.handleVisibilityChange).toBeDefined()
    expect(bindings.resetUserActivity).toBeDefined()
  })

  it('contains persistent video element, 4K poster fallback, and smooth layer classes in template', () => {
    // 具有持久保活层，切换背景无需销毁重构 DOM
    expect(content).toContain('earth-orbit-media-layer')
    expect(content).toContain(":class=\"{ 'is-active': currentBgType === 'earth-orbit' }\"")

    // 默认具有可播放视频源，消除 null 空白期
    expect(content).toContain(":src=\"rawOrbitUrl || '/api/video/earth-orbit'\"")

    // 原生 4K 海报属性
    expect(content).toContain('poster="/assets/forecast/earth-orbit-poster.jpg"')
    expect(content).toContain('earth-orbit-poster-fallback')

    // 播放事件监听与本地视频 ref
    expect(content).toContain('@playing="onOrbitPlaying"')
    expect(content).toContain('ref="localVideoRef"')
  })

  it('has comprehensive power management and visibility/inactivity listeners', () => {
    expect(content).toContain('document.addEventListener(\'visibilitychange\', handleVisibilityChange)')
    expect(content).toContain('document.removeEventListener(\'visibilitychange\', handleVisibilityChange)')
    expect(content).toContain('pauseVideoForPowerSaving')
    expect(content).toContain('resumeVideoPlayback')
    expect(content).toContain('PreventUserIdleDisplaySleep')
  })
})
