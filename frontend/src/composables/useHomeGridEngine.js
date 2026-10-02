import { ref, computed } from 'vue'
import { accountApi } from '../api/client'

export const HOME_CUSTOM_LAYOUT_ACTIVE_KEY = 'laborbit_home_custom_layout_active_v3'
export const HOME_GRID_STORAGE_KEY = 'laborbit_home_grid_layout_v3'
export const HOME_EDIT_MODE_STORAGE_KEY = 'laborbit_home_edit_mode_v3'
export const HOME_GRID_CHANGED_EVENT = 'home-grid-layout-changed-v3'
export const HOME_EDIT_MODE_EVENT = 'home-edit-mode-changed-v3'

// 7 大小组件元数据定义
// 标准几何尺寸通用排序序列（最小 -> 小 -> 中 -> 大 -> 中宽 -> 宽）
export const CANONICAL_SIZE_ORDER = ['minimal', 'small', 'medium', 'large', 'medium-wide', 'wide']

// 7 大小组件元数据定义
export const WIDGET_REGISTRY = {
  'conferences': {
    id: 'conferences',
    name: '近期学术会议',
    icon: 'calendar',
    description: '近期国内外学术会议日程、截稿倒计时与参会指南',
    supportedSizes: ['minimal', 'small', 'medium', 'large', 'medium-wide', 'wide'],
    defaultSize: 'wide',
    defaultLocation: 'slot1'
  },
  'next-seminar': {
    id: 'next-seminar',
    name: '最近一次组会',
    icon: 'calendar',
    description: '团队下一次例行讨论排期、主讲人、议题大纲、地点与文献分享',
    supportedSizes: ['minimal', 'small', 'medium', 'large', 'medium-wide', 'wide'],
    defaultSize: 'large',
    defaultLocation: 'right'
  },
  'weather': {
    id: 'weather',
    name: '今日天气',
    icon: 'sun',
    description: '学术园区实时气温、温湿度、降水概率与天文视宁度观测适宜度',
    supportedSizes: ['minimal', 'small', 'medium', 'large', 'medium-wide', 'wide'],
    defaultSize: 'medium',
    defaultLocation: 'right'
  },
  'library': {
    id: 'library',
    name: '公共文献库',
    icon: 'book-open',
    description: '团队精选讨论论文、研究积累与前沿必读文献归档',
    supportedSizes: ['minimal', 'small', 'medium', 'large', 'medium-wide', 'wide'],
    defaultSize: 'small',
    defaultLocation: 'right'
  },
  'resources': {
    id: 'resources',
    name: '教材与资料',
    icon: 'database',
    description: '常用学术教材专著、讲义、代码库与实测数据资源',
    supportedSizes: ['minimal', 'small', 'medium', 'large', 'medium-wide', 'wide'],
    defaultSize: 'small',
    defaultLocation: 'right'
  },
  'arxiv': {
    id: 'arxiv',
    name: '文献推荐',
    icon: 'file-text',
    description: '每日 arXiv 最新前沿论文速递与学术导读评语',
    supportedSizes: ['minimal', 'small', 'medium', 'large', 'medium-wide', 'wide'],
    defaultSize: 'minimal',
    defaultLocation: 'right'
  },
  'mailbox': {
    id: 'mailbox',
    name: '学术邮箱',
    icon: 'envelope',
    description: '学术与机构邮箱直通，智能提取学术讲座日程与研讨会通知',
    supportedSizes: ['minimal', 'small', 'medium', 'large', 'medium-wide', 'wide'],
    defaultSize: 'minimal',
    defaultLocation: 'right'
  }
}

