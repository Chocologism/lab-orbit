const DB_NAME = 'laborbit_local_assets'
const DB_VERSION = 2
const STORE_NAME = 'backgrounds'
const CACHE_KEY = 'system_default_earth_orbit'
const CUSTOM_BG_KEY = 'custom_bg'

export const RAW_ORBIT_MANIFEST = {
  id: 'earth-orbit-raw',
  totalSize: 105165866,
  md5: 'afad758b27345848b2c28f9390dd7d5d',
  mime: 'video/mp4',
  chunkUrls: [
    '/assets/forecast/raw/earth-orbit-part-00.bin',
    '/assets/forecast/raw/earth-orbit-part-01.bin',
    '/assets/forecast/raw/earth-orbit-part-02.bin',
    '/assets/forecast/raw/earth-orbit-part-03.bin',
    '/assets/forecast/raw/earth-orbit-part-04.bin',
    '/assets/forecast/raw/earth-orbit-part-05.bin'
  ],
  streamUrl: '/api/video/earth-orbit'
}

let cachedBlob = null
let cachedObjectUrl = null
let loadPromise = null

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'))
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('backgrounds')) {
        db.createObjectStore('backgrounds')
      }
      if (!db.objectStoreNames.contains('fonts')) {
        db.createObjectStore('fonts')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getFromIndexedDB() {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(CACHE_KEY)
      req.onsuccess = () => {
        const record = req.result
        if (record && record.blob && record.size === RAW_ORBIT_MANIFEST.totalSize) {
          resolve(record.blob)
          return
        }
        // 尝试从 custom_bg 迁移复用（如果用户此前已上传相同视频，直接 0ms 本地秒开）
        const customReq = store.get(CUSTOM_BG_KEY)
        customReq.onsuccess = () => {
          const customRec = customReq.result
          if (customRec && customRec.blob && (customRec.size === RAW_ORBIT_MANIFEST.totalSize || customRec.originalSize === RAW_ORBIT_MANIFEST.totalSize)) {
            // 异步备份至系统键
            saveToIndexedDB(customRec.blob).catch(() => {})
            resolve(customRec.blob)
          } else {
            resolve(null)
          }
        }
        customReq.onerror = () => resolve(null)
      }
      req.onerror = () => resolve(null)
    })
  } catch (e) {
    console.warn('Failed to query IndexedDB for raw orbit video:', e)
    return null
  }
}

async function saveToIndexedDB(blob) {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const record = {
        blob,
        name: 'earth-orbit-raw.mp4',
        type: 'video',
        mime: 'video/mp4',
        size: blob.size,
        updatedAt: Date.now()
      }
      const req = store.put(record, CACHE_KEY)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    console.warn('Failed to save raw orbit video to IndexedDB:', e)
  }
}

export async function getOrLoadRawOrbitVideoUrl() {
  if (cachedObjectUrl) {
    return cachedObjectUrl
  }

  if (loadPromise) {
    return loadPromise
  }

  loadPromise = (async () => {
    // 1. 尝试从本地 IndexedDB 读取
    const localBlob = await getFromIndexedDB()
    if (localBlob) {
      cachedBlob = localBlob
      cachedObjectUrl = URL.createObjectURL(localBlob)
      return cachedObjectUrl
    }

    // 2. 本地不存在，通过 CDN 并发拉取 6 个二进制切片
    try {
      const responses = await Promise.all(
        RAW_ORBIT_MANIFEST.chunkUrls.map(async (url) => {
          const res = await fetch(url)
          if (!res.ok) throw new Error('Chunk fetch failed: ' + url + ' (' + res.status + ')')
          return res.arrayBuffer()
        })
      )

      // 3. 拼接为完整未压缩的原版 Blob（严格二进制对齐，MD5 100% 吻合）
      const assembledBlob = new Blob(responses, { type: RAW_ORBIT_MANIFEST.mime })
      cachedBlob = assembledBlob
      cachedObjectUrl = URL.createObjectURL(assembledBlob)

      // 4. 异步持久化到 IndexedDB，下次访问 0 网络请求直接读取
      saveToIndexedDB(assembledBlob).catch((err) => {
        console.warn('Background caching to IndexedDB failed:', err)
      })

      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('laborbit-raw-orbit-ready', { detail: { url: cachedObjectUrl } }))
        } catch (_) {}
      }

      return cachedObjectUrl
    } catch (err) {
      console.warn('Failed to download and assemble raw orbit chunks, falling back to stream url:', err)
      return RAW_ORBIT_MANIFEST.streamUrl
    } finally {
      loadPromise = null
    }
  })()

  return loadPromise
}

export function getCachedRawOrbitVideoUrl() {
  return cachedObjectUrl
}

export function getImmediateRawOrbitVideoUrl() {
  if (cachedObjectUrl) {
    return cachedObjectUrl
  }
  preloadRawOrbitVideo()
  return RAW_ORBIT_MANIFEST.streamUrl
}

let isPreloadStarted = false
export function preloadRawOrbitVideo() {
  if (isPreloadStarted || typeof window === 'undefined') return
  isPreloadStarted = true

  const startPreload = () => {
    getOrLoadRawOrbitVideoUrl().catch(() => {})
  }

  // 避免首屏关键接口与海报图/字体加载争抢带宽，延迟 1.5 秒后在空闲期静默预载
  if ('requestIdleCallback' in window) {
    setTimeout(() => {
      window.requestIdleCallback(startPreload, { timeout: 3000 })
    }, 1500)
  } else {
    setTimeout(startPreload, 2000)
  }
}

if (typeof window !== 'undefined') {
  preloadRawOrbitVideo()
}

export function revokeRawOrbitVideoUrl() {
  if (cachedObjectUrl) {
    try {
      URL.revokeObjectURL(cachedObjectUrl)
    } catch (e) {}
    cachedObjectUrl = null
  }
}

