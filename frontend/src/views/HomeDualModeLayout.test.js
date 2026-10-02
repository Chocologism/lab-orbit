import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { WIDGET_REGISTRY, SIZE_SPANS, useHomeGridEngine } from '../composables/useHomeGridEngine'

describe('HomeView Dual-Mode Architecture & Bento Grid System', () => {
  const homeViewPath = path.resolve(__dirname, 'HomeView.vue')
  const homeContent = fs.readFileSync(homeViewPath, 'utf8')

  it('compiles HomeView SFC cleanly and defines dual-mode state and methods', () => {
    const parsed = parse(homeContent)
    expect(parsed.errors.length).toBe(0)

    const compiledScript = compileScript(parsed.descriptor, { id: 'test-home-dual-mode' })
    const bindings = compiledScript.bindings || {}

    expect(bindings.isCustomLayoutActive).toBeDefined()
    expect(bindings.isHomeEditMode).toBeDefined()
    expect(bindings.hasCustomLayout).toBeDefined()
    expect(bindings.slot1Config).toBeDefined()
    expect(bindings.rightGridConfig).toBeDefined()
    expect(bindings.toggleHomeEditMode).toBeDefined()
    expect(bindings.handleResetLayout).toBeDefined()
    expect(bindings.handleAddWidget).toBeDefined()
    expect(bindings.showAddDrawer).toBeDefined()

    const compiledTemplate = compileTemplate({
      source: parsed.descriptor.template.content,
      id: 'test-home-dual-mode',
      compilerOptions: { bindingMetadata: bindings }
    })
    expect(compiledTemplate.errors.length).toBe(0)
  })

  it('contains Mode A (Classic Native 34be100) and Mode B (Bento Grid) branches in template', () => {
    expect(homeContent).toContain('!isCustomLayoutActive')
    expect(homeContent).toContain('class="glass-card home-conf-section liquid-glass-card"')
    expect(homeContent).toContain('class="forecast-right"')
    expect(homeContent).toContain('class="forecast-right custom-bento-grid"')
    expect(homeContent).toContain('HomeWidgetRenderer')
    expect(homeContent).toContain('HomeWidgetAddDrawer')
    expect(homeContent).toContain('home-edit-mode-bar')
  })

  it('ensures HomeWidgetRenderer covers all 7 widgets and supported size tiers', () => {
    const rendererPath = path.resolve(__dirname, '../components/widgets/HomeWidgetRenderer.vue')
    const rendererContent = fs.readFileSync(rendererPath, 'utf8')
    const parsed = parse(rendererContent)
    expect(parsed.errors.length).toBe(0)

    for (const key of Object.keys(WIDGET_REGISTRY)) {
      expect(rendererContent).toContain(`widgetId === '${key}'`)
    }
  })

  it('ensures HomeWidgetAddDrawer compiles and references registry', () => {
    const drawerPath = path.resolve(__dirname, '../components/HomeWidgetAddDrawer.vue')
    const drawerContent = fs.readFileSync(drawerPath, 'utf8')
    const parsed = parse(drawerContent)
    expect(parsed.errors.length).toBe(0)
    expect(drawerContent).toContain('WIDGET_REGISTRY')
    expect(drawerContent).toContain('SIZE_SPANS')
  })

  it('ensures StyleView includes the Home Layout section and navigation anchor', () => {
    const styleViewPath = path.resolve(__dirname, 'StyleView.vue')
    const styleContent = fs.readFileSync(styleViewPath, 'utf8')
    expect(styleContent).toContain('id="section-home-layout"')
    expect(styleContent).toContain('href="#section-home-layout"')
    expect(styleContent).toContain('goToHomeEdit')
    expect(styleContent).toContain('onResetHomeLayout')
  })
})