// 尺寸规范与网格占位跨度映射（基准单元 H = 68px, 间距 G = 10px）
export const SIZE_SPANS = {
  'minimal': { colSpan: 1, rowSpan: 1, label: '最小', desc: '1×1 微缩方块 (高68px, 宽半栏)' },
  'small': { colSpan: 2, rowSpan: 1, label: '小', desc: '2×1 单行横卡 (高68px, 宽全栏)' },
  'medium': { colSpan: 2, rowSpan: 2, label: '中', desc: '2×2 标准信息卡 (高146px)' },
  'large': { colSpan: 2, rowSpan: 4, label: '大', desc: '2×4 纵向多维大卡 (高302px)' },
  'wide': { colSpan: 2, rowSpan: 1, isSlot1: true, label: '宽', desc: '1号位专属全宽卡 (内含4个子卡片)' },
  'medium-wide': { colSpan: 1, rowSpan: 1, isSlot1: true, label: '中宽', desc: '1号位专属半宽卡 (并排2卡, 内含2个子卡片)' }
}

// 默认标准经典布局（与 34be100 完全一致）
export const DEFAULT_SLOT1_LAYOUT = {
  type: 'wide', // 'wide' | 'medium-wide' | 'empty'
  items: [
    { id: 'slot1-conferences', widgetId: 'conferences', size: 'wide' }
  ]
}

export const DEFAULT_RIGHT_GRID_LAYOUT = [
  { id: 'grid-next-seminar', widgetId: 'next-seminar', size: 'large', col: 1, row: 1, colSpan: 2, rowSpan: 4 },
  { id: 'grid-weather', widgetId: 'weather', size: 'medium', col: 1, row: 5, colSpan: 2, rowSpan: 2 },
  { id: 'grid-library', widgetId: 'library', size: 'small', col: 1, row: 7, colSpan: 2, rowSpan: 1 },
  { id: 'grid-resources', widgetId: 'resources', size: 'small', col: 1, row: 8, colSpan: 2, rowSpan: 1 },
  { id: 'grid-arxiv', widgetId: 'arxiv', size: 'minimal', col: 1, row: 9, colSpan: 1, rowSpan: 1 },
  { id: 'grid-mailbox', widgetId: 'mailbox', size: 'minimal', col: 2, row: 9, colSpan: 1, rowSpan: 1 }
]

export const MIN_GRID_ROWS = 9
export const TOTAL_GRID_COLS = 2

// 状态单例
const isHomeEditMode = ref(false)
const hasCustomLayout = ref(false)
const slot1Config = ref(JSON.parse(JSON.stringify(DEFAULT_SLOT1_LAYOUT)))
const rightGridConfig = ref(JSON.parse(JSON.stringify(DEFAULT_RIGHT_GRID_LAYOUT)))

// 初始化排版编辑模式状态
function initCustomEngine() {
  if (typeof window === 'undefined') return

  try {
    const editModeVal = localStorage.getItem(HOME_EDIT_MODE_STORAGE_KEY)
    isHomeEditMode.value = editModeVal === 'true'

    const activeVal = localStorage.getItem(HOME_CUSTOM_LAYOUT_ACTIVE_KEY)
    hasCustomLayout.value = activeVal === 'true'

    if (hasCustomLayout.value) {
      loadHomeGridLayout()
    } else {
      slot1Config.value = JSON.parse(JSON.stringify(DEFAULT_SLOT1_LAYOUT))
      rightGridConfig.value = JSON.parse(JSON.stringify(DEFAULT_RIGHT_GRID_LAYOUT))
    }
  } catch {
    isHomeEditMode.value = false
    hasCustomLayout.value = false
    slot1Config.value = JSON.parse(JSON.stringify(DEFAULT_SLOT1_LAYOUT))
    rightGridConfig.value = JSON.parse(JSON.stringify(DEFAULT_RIGHT_GRID_LAYOUT))
  }
}

// 切换编辑模式
export function setHomeEditMode(val) {
  isHomeEditMode.value = !!val
  try {
    localStorage.setItem(HOME_EDIT_MODE_STORAGE_KEY, String(isHomeEditMode.value))
    window.dispatchEvent(new CustomEvent(HOME_EDIT_MODE_EVENT, { detail: { isEditMode: isHomeEditMode.value } }))
  } catch {}
}

