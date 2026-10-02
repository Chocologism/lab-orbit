import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { demoAxiosAdapter, initDemoStorage } from '../mock/demoAdapter'
import { useFavorites } from '../composables/favorites'

describe('Favorites Demo Mode & Composables Handling', () => {
  let store = {}

  beforeEach(() => {
    store = {}
    global.localStorage = {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, val) => { store[key] = String(val) },
      removeItem: (key) => { delete store[key] },
      clear: () => { store = {} }
    }
    initDemoStorage(true)
  })

  afterEach(() => {
    delete global.localStorage
  })

  it('demoAxiosAdapter returns an Array for GET /api/favorites', async () => {
    const res = await demoAxiosAdapter({
      url: '/api/favorites',
      method: 'get'
    })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.data)).toBe(true)
    expect(res.data.length).toBeGreaterThan(0)
    const first = res.data[0]
    expect(first).toHaveProperty('kind')
    expect(first).toHaveProperty('target')
    expect(first).toHaveProperty('item')
  })

  it('demoAxiosAdapter supports PUT and DELETE /api/favorites/:kind/:target', async () => {
    const putRes = await demoAxiosAdapter({
      url: '/api/favorites/paper/2401.99999',
      method: 'put'
    })
    expect(putRes.status).toBe(200)
    expect(putRes.data.saved).toBe(true)

    const getRes = await demoAxiosAdapter({
      url: '/api/favorites',
      method: 'get'
    })
    expect(getRes.data.some(f => f.kind === 'paper' && f.target === '2401.99999')).toBe(true)

    const delRes = await demoAxiosAdapter({
      url: '/api/favorites/paper/2401.99999',
      method: 'delete'
    })
    expect(delRes.status).toBe(200)
    expect(delRes.data.saved).toBe(false)

    const getResAfter = await demoAxiosAdapter({
      url: '/api/favorites',
      method: 'get'
    })
    expect(getResAfter.data.some(f => f.kind === 'paper' && f.target === '2401.99999')).toBe(false)
  })

  it('useFavorites composable safely handles array and non-array responses without crashing', () => {
    const { entries, saved } = useFavorites()
    
    // Normal array
    entries.value = [
      { kind: 'paper', target: '2403.08852' },
      { kind: 'book', target: '1' }
    ]
    expect(saved('paper', '2403.08852')).toBe(true)
    expect(saved('paper', 'non-existent')).toBe(false)
    expect(saved('book', '1')).toBe(true)

    // Robustness against malformed non-array input (e.g. legacy object { papers: [], books: [] })
    entries.value = { papers: [], books: [] }
    expect(() => saved('paper', '2403.08852')).not.toThrow()
    expect(saved('paper', '2403.08852')).toBe(false)
  })
})
