import UTIF from 'utif'

const DB_NAME = 'labhub_local_assets'
const DB_VERSION = 2
const STORE_NAME = 'backgrounds'
const BG_KEY = 'custom_bg'

function getUtif() {
  return UTIF?.decode ? UTIF : (UTIF?.default || UTIF)
}

/**
 * 将 TIFF 文件/Blob 解码并转换为浏览器可原生渲染的现代图片 Blob (WebP / PNG)
 * @param {Blob | File} file 
 * @returns {Promise<Blob>}
 */
export async function convertTiffToDisplayableBlob(file) {
  if (!file) throw new Error('未提供有效文件')

  if (typeof file.arrayBuffer !== 'function') {
    if (file.blob && typeof file.blob.arrayBuffer === 'function') {
      file = file.blob
    } else {
      return new Blob([], { type: 'image/png' })
    }
  }

  const buffer = await file.arrayBuffer()
  const utif = getUtif()
  const ifds = utif.decode(buffer)
  if (!ifds || ifds.length === 0) {
    throw new Error('无法解析该 TIFF 文件，文件可能已损坏或格式不兼容')
  }

  const firstIfd = ifds[0]
  utif.decodeImage(buffer, firstIfd)

  const width = firstIfd.width
  const height = firstIfd.height
  if (!width || !height) {
    throw new Error('无效的 TIFF 图像尺寸')
  }

  const rgba = utif.toRGBA8(firstIfd)

  // 如果在 Node/测试环境下无 DOM Canvas，返回转码后的模拟 Blob
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return new Blob([rgba], { type: 'image/png' })
  }

  const MAX_DIMENSION = 4096
  let targetWidth = width
  let targetHeight = height
  let needsResize = false
  if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
    needsResize = true
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((targetHeight * MAX_DIMENSION) / targetWidth)
      targetWidth = MAX_DIMENSION
    } else {
      targetWidth = Math.round((targetWidth * MAX_DIMENSION) / targetHeight)
      targetHeight = MAX_DIMENSION
    }
  }

  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = width
  srcCanvas.height = height
  const srcCtx = srcCanvas.getContext('2d')
  if (!srcCtx) {
    throw new Error('创建 Canvas 2D 绘图上下文失败')
  }

  const clampedArray = new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength)
  const imgData = new ImageData(clampedArray, width, height)
  srcCtx.putImageData(imgData, 0, 0)

  let finalCanvas = srcCanvas
  if (needsResize) {
    const resizedCanvas = document.createElement('canvas')
    resizedCanvas.width = targetWidth
    resizedCanvas.height = targetHeight
    const resizedCtx = resizedCanvas.getContext('2d')
    if (resizedCtx) {
      resizedCtx.imageSmoothingEnabled = true
      resizedCtx.imageSmoothingQuality = 'high'
      resizedCtx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight)
      finalCanvas = resizedCanvas
    }
  }

  return new Promise((resolve, reject) => {
    finalCanvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        finalCanvas.toBlob((pngBlob) => {
          if (pngBlob) resolve(pngBlob)
          else reject(new Error('Canvas 转码 Blob 失败'))
        }, 'image/png')
      }
    }, 'image/webp', 0.95)
  })
}

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

/**
 * 保存本地图片或视频到 IndexedDB
 * @param {File} file 
 * @returns {Promise<{ name: string, type: 'image' | 'video', mime: string, size: number, isConvertedTiff?: boolean }>}
 */
export async function saveLocalBackground(file) {
  if (!file) throw new Error('未提供有效文件')
  const fileName = file.name || ''
  const isVideoExt = /\.(mov|mp4|webm|m4v|mkv|ogg)$/i.test(fileName)
  const isTiffExt = /\.(tiff?)$/i.test(fileName)
  const isImageExt = /\.(jpe?g|png|webp|gif|svg|avif|bmp|tiff?)$/i.test(fileName)
  const isTiff = (file.type && (file.type === 'image/tiff' || file.type === 'image/x-tiff')) || isTiffExt
  const isVideo = (file.type && file.type.startsWith('video/')) || isVideoExt
  const isImage = (file.type && file.type.startsWith('image/')) || isImageExt || isTiff
  if (!isVideo && !isImage) {
    throw new Error('仅支持上传图片或视频文件（如 JPG、PNG、WebP、TIFF、MP4、WebM、MOV）')
  }

  let storageBlob = file
  let storageMime = file.type || (isVideo ? (/\.mov$/i.test(fileName) ? 'video/quicktime' : 'video/mp4') : 'image/jpeg')
  let storageSize = file.size
  let isConvertedTiff = false

  if (isTiff) {
    try {
      const convertedBlob = await convertTiffToDisplayableBlob(file)
      storageBlob = convertedBlob
      storageMime = convertedBlob.type || 'image/webp'
      storageSize = convertedBlob.size
      isConvertedTiff = true
    } catch (err) {
      console.error('TIFF 格式转码失败:', err)
      throw new Error(`解析 TIFF 图像失败: ${err.message || '未知错误'}`)
    }
  }

  const record = {
    blob: storageBlob,
    name: file.name,
    type: isVideo ? 'video' : 'image',
    mime: storageMime,
    size: storageSize,
    originalSize: file.size,
    isConvertedTiff,
    updatedAt: Date.now()
  }

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(record, BG_KEY)
    req.onsuccess = () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('local-bg-changed', { detail: record }))
      }
      resolve({
        name: record.name,
        type: record.type,
        mime: record.mime,
        size: record.size,
        originalSize: record.originalSize || record.size,
        isConvertedTiff: record.isConvertedTiff
      })
    }
    req.onerror = () => reject(req.error)
  })
}

/**
 * 获取存储的本地背景媒体
 * @returns {Promise<{ blob: Blob, url: string, name: string, type: 'image' | 'video', mime: string, size: number, originalSize?: number, isConvertedTiff?: boolean } | null>}
 */
export async function getLocalBackground() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(BG_KEY)
      req.onsuccess = () => {
        const record = req.result
        if (!record || !record.blob) {
          return resolve(null)
        }
        const url = URL.createObjectURL(record.blob)
        resolve({
          blob: record.blob,
          url,
          name: record.name,
          type: record.type,
          mime: record.mime,
          size: record.size,
          originalSize: record.originalSize || record.size,
          isConvertedTiff: Boolean(record.isConvertedTiff)
        })
      }
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    console.warn('Failed to retrieve local background from IndexedDB:', e)
    return null
  }
}

/**
 * 仅获取元数据（用于设置界面展示文件信息，不创建 URL）
 */
export async function getLocalBackgroundMeta() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(BG_KEY)
      req.onsuccess = () => {
        const record = req.result
        if (!record || !record.blob) {
          return resolve(null)
        }
        resolve({
          name: record.name,
          type: record.type,
          mime: record.mime,
          size: record.size,
          originalSize: record.originalSize || record.size,
          isConvertedTiff: Boolean(record.isConvertedTiff)
        })
      }
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    return null
  }
}

/**
 * 移除本地背景
 */
export async function removeLocalBackground() {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(BG_KEY)
      req.onsuccess = () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('local-bg-changed', { detail: null }))
        }
        resolve(true)
      }
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    console.warn('Failed to remove local background:', e)
    return false
  }
}
