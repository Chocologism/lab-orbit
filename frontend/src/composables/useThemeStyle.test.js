import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('useThemeStyle', () => {
  const STORAGE_KEY = 'laborbit_theme_style'
  let store = {}
  let attrs = {}

  beforeEach(() => {
    store = {}
    attrs = {}

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, val) => { store[key] = String(val) }),
      removeItem: vi.fn((key) => { delete store[key] }),
      clear: vi.fn(() => { store = {} })
    }

    // Mock window & document
    global.window = {}
    global.document = {
      createElement: vi.fn(() => ({})),
      documentElement: {
        setAttribute: vi.fn((k, v) => { attrs[k] = v }),
        getAttribute: vi.fn((k) => attrs[k] || null),
        removeAttribute: vi.fn((k) => { delete attrs[k] })
      }
    }
  })

  afterEach(() => {
    delete global.localStorage
    delete global.window
    delete global.document
  })

  it('defaults to clouds-static for first-time visitors when localStorage is empty', async () => {
    const { currentThemeStyle } = await import('./useThemeStyle')
    expect(currentThemeStyle.value).toBe('clouds-static')
  })

  it('allows changing theme style and persists to localStorage and DOM', async () => {
    const { useThemeStyle, currentThemeStyle } = await import('./useThemeStyle')
    const { setThemeStyle } = useThemeStyle()

    setThemeStyle('galaxy')
    expect(currentThemeStyle.value).toBe('galaxy')
    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'galaxy')
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme-style', 'galaxy')
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-bg-style', 'galaxy')

    setThemeStyle('clouds-static')
    expect(currentThemeStyle.value).toBe('clouds-static')
    expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'clouds-static')
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme-style', 'clouds-static')
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-bg-style', 'clouds-static')
  })

  it('supports decoupled color schemes and backgrounds with DOM data attributes', async () => {
    const { useThemeStyle, currentColorScheme, currentBgType, colorSchemes, bgOptions } = await import('./useThemeStyle')
    const { setColorScheme, setBgType } = useThemeStyle()

    expect(colorSchemes).toHaveLength(3)
    expect(colorSchemes.map(s => s.id)).toEqual(['classic-cyan', 'obsidian-gray', 'nebula-purple'])
    expect(colorSchemes[0].colors).toBeDefined()
    expect(colorSchemes[0].colors.length).toBeGreaterThanOrEqual(3)

    expect(bgOptions).toHaveLength(4)
    expect(bgOptions.map(b => b.id)).toEqual(['clouds-static', 'galaxy', 'vanta-fog', 'custom-local'])

    // Change color scheme to obsidian-gray
    setColorScheme('obsidian-gray')
    expect(currentColorScheme.value).toBe('obsidian-gray')
    expect(localStorage.setItem).toHaveBeenCalledWith('laborbit_color_scheme', 'obsidian-gray')
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-color-scheme', 'obsidian-gray')

    // Change background type to galaxy
    setBgType('galaxy')
    expect(currentBgType.value).toBe('galaxy')
    expect(localStorage.setItem).toHaveBeenCalledWith('laborbit_bg_type', 'galaxy')
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-bg-type', 'galaxy')
  })

  it('supports toggling glass styles between liquid and frosted', async () => {
    const { useThemeStyle, currentGlassStyle, glassOptions, setGlassStyle } = await import('./useThemeStyle')
    expect(glassOptions).toHaveLength(2)
    expect(glassOptions.map(g => g.id)).toEqual(['liquid', 'frosted'])

    setGlassStyle('frosted')
    expect(currentGlassStyle.value).toBe('frosted')
    expect(localStorage.setItem).toHaveBeenCalledWith('laborbit_glass_style', 'frosted')
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-glass-style', 'frosted')

    setGlassStyle('liquid')
    expect(currentGlassStyle.value).toBe('liquid')
    expect(localStorage.setItem).toHaveBeenCalledWith('laborbit_glass_style', 'liquid')
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-glass-style', 'liquid')
  })

  it('migrates previous default users on legacy themes to classic-cyan and clouds-static', async () => {
    const { migratePreviousDefaultUsers, DEFAULT_MIGRATION_KEY } = await import('./useThemeStyle')
    store['laborbit_color_scheme'] = 'obsidian-gray'
    store['laborbit_bg_type'] = 'earth-orbit'
    delete store[DEFAULT_MIGRATION_KEY]

    migratePreviousDefaultUsers()

    expect(store['laborbit_color_scheme']).toBe('classic-cyan')
    expect(store['laborbit_bg_type']).toBe('clouds-static')
    expect(store[DEFAULT_MIGRATION_KEY]).toBe('1')
  })

  it('preserves user custom color scheme and local media during migration', async () => {
    const { migratePreviousDefaultUsers, DEFAULT_MIGRATION_KEY } = await import('./useThemeStyle')
    store['laborbit_color_scheme'] = 'custom'
    store['laborbit_bg_type'] = 'custom-local'
    delete store[DEFAULT_MIGRATION_KEY]

    migratePreviousDefaultUsers()

    expect(store['laborbit_color_scheme']).toBe('custom')
    expect(store['laborbit_bg_type']).toBe('custom-local')
    expect(store[DEFAULT_MIGRATION_KEY]).toBe('1')
  })

  it('supports pausing/freezing background video and persists to localStorage', async () => {
    const { useThemeStyle, isBgVideoPaused } = await import('./useThemeStyle')
    const { setBgVideoPaused, toggleBgVideoPaused } = useThemeStyle()

    setBgVideoPaused(true)
    expect(isBgVideoPaused.value).toBe(true)
    expect(localStorage.setItem).toHaveBeenCalledWith('laborbit_bg_video_paused', 'true')

    toggleBgVideoPaused()
    expect(isBgVideoPaused.value).toBe(false)
    expect(localStorage.setItem).toHaveBeenCalledWith('laborbit_bg_video_paused', 'false')
  })
})
