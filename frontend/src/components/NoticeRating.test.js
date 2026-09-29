import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'
import NoticeRating from './NoticeRating.vue'

describe('NoticeRating component', () => {
  const filePath = path.resolve(__dirname, 'NoticeRating.vue')
  const content = fs.readFileSync(filePath, 'utf8')
  const parsed = parse(content)
  const template = parsed.descriptor.template?.content || ''
  const style = parsed.descriptor.styles[0]?.content || ''

  it('defines props and events properly', () => {
    expect(NoticeRating).toBeDefined()
    expect(NoticeRating.props).toBeDefined()
    expect(NoticeRating.props.noticeId).toBeDefined()
  })

  it('contains the three rating faces from silly-insect-34 in template', () => {
    expect(template).toContain('class="rating-btn super-happy"')
    expect(template).toContain('class="rating-btn neutral"')
    expect(template).toContain('class="rating-btn super-sad"')
    expect(template).toContain('submitRating(\'super-happy\')')
    expect(template).toContain('submitRating(\'neutral\')')
    expect(template).toContain('submitRating(\'super-sad\')')
  })

  it('displays count pill for each rating category', () => {
    expect(template).toContain('class="count-pill"')
    expect(template).toContain("counts['super-happy']")
    expect(template).toContain("counts['neutral']")
    expect(template).toContain("counts['super-sad']")
  })

  it('defines silly-insect-34 style colors and transitions in CSS', () => {
    expect(style).toContain('rgb(0, 204, 79)')
    expect(style).toContain('rgb(232, 214, 0)')
    expect(style).toContain('rgb(239, 42, 16)')
    expect(style).toContain('.super-happy.active')
    expect(style).toContain('.neutral.active')
    expect(style).toContain('.super-sad.active')
  })
})
