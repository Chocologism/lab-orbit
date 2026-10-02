import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  useHomeGridEngine,
  resetHomeGridLayout,
  saveHomeGridLayout,
  syncHomeGridLayoutFromCloud,
  isUserLoggedIn,
  HOME_CUSTOM_LAYOUT_ACTIVE_KEY,
  HOME_GRID_STORAGE_KEY,
  DEFAULT_SLOT1_LAYOUT,
  DEFAULT_RIGHT_GRID_LAYOUT
} from './useHomeGridEngine'
import { accountApi } from '../api/client'

vi.mock('../api/client', () => ({
  accountApi: {
    getHomeLayout: vi.fn(),
    saveHomeLayout: vi.fn(),
    resetHomeLayout: vi.fn()
  }
}))

describe('Cross-Device Cloud Layout Sync', () => {
  let store = {}

  beforeEach(() => {
    store = {}
    global.localStorage = {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, val) => { store[key] = String(val) }),
      removeItem: vi.fn((key) => { delete store[key] }),
      clear: vi.fn(() => { store = {} })
    }
    global.window = {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    global.CustomEvent = class CustomEvent {
      constructor(type, eventInitDict) {
        this.type = type
        this.detail = eventInitDict?.detail
      }
    }
    vi.clearAllMocks()
    resetHomeGridLayout()
  })

  afterEach(() => {
    delete global.localStorage
    delete global.window
    delete global.CustomEvent
  })

  it('correctly detects login state', () => {
    expect(isUserLoggedIn()).toBe(false)
    localStorage.setItem('labhub_token', 'test-token')
    expect(isUserLoggedIn()).toBe(true)
  })

  it('does not call cloud APIs when user is not logged in', async () => {
    saveHomeGridLayout()
    expect(accountApi.saveHomeLayout).not.toHaveBeenCalled()

    resetHomeGridLayout()
    expect(accountApi.resetHomeLayout).not.toHaveBeenCalled()

    const res = await syncHomeGridLayoutFromCloud()
    expect(res).toBeNull()
    expect(accountApi.getHomeLayout).not.toHaveBeenCalled()
  })

  it('syncs custom layout down from cloud when logging in on a new device', async () => {
    localStorage.setItem('labhub_token', 'device-2-token')

    const mockCloudLayout = {
      slot1: {
        type: 'medium-wide',
        items: [
          { id: 'slot1-weather', widgetId: 'weather', size: 'medium-wide', slot1Index: 0 },
          { id: 'slot1-conferences', widgetId: 'conferences', size: 'medium-wide', slot1Index: 1 }
        ]
      },
      rightGrid: [
        { id: 'grid-next-seminar', widgetId: 'next-seminar', size: 'large', col: 1, row: 1, colSpan: 2, rowSpan: 4 },
        { id: 'grid-mailbox', widgetId: 'mailbox', size: 'small', col: 1, row: 5, colSpan: 2, rowSpan: 1 }
      ],
      updatedAt: 1727800000000
    }

    accountApi.getHomeLayout.mockResolvedValueOnce({
      has_custom_layout: true,
      layout: mockCloudLayout
    })

    const { slot1Config, rightGridConfig, hasCustomLayout } = useHomeGridEngine()
    expect(hasCustomLayout.value).toBe(false)

    await syncHomeGridLayoutFromCloud()

    expect(hasCustomLayout.value).toBe(true)
    expect(slot1Config.value.type).toBe('medium-wide')
    expect(slot1Config.value.items.length).toBe(2)
    expect(rightGridConfig.value.length).toBe(2)
    expect(localStorage.getItem(HOME_CUSTOM_LAYOUT_ACTIVE_KEY)).toBe('true')
    expect(localStorage.getItem(HOME_GRID_STORAGE_KEY)).toContain('medium-wide')
  })

  it('uploads local visitor layout to cloud on first login if cloud is empty', async () => {
    localStorage.setItem('labhub_token', 'new-user-token')
    accountApi.getHomeLayout.mockResolvedValueOnce({
      has_custom_layout: false,
      layout: null
    })
    accountApi.saveHomeLayout.mockResolvedValueOnce({ saved: true })

    const { slot1Config, rightGridConfig, hasCustomLayout } = useHomeGridEngine()
    slot1Config.value = {
      type: 'empty',
      items: []
    }
    saveHomeGridLayout(slot1Config.value, rightGridConfig.value)
    expect(hasCustomLayout.value).toBe(true)
    accountApi.saveHomeLayout.mockClear()

    await syncHomeGridLayoutFromCloud({ uploadLocalIfCloudEmpty: true })

    expect(accountApi.saveHomeLayout).toHaveBeenCalledTimes(1)
    const savedArg = accountApi.saveHomeLayout.mock.calls[0][0]
    expect(savedArg.slot1.type).toBe('empty')
  })

  it('resets local custom layout if cloud has been reset to default', async () => {
    localStorage.setItem('labhub_token', 'user-token')
    accountApi.getHomeLayout.mockResolvedValueOnce({
      has_custom_layout: false,
      layout: null
    })

    const { slot1Config, hasCustomLayout } = useHomeGridEngine()
    slot1Config.value = {
      type: 'empty',
      items: []
    }
    saveHomeGridLayout(slot1Config.value, [])
    expect(hasCustomLayout.value).toBe(true)

    await syncHomeGridLayoutFromCloud({ uploadLocalIfCloudEmpty: false })

    expect(hasCustomLayout.value).toBe(false)
    expect(slot1Config.value.type).toBe(DEFAULT_SLOT1_LAYOUT.type)
    expect(localStorage.getItem(HOME_CUSTOM_LAYOUT_ACTIVE_KEY)).toBeNull()
  })

  it('pushes layout to cloud asynchronously on save when logged in', () => {
    localStorage.setItem('labhub_token', 'user-token')
    accountApi.saveHomeLayout.mockResolvedValueOnce({ saved: true })

    saveHomeGridLayout()
    expect(accountApi.saveHomeLayout).toHaveBeenCalledTimes(1)
  })

  it('sends delete request to cloud asynchronously on reset when logged in', () => {
    localStorage.setItem('labhub_token', 'user-token')
    accountApi.resetHomeLayout.mockResolvedValueOnce({ reset: true })

    resetHomeGridLayout()
    expect(accountApi.resetHomeLayout).toHaveBeenCalledTimes(1)
  })
})
