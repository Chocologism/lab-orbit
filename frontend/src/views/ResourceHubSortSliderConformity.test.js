import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'

describe('ResourceHubView Sort Slider Shape Conformity', () => {
  const filePath = path.resolve(__dirname, 'ResourceHubView.vue')
  const content = fs.readFileSync(filePath, 'utf8')
  const parsed = parse(content)

  it('renders SlidingSegmented with resource-sort-segmented for sorting', () => {
    const template = parsed.descriptor.template?.content || ''
    expect(template).toContain('<SlidingSegmented class="segmented resource-sort-segmented"')
    expect(template).toContain('首字母排序')
    expect(template).toContain('收藏量排序')
  })

  it('configures capsule pill border-radius on container, buttons, and glider', () => {
    const styles = parsed.descriptor.styles.map(s => s.content).join('\n')
    
    // Outer container pill radius
    expect(styles).toMatch(/\.resource-sort-segmented\s*\{[^}]*border-radius:\s*9999px/)
    
    // Glider radius variable defined on container
    expect(styles).toMatch(/\.resource-sort-segmented\s*\{[^}]*--glider-radius:\s*9999px/)

    // Deep glider pill radius
    expect(styles).toMatch(/\.resource-sort-segmented\s*:deep\(\.glass-glider\)\s*\{[^}]*border-radius:\s*9999px\s*!important/)

    // Inner button pill radius
    expect(styles).toMatch(/\.resource-sort-segmented\s+button\s*\{[^}]*border-radius:\s*9999px/)
  })

  it('preserves clean transparent background for active button so glider renders seamlessly', () => {
    const styles = parsed.descriptor.styles.map(s => s.content).join('\n')
    expect(styles).toMatch(/\.resource-sort-segmented\s+button\.active\s*\{[^}]*background:\s*transparent\s*!important/)
  })
})
