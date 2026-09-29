import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse, compileScript } from '@vue/compiler-sfc'

describe('HomeView Mid-Autumn Moon integration', () => {
  const filePath = path.resolve(__dirname, 'HomeView.vue')
  const content = fs.readFileSync(filePath, 'utf8')

  it('compiles HomeView script setup and provides isMidAutumn binding', () => {
    const parsed = parse(content)
    const compiled = compileScript(parsed.descriptor, { id: 'test-homeview-midautumn' })
    const bindings = compiled.bindings || {}

    expect(bindings.isMidAutumn).toBeDefined()
  })

  it('contains moon badge element next to group name with glowing animation', () => {
    expect(content).toContain('mid-autumn-moon-badge')
    expect(content).toContain('/assets/icons/moon.svg')
    expect(content).toContain('alt="中秋明月"')
    expect(content).toContain('宇宙结构与巡天大数据研究团组')
    expect(content).toContain('@keyframes mid-autumn-moon-glow')
  })
})