export function toggleHomeEditMode() {
  setHomeEditMode(!isHomeEditMode.value)
}

// 检查某个区域是否空闲可容纳指定卡片
export function canFitInGrid(gridItems, col, row, colSpan, rowSpan, excludeId = null) {
  if (col < 1 || col + colSpan - 1 > TOTAL_GRID_COLS || row < 1) {
    return false
  }

  for (const item of gridItems) {
    if (excludeId && item.id === excludeId) continue

    const itemRight = item.col + item.colSpan - 1
    const itemBottom = item.row + item.rowSpan - 1
    const targetRight = col + colSpan - 1
    const targetBottom = row + rowSpan - 1

    const overlapX = Math.max(0, Math.min(itemRight, targetRight) - Math.max(item.col, col) + 1)
    const overlapY = Math.max(0, Math.min(itemBottom, targetBottom) - Math.max(item.row, row) + 1)

    if (overlapX > 0 && overlapY > 0) {
      return false
    }
  }

  return true
}

// 寻找从第 1 行开始最先能放下的网格坐标
export function findFirstAvailableGridCell(gridItems, colSpan, rowSpan, maxRows = 20) {
  for (let r = 1; r <= maxRows; r++) {
    for (let c = 1; c <= TOTAL_GRID_COLS - colSpan + 1; c++) {
      if (canFitInGrid(gridItems, c, r, colSpan, rowSpan)) {
        return { col: c, row: r }
      }
    }
  }
  const maxOccupiedRow = gridItems.reduce((max, it) => Math.max(max, it.row + it.rowSpan - 1), 0)
  return { col: 1, row: maxOccupiedRow + 1 }
}

// 计算右栏当前总行数（至少 9 行，若卡片延伸则自适应扩展）
export function computeTotalGridRows(gridItems) {
  let maxR = MIN_GRID_ROWS
  for (const item of gridItems) {
    const bottom = item.row + item.rowSpan - 1
    if (bottom > maxR) maxR = bottom
  }
  return maxR
}

// 生成右栏每个单元格的占位信息矩阵（用于渲染虚线框或留空）
export function generateGridMatrix(gridItems, totalRows) {
  const matrix = Array.from({ length: totalRows }, () => [null, null])

  for (const item of gridItems) {
    for (let r = item.row; r < item.row + item.rowSpan; r++) {
      for (let c = item.col; c < item.col + item.colSpan; c++) {
        const rowIdx = r - 1
        const colIdx = c - 1
        if (rowIdx >= 0 && rowIdx < totalRows && colIdx >= 0 && colIdx < TOTAL_GRID_COLS) {
          matrix[rowIdx][colIdx] = item.id
        }
      }
    }
  }

  const emptyCells = []
  for (let r = 1; r <= totalRows; r++) {
    for (let c = 1; c <= TOTAL_GRID_COLS; c++) {
      if (!matrix[r - 1][c - 1]) {
        emptyCells.push({ col: c, row: r })
      }
    }
  }

  return { matrix, emptyCells }
}

// 检查当前是否有用户登录凭据
export function isUserLoggedIn() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false
  return !!(localStorage.getItem('labhub_token') || localStorage.getItem('laborbit_token'))
}

