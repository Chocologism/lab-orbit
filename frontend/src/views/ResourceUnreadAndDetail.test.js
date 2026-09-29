import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeUnreadBooks, useResourceUnread } from '../composables/resourceUnread'

describe('Resource Unread & Card Detail Features', () => {
  let store = {}

  beforeEach(() => {
    store = {}
    global.localStorage = {
      getItem: (key) => store[key] || null,
      setItem: (key, val) => { store[key] = String(val) },
      removeItem: (key) => { delete store[key] },
      clear: () => { store = {} }
    }
    global.window = {
      dispatchEvent: vi.fn()
    }
    global.CustomEvent = class {
      constructor(type, eventInitDict) {
        this.type = type
        this.detail = eventInitDict?.detail
      }
    }
  })

  afterEach(() => {
    delete global.localStorage
    delete global.window
    delete global.CustomEvent
    vi.restoreAllMocks()
  })

  it('correctly computes unread books for user favorites with recent updates', () => {
    const books = [
      { id: 101, title: 'Meneghetti Gravitational Lensing', category: '教材', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-25T12:00:00Z' },
      { id: 102, title: 'Astropy Tools', category: '工具', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' },
      { id: 103, title: 'NASA ADS', category: '网站', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-25T14:00:00Z' }
    ]

    // User only favorited book 101
    const favorites = [
      { kind: 'book', target: '101', saved_at: '2026-09-10T00:00:00Z' }
    ]

    const result = computeUnreadBooks(books, favorites)
    expect(result.unreadCount).toBe(1)
    expect(result.unreadSet.has(101)).toBe(true)
    expect(result.unreadSet.has(103)).toBe(false) // Not favorited
    expect(result.preferredCategory).toBe('教材')
  })

  it('clears unread state when book is marked as viewed', () => {
    const books = [
      { id: 201, title: 'Cosmology Notes', category: '教材', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-25T12:00:00Z' }
    ]
    const favorites = [
      { kind: 'book', target: '201', saved_at: '2026-09-10T00:00:00Z' }
    ]

    const initial = computeUnreadBooks(books, favorites)
    expect(initial.unreadCount).toBe(1)

    const { markBookAsViewed, isBookUnread, unreadBookIds, unreadResourceCount } = useResourceUnread()
    unreadBookIds.value = new Set([201, '201'])
    unreadResourceCount.value = 1

    expect(isBookUnread(201)).toBe(true)

    markBookAsViewed(201)

    expect(isBookUnread(201)).toBe(false)
    expect(unreadResourceCount.value).toBe(0)
  })

  it('determines the correct file download label based on extension', () => {
    function getFileLabel(url) {
      if (!url) return '下载附件'
      const cleanUrl = url.split('?')[0].toLowerCase()
      if (cleanUrl.endsWith('.pdf')) return '打开 PDF'
      if (cleanUrl.endsWith('.zip') || cleanUrl.endsWith('.tar') || cleanUrl.endsWith('.gz') || cleanUrl.endsWith('.7z') || cleanUrl.endsWith('.rar')) return '下载压缩包'
      if (cleanUrl.endsWith('.ppt') || cleanUrl.endsWith('.pptx') || cleanUrl.endsWith('.key')) return '下载课件'
      if (cleanUrl.endsWith('.doc') || cleanUrl.endsWith('.docx')) return '下载文档'
      if (cleanUrl.endsWith('.xls') || cleanUrl.endsWith('.xlsx') || cleanUrl.endsWith('.csv')) return '下载表格'
      if (cleanUrl.endsWith('.py') || cleanUrl.endsWith('.ipynb') || cleanUrl.endsWith('.sh') || cleanUrl.endsWith('.json')) return '下载代码'
      if (cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.webp') || cleanUrl.endsWith('.svg')) return '查看图片'
      return '下载附件'
    }

    expect(getFileLabel('https://example.com/slides.pptx')).toBe('下载课件')
    expect(getFileLabel('/api/files/123/code.py')).toBe('下载代码')
    expect(getFileLabel('https://example.com/data.tar.gz')).toBe('下载压缩包')
    expect(getFileLabel('https://example.com/paper.pdf')).toBe('打开 PDF')
    expect(getFileLabel('https://example.com/notes.docx')).toBe('下载文档')
    expect(getFileLabel('https://example.com/custom_file.fits')).toBe('下载附件')
  })

  it('correctly tracks form changes for switching button text from 保存资料 to 更新资料', () => {
    const originalForm = {
      title: 'Original Title',
      authors: 'Author A',
      category: '教材',
      description: 'Original description',
      cover_url: '',
      tutorial_url: '',
      exercise_url: '',
      github_url: '',
      download_url: ''
    }

    const form = { ...originalForm }
    let editingId = 12

    function isFormChanged(current, original, id) {
      if (!id || !original) return false
      return JSON.stringify(current) !== JSON.stringify(original)
    }

    expect(isFormChanged(form, originalForm, editingId)).toBe(false)

    // User modifies description
    form.description = 'Updated description with new details'
    expect(isFormChanged(form, originalForm, editingId)).toBe(true)

    // Button text logic
    const buttonText = (editing, changed) => editing ? (changed ? '更新资料' : '保存资料') : '保存资料'
    expect(buttonText(editingId, isFormChanged(form, originalForm, editingId))).toBe('更新资料')

    // For new creation
    expect(buttonText(null, false)).toBe('保存资料')
  })
})
