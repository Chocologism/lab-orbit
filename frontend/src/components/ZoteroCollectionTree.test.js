import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'

describe('ZoteroCollectionTree component', () => {
  const filePath = path.resolve(__dirname, 'ZoteroCollectionTree.vue')
  const content = fs.readFileSync(filePath, 'utf8')
  const parsed = parse(content)

  it('contains search filter input for Filter Collections', () => {
    const template = parsed.descriptor.template?.content || ''
    expect(template).toContain('class="zotero-tree-search-input"')
    expect(template).toContain('placeholder="Filter Collections"')
    expect(template).toContain('v-model="filterQuery"')
  })

  it('contains root node for 我的文库', () => {
    const template = parsed.descriptor.template?.content || ''
    expect(template).toContain('我的文库')
    expect(template).toContain('root-row')
    expect(template).toContain("selectCollection('')")
  })

  it('renders tree items with indent depth and expand arrow button', () => {
    const template = parsed.descriptor.template?.content || ''
    expect(template).toContain('tree-arrow-btn')
    expect(template).toContain('tree-node-icon folder-icon')
    expect(template).toContain('tree-node-title')
    expect(template).toContain('is-selected')
    expect(template).toContain('item.depth')
  })

  it('contains collapse/expand toggle controls in header', () => {
    const template = parsed.descriptor.template?.content || ''
    expect(template).toContain('zotero-tree-header')
    expect(template).toContain('zotero-tree-toggle-btn')
    expect(template).toContain('currentNameText')
  })

  it('defines reactive tree building and filtering logic in script setup', () => {
    const script = parsed.descriptor.scriptSetup?.content || ''
    expect(script).toContain('collectionMap')
    expect(script).toContain('treeData')
    expect(script).toContain('matchingKeys')
    expect(script).toContain('visibleFlattenedNodes')
    expect(script).toContain('expandAncestorsOf')
    expect(script).toContain('selectCollection')
    expect(script).toContain("emit('update:modelValue'")
  })

  it('includes authentic Zotero styling matching native connector UI', () => {
    const style = parsed.descriptor.styles[0]?.content || ''
    expect(style).toContain('.zotero-tree-container')
    expect(style).toContain('.zotero-tree-panel')
    expect(style).toContain('.zotero-tree-row')
    expect(style).toContain('#2563eb')
    expect(style).toContain('.tree-node-icon')
    expect(style).toContain('.folder-icon')
  })
})