// 解析并应用布局配置
export function applyParsedLayout(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    slot1Config.value = JSON.parse(JSON.stringify(DEFAULT_SLOT1_LAYOUT))
    rightGridConfig.value = JSON.parse(JSON.stringify(DEFAULT_RIGHT_GRID_LAYOUT))
    return { slot1: slot1Config.value, rightGrid: rightGridConfig.value }
  }

  // 校验 slot1
  if (parsed.slot1 && (parsed.slot1.type === 'wide' || parsed.slot1.type === 'medium-wide' || parsed.slot1.type === 'empty')) {
    const items = Array.isArray(parsed.slot1.items) ? parsed.slot1.items.filter(it => WIDGET_REGISTRY[it?.widgetId]) : []
    if (parsed.slot1.type === 'medium-wide') {
      items.forEach((it, idx) => {
        if (typeof it.slot1Index !== 'number') {
          it.slot1Index = idx
        }
      })
    }
    slot1Config.value = {
      type: parsed.slot1.type,
      items
    }
  } else {
    slot1Config.value = JSON.parse(JSON.stringify(DEFAULT_SLOT1_LAYOUT))
  }

  // 校验 rightGrid
  if (Array.isArray(parsed.rightGrid) && parsed.rightGrid.length > 0) {
    const validItems = []
    for (const it of parsed.rightGrid) {
      if (!it?.widgetId || !WIDGET_REGISTRY[it.widgetId]) continue
      const spans = SIZE_SPANS[it.size] || SIZE_SPANS.small
      const col = Number(it.col) || 1
      const row = Number(it.row) || 1
      validItems.push({
        id: it.id || `grid-${it.widgetId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        widgetId: it.widgetId,
        size: it.size in SIZE_SPANS && !SIZE_SPANS[it.size].isSlot1 ? it.size : 'small',
        col: Math.min(Math.max(col, 1), 2),
        row: Math.max(row, 1),
        colSpan: spans.colSpan,
        rowSpan: spans.rowSpan
      })
    }
    rightGridConfig.value = validItems.length > 0 ? validItems : JSON.parse(JSON.stringify(DEFAULT_RIGHT_GRID_LAYOUT))
  } else {
    rightGridConfig.value = JSON.parse(JSON.stringify(DEFAULT_RIGHT_GRID_LAYOUT))
  }

  return { slot1: slot1Config.value, rightGrid: rightGridConfig.value }
}

// 数据校验与加载
export function loadHomeGridLayout() {
  try {
    const raw = localStorage.getItem(HOME_GRID_STORAGE_KEY)
    if (!raw) {
      slot1Config.value = JSON.parse(JSON.stringify(DEFAULT_SLOT1_LAYOUT))
      rightGridConfig.value = JSON.parse(JSON.stringify(DEFAULT_RIGHT_GRID_LAYOUT))
      return { slot1: slot1Config.value, rightGrid: rightGridConfig.value }
    }

    const parsed = JSON.parse(raw)
    return applyParsedLayout(parsed)
  } catch (e) {
    slot1Config.value = JSON.parse(JSON.stringify(DEFAULT_SLOT1_LAYOUT))
    rightGridConfig.value = JSON.parse(JSON.stringify(DEFAULT_RIGHT_GRID_LAYOUT))
  }

  return { slot1: slot1Config.value, rightGrid: rightGridConfig.value }
}

// 云端同步排布（支持跨设备拉取与首次登录本地迁移）
export async function syncHomeGridLayoutFromCloud(options = {}) {
  const { uploadLocalIfCloudEmpty = false } = options
  if (!isUserLoggedIn()) return null

  try {
    const res = await accountApi.getHomeLayout()
    if (res && res.has_custom_layout && res.layout) {
      hasCustomLayout.value = true
      applyParsedLayout(res.layout)
      try {
        localStorage.setItem(HOME_CUSTOM_LAYOUT_ACTIVE_KEY, 'true')
        localStorage.setItem(HOME_GRID_STORAGE_KEY, JSON.stringify(res.layout))
        window.dispatchEvent(new CustomEvent(HOME_GRID_CHANGED_EVENT, { detail: res.layout }))
      } catch (e) {}
      return { slot1: slot1Config.value, rightGrid: rightGridConfig.value }
    } else if (res && !res.has_custom_layout) {
      if (uploadLocalIfCloudEmpty && hasCustomLayout.value) {
        // 用户刚登录且本地之前有自定义排布，自动上传备份到云端
        await accountApi.saveHomeLayout({
          slot1: slot1Config.value,
          rightGrid: rightGridConfig.value,
          updatedAt: Date.now()
        })
      } else if (!uploadLocalIfCloudEmpty && hasCustomLayout.value) {
        // 云端已重置为默认，本地同步恢复默认
        hasCustomLayout.value = false
        slot1Config.value = JSON.parse(JSON.stringify(DEFAULT_SLOT1_LAYOUT))
        rightGridConfig.value = JSON.parse(JSON.stringify(DEFAULT_RIGHT_GRID_LAYOUT))
        try {
          localStorage.removeItem(HOME_CUSTOM_LAYOUT_ACTIVE_KEY)
          localStorage.removeItem(HOME_GRID_STORAGE_KEY)
          window.dispatchEvent(new CustomEvent(HOME_GRID_CHANGED_EVENT, {
            detail: { slot1: slot1Config.value, rightGrid: rightGridConfig.value }
          }))
        } catch (e) {}
      }
    }
  } catch (err) {
    // 静默降级：网络故障或离线环境不阻断页面渲染
  }
  return null
}

// 保存持久化
export function saveHomeGridLayout(slot1Val = slot1Config.value, rightGridVal = rightGridConfig.value) {
  try {
    hasCustomLayout.value = true
    localStorage.setItem(HOME_CUSTOM_LAYOUT_ACTIVE_KEY, 'true')

    const payload = {
      slot1: slot1Val,
      rightGrid: rightGridVal,
      updatedAt: Date.now()
    }
    localStorage.setItem(HOME_GRID_STORAGE_KEY, JSON.stringify(payload))
    window.dispatchEvent(new CustomEvent(HOME_GRID_CHANGED_EVENT, { detail: payload }))

    // 如果用户已登录，静默异步推送到云端数据库
    if (isUserLoggedIn()) {
      accountApi.saveHomeLayout(payload).catch(() => {})
    }
    return true
  } catch (e) {
    return false
  }
}

// 恢复默认排布（清除自定义状态，即刻回归 34be100 原生经典模式）
export function resetHomeGridLayout() {
  hasCustomLayout.value = false
  isHomeEditMode.value = false
  slot1Config.value = JSON.parse(JSON.stringify(DEFAULT_SLOT1_LAYOUT))
  rightGridConfig.value = JSON.parse(JSON.stringify(DEFAULT_RIGHT_GRID_LAYOUT))

  try {
    localStorage.removeItem(HOME_CUSTOM_LAYOUT_ACTIVE_KEY)
    localStorage.removeItem(HOME_GRID_STORAGE_KEY)
    localStorage.removeItem(HOME_EDIT_MODE_STORAGE_KEY)
    window.dispatchEvent(new CustomEvent(HOME_EDIT_MODE_EVENT, { detail: { isEditMode: false } }))
    window.dispatchEvent(new CustomEvent(HOME_GRID_CHANGED_EVENT, {
      detail: { slot1: slot1Config.value, rightGrid: rightGridConfig.value }
    }))
    // 如果用户已登录，静默异步同步重置到云端数据库
    if (isUserLoggedIn()) {
      accountApi.resetHomeLayout().catch(() => {})
    }
  } catch (e) {}

  return { slot1: slot1Config.value, rightGrid: rightGridConfig.value }
}

// 拖拽会话快照与实时挤占
let dragSnapshot = null

export function startDragSession(draggedId) {
  dragSnapshot = JSON.parse(JSON.stringify(rightGridConfig.value))
}

export function previewDragOver(draggedId, targetCol, targetRow) {
  if (!dragSnapshot) return false
  const result = calculateDisplacedLayout(dragSnapshot, draggedId, targetCol, targetRow)
  if (result) {
    rightGridConfig.value = result
    return true
  }
  return false
}

export function commitDragSession() {
  if (dragSnapshot) {
    saveHomeGridLayout(slot1Config.value, rightGridConfig.value)
    dragSnapshot = null
    return true
  }
  return false
}

export function cancelDragSession() {
  if (dragSnapshot) {
    rightGridConfig.value = dragSnapshot
    dragSnapshot = null
  }
}

export function clearDragSnapshot() {
  dragSnapshot = null
}

function itemsOverlap(aCol, aRow, aColSpan, aRowSpan, bCol, bRow, bColSpan, bRowSpan) {
  const overlapX = Math.max(0, Math.min(aCol + aColSpan - 1, bCol + bColSpan - 1) - Math.max(aCol, bCol) + 1)
  const overlapY = Math.max(0, Math.min(aRow + aRowSpan - 1, bRow + bRowSpan - 1) - Math.max(aRow, bRow) + 1)
  return overlapX > 0 && overlapY > 0
}

export function calculateDisplacedLayout(baseItems, draggedId, targetCol, targetRow) {
  const items = JSON.parse(JSON.stringify(baseItems))
  const dragged = items.find(it => it.id === draggedId)
  if (!dragged) return null

  // 1. 自动根据卡片宽度 clamp 列与行
  let actualCol = targetCol
  if (dragged.colSpan >= TOTAL_GRID_COLS) {
    actualCol = 1
  } else {
    actualCol = Math.max(1, Math.min(TOTAL_GRID_COLS, targetCol))
  }
  const actualRow = Math.max(1, targetRow)

  // 若没有变动则直接返回
  if (dragged.col === actualCol && dragged.row === actualRow) {
    return items
  }

  const otherItems = items.filter(it => it.id !== dragged.id)

  // 2. 检查目标位置是否直接完全空闲 (无任何卡片冲突)
  const conflicts = otherItems.filter(it =>
    itemsOverlap(actualCol, actualRow, dragged.colSpan, dragged.rowSpan, it.col, it.row, it.colSpan, it.rowSpan)
  )

  if (conflicts.length === 0) {
    dragged.col = actualCol
    dragged.row = actualRow
    return items
  }

  const origDragged = baseItems.find(it => it.id === dragged.id) || dragged

  // 3. 检查是否有 1-to-1 精确对调可能（同尺寸且原位互换无重叠）
  if (conflicts.length === 1) {
    const targetItem = conflicts[0]
    let targetCandidateCol = origDragged.col
    if (targetItem.colSpan >= TOTAL_GRID_COLS) targetCandidateCol = 1

    const otherRemaining = otherItems.filter(it => it.id !== targetItem.id)
    const canFitInOrigin = !otherRemaining.some(it =>
      itemsOverlap(targetCandidateCol, origDragged.row, targetItem.colSpan, targetItem.rowSpan, it.col, it.row, it.colSpan, it.rowSpan)
    )
    const draggedFitsAtTarget = !otherRemaining.some(it =>
      itemsOverlap(actualCol, actualRow, dragged.colSpan, dragged.rowSpan, it.col, it.row, it.colSpan, it.rowSpan)
    )
    const targetAndDraggedOverlap = itemsOverlap(
      actualCol, actualRow, dragged.colSpan, dragged.rowSpan,
      targetCandidateCol, origDragged.row, targetItem.colSpan, targetItem.rowSpan
    )

    if (canFitInOrigin && draggedFitsAtTarget && !targetAndDraggedOverlap) {
      if (dragged.rowSpan === targetItem.rowSpan && dragged.colSpan === targetItem.colSpan) {
        dragged.col = actualCol
        dragged.row = actualRow
        targetItem.col = targetCandidateCol
        targetItem.row = origDragged.row
        return items
      }
    }
  }

  // 4. 手机级桌面流式排版算法 (100% 杜绝重叠与空位)
  // 创建二维网格占用图
  const occupied = {}
  for (let c = 1; c <= TOTAL_GRID_COLS; c++) occupied[c] = {}

  // 优先固定放置被拖拽卡片
  dragged.col = actualCol
  dragged.row = actualRow
  for (let c = actualCol; c < actualCol + dragged.colSpan; c++) {
    for (let r = actualRow; r < actualRow + dragged.rowSpan; r++) {
      occupied[c][r] = dragged.id
    }
  }

  // 计算其他卡片的理想重排顺序：根据拖动方向移动
  const sortedOthers = otherItems.slice().sort((a, b) => {
    let aDesired = a.row
    let bDesired = b.row
    if (actualRow > origDragged.row) {
      // 往下拖：位于原位与目标位之间的卡片顺位向上回流
      if (a.row > origDragged.row && a.row <= actualRow) aDesired = a.row - origDragged.rowSpan
      if (b.row > origDragged.row && b.row <= actualRow) bDesired = b.row - origDragged.rowSpan
    } else {
      // 往上拖：位于目标位与原位之间的卡片顺位向下让位
      if (a.row >= actualRow && a.row < origDragged.row) aDesired = a.row + origDragged.rowSpan
      if (b.row >= actualRow && b.row < origDragged.row) bDesired = b.row + origDragged.rowSpan
    }
    if (aDesired !== bDesired) return aDesired - bDesired
    return a.col - b.col
  })

  // 逐一安置其他卡片，确保每个单元格绝对唯一占用
  for (const it of sortedOthers) {
    let placed = false
    for (let r = 1; r <= 30 && !placed; r++) {
      const colCandidates = it.colSpan >= TOTAL_GRID_COLS ? [1] : [it.col, it.col === 1 ? 2 : 1]
      for (const c of colCandidates) {
        if (c + it.colSpan - 1 > TOTAL_GRID_COLS) continue
        let canFit = true
        for (let checkC = c; checkC < c + it.colSpan && canFit; checkC++) {
          for (let checkR = r; checkR < r + it.rowSpan && canFit; checkR++) {
            if (occupied[checkC]?.[checkR]) canFit = false
          }
        }
        if (canFit) {
          it.col = c
          it.row = r
          for (let checkC = c; checkC < c + it.colSpan; checkC++) {
            if (!occupied[checkC]) occupied[checkC] = {}
            for (let checkR = r; checkR < r + it.rowSpan; checkR++) {
              occupied[checkC][checkR] = it.id
            }
          }
          placed = true
          break
        }
      }
    }
  }

  // 审计：若有任何重叠（理论不可能），直接拒绝变动
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (itemsOverlap(items[i].col, items[i].row, items[i].colSpan, items[i].rowSpan,
                       items[j].col, items[j].row, items[j].colSpan, items[j].rowSpan)) {
        return null
      }
    }
  }

  return items
}

// 移动或对调小组件
export function moveGridWidget(draggedId, targetCol, targetRow) {
  const result = calculateDisplacedLayout(rightGridConfig.value, draggedId, targetCol, targetRow)
  if (result) {
    rightGridConfig.value = result
    saveHomeGridLayout(slot1Config.value, result)
    return true
  }
  return false
}

// 移出小组件
export function removeWidgetFromLayout(id, isSlot1 = false) {
  const targetIsSlot1 = isSlot1 || (typeof id === 'string' && id.startsWith('slot1-'))
  if (targetIsSlot1) {
    if (slot1Config.value.type === 'wide') {
      slot1Config.value = {
        type: 'empty',
        items: []
      }
    } else if (slot1Config.value.type === 'medium-wide') {
      slot1Config.value.items.forEach((it, idx) => {
        if (typeof it.slot1Index !== 'number') {
          it.slot1Index = idx
        }
      })
      const filtered = slot1Config.value.items.filter(it => it.id !== id)
      slot1Config.value = {
        type: filtered.length > 0 ? 'medium-wide' : 'empty',
        items: filtered
      }
    }
  } else {
    rightGridConfig.value = rightGridConfig.value.filter(it => it.id !== id)
  }

  saveHomeGridLayout(slot1Config.value, rightGridConfig.value)
  return true
}

// 从抽屉向当前排布添加小组件
export function addWidgetToLayout(widgetId, size, preferredPos = null) {
  if (!WIDGET_REGISTRY[widgetId]) return false

  const spans = SIZE_SPANS[size] || SIZE_SPANS.small

  // 1 号位专用尺寸
  if (spans.isSlot1) {
    if (size === 'wide') {
      slot1Config.value = {
        type: 'wide',
        items: [
          { id: `slot1-${widgetId}-${Date.now()}`, widgetId, size: 'wide' }
        ]
      }
    } else if (size === 'medium-wide') {
      const curItems = slot1Config.value.type === 'medium-wide' ? [...slot1Config.value.items] : []
      curItems.forEach((it, idx) => {
        if (typeof it.slot1Index !== 'number') {
          it.slot1Index = idx
        }
      })

      let targetIdx = 0
      if (preferredPos && typeof preferredPos.slot1Index === 'number') {
        targetIdx = preferredPos.slot1Index
      } else {
        const hasZero = curItems.some(it => it.slot1Index === 0)
        targetIdx = hasZero ? 1 : 0
      }

      const newItem = {
        id: `slot1-${widgetId}-${Date.now()}`,
        widgetId,
        size: 'medium-wide',
        slot1Index: targetIdx
      }

      const existingIdx = curItems.findIndex(it => it.slot1Index === targetIdx)
      if (existingIdx !== -1) {
        curItems[existingIdx] = newItem
      } else {
        curItems.push(newItem)
      }
      curItems.sort((a, b) => (a.slot1Index ?? 0) - (b.slot1Index ?? 0))
      slot1Config.value = {
        type: 'medium-wide',
        items: curItems.slice(0, 2)
      }
    }
    saveHomeGridLayout(slot1Config.value, rightGridConfig.value)
    return true
  }

  // 右栏网格小组件 (minimal / small / medium / large)
  let pos = null
  if (preferredPos && canFitInGrid(rightGridConfig.value, preferredPos.col, preferredPos.row, spans.colSpan, spans.rowSpan)) {
    pos = { col: preferredPos.col, row: preferredPos.row }
  } else {
    pos = findFirstAvailableGridCell(rightGridConfig.value, spans.colSpan, spans.rowSpan)
  }

  const newWidget = {
    id: `grid-${widgetId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    widgetId,
    size,
    col: pos.col,
    row: pos.row,
    colSpan: spans.colSpan,
    rowSpan: spans.rowSpan
  }

  rightGridConfig.value.push(newWidget)
  saveHomeGridLayout(slot1Config.value, rightGridConfig.value)
  return true
}

// Composable 导出
export function useHomeGridEngine() {
  initCustomEngine()

  if (typeof window !== 'undefined') {
    window.addEventListener(HOME_EDIT_MODE_EVENT, (e) => {
      if (typeof e.detail?.isEditMode === 'boolean') {
        isHomeEditMode.value = e.detail.isEditMode
      }
    })
    window.addEventListener(HOME_GRID_CHANGED_EVENT, (e) => {
      if (e.detail?.slot1) slot1Config.value = e.detail.slot1
      if (e.detail?.rightGrid) rightGridConfig.value = e.detail.rightGrid
    })
  }

  // 是否处于自定义状态 (用户正在编辑 或 已经保存了自定义排版)
  const isCustomLayoutActive = computed(() => isHomeEditMode.value || hasCustomLayout.value)

  const totalGridRows = computed(() => computeTotalGridRows(rightGridConfig.value))
  const gridMatrixData = computed(() => generateGridMatrix(rightGridConfig.value, totalGridRows.value))

  return {
    // 状态
    isHomeEditMode,
    hasCustomLayout,
    isCustomLayoutActive,
    slot1Config,
    rightGridConfig,
    totalGridRows,
    gridMatrixData,
    WIDGET_REGISTRY,
    SIZE_SPANS,

    // 方法
    setHomeEditMode,
    toggleHomeEditMode,
    loadHomeGridLayout,
    syncHomeGridLayoutFromCloud,
    isUserLoggedIn,
    saveHomeGridLayout,
    resetHomeGridLayout,
    moveGridWidget,
    removeWidgetFromLayout,
    addWidgetToLayout,
    canFitInGrid,
    startDragSession,
    previewDragOver,
    commitDragSession,
    cancelDragSession,
    clearDragSnapshot,
    calculateDisplacedLayout
  }
}
