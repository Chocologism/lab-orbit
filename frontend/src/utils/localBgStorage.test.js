import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('localBgStorage', () => {
  let mockStore = new Map()

  beforeEach(() => {
    mockStore = new Map()

    const mockIDB = {
      open: vi.fn(() => {
        const req = {
          result: {
            objectStoreNames: {
              contains: vi.fn(() => true)
            },
            createObjectStore: vi.fn(),
            transaction: vi.fn(() => ({
              objectStore: vi.fn(() => ({
                put: vi.fn((val, key) => {
                  mockStore.set(key, val)
                  const r = {}
                  setTimeout(() => r.onsuccess && r.onsuccess(), 0)
                  return r
                }),
                get: vi.fn((key) => {
                  const r = { result: mockStore.get(key) }
                  setTimeout(() => r.onsuccess && r.onsuccess(), 0)
                  return r
                }),
                delete: vi.fn((key) => {
                  mockStore.delete(key)
                  const r = {}
                  setTimeout(() => r.onsuccess && r.onsuccess(), 0)
                  return r
                })
              }))
            }))
          }
        }
        setTimeout(() => req.onsuccess && req.onsuccess(), 0)
        return req
      })
    }

    global.indexedDB = mockIDB
    global.URL = {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn()
    }
    global.window = {
      dispatchEvent: vi.fn()
    }
    global.CustomEvent = class {
      constructor(type, init) {
        this.type = type
        this.detail = init?.detail
      }
    }
  })

  afterEach(() => {
    delete global.indexedDB
    delete global.URL
    delete global.window
    delete global.CustomEvent
  })

  it('rejects unsupported file types', async () => {
    const { saveLocalBackground } = await import('./localBgStorage')
    const badFile = { name: 'test.pdf', type: 'application/pdf', size: 1024 }
    await expect(saveLocalBackground(badFile)).rejects.toThrow('仅支持上传图片或视频文件')
  })

  it('saves an image file and dispatches local-bg-changed event', async () => {
    const { saveLocalBackground, getLocalBackgroundMeta, getLocalBackground } = await import('./localBgStorage')
    const imgFile = { name: 'nebula.png', type: 'image/png', size: 2048 }

    const meta = await saveLocalBackground(imgFile)
    expect(meta.name).toBe('nebula.png')
    expect(meta.type).toBe('image')
    expect(global.window.dispatchEvent).toHaveBeenCalled()

    const fetchedMeta = await getLocalBackgroundMeta()
    expect(fetchedMeta.name).toBe('nebula.png')
    expect(fetchedMeta.type).toBe('image')

    const fetchedFull = await getLocalBackground()
    expect(fetchedFull.url).toBe('blob:mock-url')
    expect(fetchedFull.name).toBe('nebula.png')
  })

  it('removes local background and dispatches event with null', async () => {
    const { saveLocalBackground, removeLocalBackground, getLocalBackgroundMeta } = await import('./localBgStorage')
    const vidFile = { name: 'space.mp4', type: 'video/mp4', size: 5000 }
    await saveLocalBackground(vidFile)

    const removed = await removeLocalBackground()
    expect(removed).toBe(true)

    const metaAfter = await getLocalBackgroundMeta()
    expect(metaAfter).toBeNull()
  })

  it('correctly handles .mov video files even with empty or quicktime mime type', async () => {
    const { saveLocalBackground } = await import('./localBgStorage')
    const movFileWithMime = { name: 'space_flight.mov', type: 'video/quicktime', size: 12345 }
    const res1 = await saveLocalBackground(movFileWithMime)
    expect(res1.type).toBe('video')
    expect(res1.mime).toBe('video/quicktime')

    const movFileWithoutMime = { name: 'galaxy_timelapse.mov', type: '', size: 67890 }
    const res2 = await saveLocalBackground(movFileWithoutMime)
    expect(res2.type).toBe('video')
    expect(res2.mime).toBe('video/quicktime')
  })

  it('correctly decodes and converts .tiff / .tif images to displayable format', async () => {
    const { saveLocalBackground, getLocalBackgroundMeta, convertTiffToDisplayableBlob } = await import('./localBgStorage')
    const UTIF = (await import('utif')).default || (await import('utif'))
    
    // Create a valid 2x2 test TIFF image
    const rgba = new Uint8Array([
      255, 0, 0, 255,   0, 255, 0, 255,
      0, 0, 255, 255,   255, 255, 255, 255
    ])
    const tiffBuffer = UTIF.encodeImage(rgba, 2, 2)

    const tiffFile = {
      name: 'james_webb_deep_space.tiff',
      type: 'image/tiff',
      size: tiffBuffer.byteLength,
      arrayBuffer: async () => tiffBuffer
    }

    const res = await saveLocalBackground(tiffFile)
    expect(res.name).toBe('james_webb_deep_space.tiff')
    expect(res.type).toBe('image')
    expect(res.isConvertedTiff).toBe(true)
    expect(res.originalSize).toBe(tiffBuffer.byteLength)

    const meta = await getLocalBackgroundMeta()
    expect(meta.name).toBe('james_webb_deep_space.tiff')
    expect(meta.isConvertedTiff).toBe(true)
    expect(meta.originalSize).toBe(tiffBuffer.byteLength)

    // Test corrupted TIFF error handling
    const corruptedTiff = {
      name: 'corrupted.tif',
      type: 'image/tiff',
      size: 16,
      arrayBuffer: async () => new ArrayBuffer(16)
    }
    await expect(saveLocalBackground(corruptedTiff)).rejects.toThrow('解析 TIFF 图像失败')
  })
})
