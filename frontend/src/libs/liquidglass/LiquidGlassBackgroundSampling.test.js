import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('LiquidGlass Background Sampling & Atmosphere Overlay Suite', () => {
  const liquidGlassJs = readFileSync(resolve(__dirname, 'index.js'), 'utf-8')
  const indexCss = readFileSync(resolve(__dirname, '../../index.css'), 'utf-8')

  it('unifies background overlay to pure neutral black with --bg-dim opacity across all backgrounds', () => {
    // Check that index.css uses pure neutral black gradients without chromatic tint (no green, no purple)
    expect(indexCss).toContain('linear-gradient(90deg, rgba(0, 0, 0, .38), rgba(0, 0, 0, .06) 65%, rgba(0, 0, 0, .18)), linear-gradient(0deg, rgba(0, 0, 0, .65), transparent 55%)')
    expect(indexCss).toContain('opacity:var(--bg-dim, 1);')
  })

  it('synchronizes liquid glass backdrop dimming with --bg-dim using pure neutral black', () => {
    // Verifies liquid glass samples --bg-dim factor and applies pure black overlays
    expect(liquidGlassJs).toContain("parseFloat(getComputedStyle(doc).getPropertyValue('--bg-dim')) || 1.0")
    expect(liquidGlassJs).toContain("g1.addColorStop(0, `rgba(0, 0, 0, ${(0.38 * dimFactor).toFixed(4)})`)")
    expect(liquidGlassJs).toContain("g1.addColorStop(0.65, `rgba(0, 0, 0, ${(0.06 * dimFactor).toFixed(4)})`)")
    expect(liquidGlassJs).toContain("g1.addColorStop(1, `rgba(0, 0, 0, ${(0.18 * dimFactor).toFixed(4)})`)")
    expect(liquidGlassJs).toContain("g2.addColorStop(0, `rgba(0, 0, 0, ${(0.65 * dimFactor).toFixed(4)})`)")
    expect(liquidGlassJs).toContain("g2.addColorStop(0.55, `rgba(0, 0, 0, 0.0)`)")
  })

  it('resolves tint from --bg rather than --panel-solid for custom color schemes', () => {
    // Should NOT parse --panel-solid for tint (which causes bright milky haze over background)
    expect(liquidGlassJs).not.toContain("const computedPanel = getComputedStyle(document.documentElement).getPropertyValue('--panel-solid')")
    // Should parse --bg to obtain the true dark background base color
    expect(liquidGlassJs).toContain("const computedBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()")
  })

  it('attaches image load listener to uncompleted custom media to auto-trigger markChanged', () => {
    expect(liquidGlassJs).toContain("customMedia.__lg_attached = true")
    expect(liquidGlassJs).toContain("customMedia.addEventListener('load', () => {")
    expect(liquidGlassJs).toContain("this.markChanged()")
  })

  it('ignores inactive earth-orbit video media layer during sampling and dynamic detection', () => {
    expect(liquidGlassJs).toContain("customMedia.closest('.earth-orbit-media-layer:not(.is-active)')")
    expect(liquidGlassJs).toContain("bgVideo.closest('.earth-orbit-media-layer:not(.is-active)')")
    expect(liquidGlassJs).toContain("vid.closest('.earth-orbit-media-layer:not(.is-active)')")
  })

  it('falls back to poster image when video is not ready for instant liquid glass refraction', () => {
    expect(liquidGlassJs).toContain("document.querySelector('img.earth-orbit-poster-fallback')")
    expect(liquidGlassJs).toContain("fallbackPoster.complete && fallbackPoster.naturalWidth > 0")
  })
})
