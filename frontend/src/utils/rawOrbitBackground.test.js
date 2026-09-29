import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  RAW_ORBIT_MANIFEST,
  getOrLoadRawOrbitVideoUrl,
  getImmediateRawOrbitVideoUrl,
  getCachedRawOrbitVideoUrl,
  preloadRawOrbitVideo,
  revokeRawOrbitVideoUrl
} from './rawOrbitBackground'

describe('rawOrbitBackground utility', () => {
  it('exposes accurate manifest for the uncompressed original video', () => {
    expect(RAW_ORBIT_MANIFEST.totalSize).toBe(105165866)
    expect(RAW_ORBIT_MANIFEST.md5).toBe('afad758b27345848b2c28f9390dd7d5d')
    expect(RAW_ORBIT_MANIFEST.chunkUrls).toHaveLength(6)
    expect(RAW_ORBIT_MANIFEST.streamUrl).toBe('/api/video/earth-orbit')
  })

  it('can revoke video url safely without error', () => {
    expect(() => revokeRawOrbitVideoUrl()).not.toThrow()
  })

  it('falls back to streamUrl gracefully when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'))
    const url = await getOrLoadRawOrbitVideoUrl()
    expect(url).toBe('/api/video/earth-orbit')
  })

  it('provides immediate stream URL or cached URL without blocking', () => {
    const immediateUrl = getImmediateRawOrbitVideoUrl()
    expect(immediateUrl).toBeTruthy()
    expect(immediateUrl === '/api/video/earth-orbit' || immediateUrl.startsWith('blob:')).toBe(true)
  })

  it('safely triggers preload without throwing', () => {
    expect(() => preloadRawOrbitVideo()).not.toThrow()
  })
})
