import { describe, it, expect } from 'vitest'
import { h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import fs from 'fs'
import path from 'path'
import AppIcon from './AppIcon.vue'
import IconWorkbench from './icons/IconWorkbench.vue'
import IconFeedPaper from './icons/IconFeedPaper.vue'
import IconPaperLibrary from './icons/IconPaperLibrary.vue'
import IconResourceDb from './icons/IconResourceDb.vue'
import IconSchedule from './icons/IconSchedule.vue'
import IconRobot from './icons/IconRobot.vue'
import IconStyle from './icons/IconStyle.vue'

describe('Sidebar Custom SVG Icons and Label Update', () => {
  const navbarPath = path.resolve(__dirname, 'Navbar.vue')
  const navbarContent = fs.readFileSync(navbarPath, 'utf8')

  const mobileNavPath = path.resolve(__dirname, 'MobileNavBar.vue')
  const mobileNavContent = fs.readFileSync(mobileNavPath, 'utf8')

  const mobileHeaderPath = path.resolve(__dirname, 'MobileHeader.vue')
  const mobileHeaderContent = fs.readFileSync(mobileHeaderPath, 'utf8')

  it('renders IconWorkbench with correct attributes', async () => {
    const html = await renderToString(h(IconWorkbench, { size: 21 }))
    expect(html).toMatch(/viewbox="0 0 1024 1024"/i)
    expect(html).toContain('width="21"')
    expect(html).toContain('height="21"')
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('icon-workbench')
  })

  it('renders IconFeedPaper as stroke-based SVG with fill=none', async () => {
    const html = await renderToString(h(IconFeedPaper, { size: 21 }))
    expect(html).toMatch(/viewbox="0 0 64 64"/i)
    expect(html).toContain('width="21"')
    expect(html).toContain('height="21"')
    expect(html).toContain('fill="none"')
    expect(html).toContain('stroke="currentColor"')
    expect(html).toContain('icon-feed-paper')
  })

  it('renders IconPaperLibrary with correct attributes', async () => {
    const html = await renderToString(h(IconPaperLibrary, { size: 21 }))
    expect(html).toMatch(/viewbox="0 0 1024 1024"/i)
    expect(html).toContain('width="21"')
    expect(html).toContain('height="21"')
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('icon-paper-library')
  })

  it('renders IconResourceDb with balanced viewBox and currentColor', async () => {
    const html = await renderToString(h(IconResourceDb, { size: 21 }))
    expect(html).toMatch(/viewbox="-48 -32 1120 1088"/i)
    expect(html).toContain('width="21"')
    expect(html).toContain('height="21"')
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('icon-resource-db')
  })

  it('renders IconSchedule with correct attributes and currentColor', async () => {
    const html = await renderToString(h(IconSchedule, { size: 21 }))
    expect(html).toMatch(/viewbox="0 0 1024 1024"/i)
    expect(html).toContain('width="21"')
    expect(html).toContain('height="21"')
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('icon-schedule')
  })

  it('renders IconRobot with stroke-based SVG and fill=none', async () => {
    const html = await renderToString(h(IconRobot, { size: 21 }))
    expect(html).toMatch(/viewbox="0 0 24 24"/i)
    expect(html).toContain('width="21"')
    expect(html).toContain('height="21"')
    expect(html).toContain('fill="none"')
    expect(html).toContain('stroke="currentColor"')
    expect(html).toContain('icon-robot')
  })

  it('renders IconStyle with correct viewBox and fill=currentColor', async () => {
    const html = await renderToString(h(IconStyle, { size: 21 }))
    expect(html).toMatch(/viewbox="0 0 1024 1024"/i)
    expect(html).toContain('width="21"')
    expect(html).toContain('height="21"')
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('icon-style')
    expect(html).toContain('M936.672')
  })

  it('AppIcon resolves all custom sidebar icon names and Chinese aliases', async () => {
    const names = [
      'workbench', 'feed-paper', 'paper-library', 'resource-db', 'schedule', 'calendar',
      'robot', 'bot', 'style', 'clothes',
      '工作台', '文献推荐', '文献库', '资料库', '学术日程', '风格', '服饰'
    ]
    for (const name of names) {
      const html = await renderToString(h(AppIcon, { name, size: 21 }))
      expect(html).toContain('<svg')
      expect(html).toContain('width="21"')
    }
  })

  it('Navbar.vue configures updated items and renames 教材资料 to 资料库', () => {
    expect(navbarContent).toContain("{ to: '/', label: '工作台', icon: 'workbench' }")
    expect(navbarContent).toContain("{ to: '/arxiv', label: '文献推荐', icon: 'feed-paper' }")
    expect(navbarContent).toContain("{ to: '/seminars', label: '学术日程', icon: 'schedule' }")
    expect(navbarContent).toContain("{ to: '/library', label: '文献库', icon: 'paper-library' }")
    expect(navbarContent).toContain("{ to: '/resources', label: '资料库', icon: 'resource-db' }")
    expect(navbarContent).not.toContain("{ to: '/resources', label: '教材资料'")
  })

  it('Navbar.vue configures AI assistant and Style items', () => {
    expect(navbarContent).toContain('to="/assistant"')
    expect(navbarContent).toContain('<AppIcon name="robot"')
    expect(navbarContent).toContain('AI 助手')
    expect(navbarContent).toContain('to="/style"')
    expect(navbarContent).toContain('<AppIcon name="style"')
    expect(navbarContent).toContain('风格')
  })

  it('Navbar.vue protects stroke-based icons from solid fill on hover', () => {
    expect(navbarContent).toContain('.iso-pro:hover .iso-icon :deep(svg:not([fill="none"]))')
    expect(navbarContent).toContain('.iso-pro:hover .iso-icon :deep(svg[fill="none"])')
  })

  it('MobileNavBar.vue configures updated items and renames 教材资料 to 资料库', () => {
    expect(mobileNavContent).toContain("{ to: '/', label: '工作台', icon: 'workbench', exact: true }")
    expect(mobileNavContent).toContain("{ to: '/arxiv', label: '文献推荐', icon: 'feed-paper' }")
    expect(mobileNavContent).toContain("{ to: '/seminars', label: '学术日程', icon: 'schedule' }")
    expect(mobileNavContent).toContain("{ to: '/resources', label: '资料库', icon: 'resource-db' }")
    expect(mobileNavContent).not.toContain("{ to: '/resources', label: '教材资料'")
  })

  it('MobileHeader.vue sets route title for /resources to 资料库 and /style to 个性风格', () => {
    expect(mobileHeaderContent).toContain("'/resources': '资料库'")
    expect(mobileHeaderContent).not.toContain("'/resources': '教材资料'")
    expect(mobileHeaderContent).toContain("'/style': '个性风格'")
  })
})
