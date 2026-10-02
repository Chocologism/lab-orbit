import { describe, it, expect, beforeEach } from 'vitest'
import {
  useHomeGridEngine,
  resetHomeGridLayout,
  startDragSession,
  previewDragOver,
  commitDragSession,
  cancelDragSession,
  calculateDisplacedLayout,
  computeTotalGridRows,
  generateGridMatrix,
  removeWidgetFromLayout,
  DEFAULT_RIGHT_GRID_LAYOUT,
  DEFAULT_SLOT1_LAYOUT
} from './useHomeGridEngine'

describe('useHomeGridEngine pointer drag and 18-slot grid engine', () => {
  beforeEach(() => {
    resetHomeGridLayout()
  })

  it('initializes with 9 rows and 18 total grid slots', () => {
    const { rightGridConfig, slot1Config, totalGridRows, gridMatrixData } = useHomeGridEngine()
    expect(slot1Config.value.type).toBe('wide')
    expect(slot1Config.value.items[0].widgetId).toBe('conferences')
    expect(rightGridConfig.value.length).toBe(6)
    expect(totalGridRows.value).toBe(9)
    // 9 rows x 2 cols = 18 cells, occupied by the 6 default widgets (4 + 2 + 1 + 1 + 1 = 9 rows fully packed)
    expect(gridMatrixData.value.emptyCells.length).toBe(0)
  })

  it('generates 18 empty cell slots when all cards are removed', () => {
    const { rightGridConfig, totalGridRows, gridMatrixData } = useHomeGridEngine()
    // Clear all widgets
    rightGridConfig.value = []
    expect(computeTotalGridRows(rightGridConfig.value)).toBe(9)
    expect(totalGridRows.value).toBe(9)
    const matrix = generateGridMatrix([], 9)
    expect(matrix.emptyCells.length).toBe(18)
    // 9 rows x 2 cols
    expect(matrix.emptyCells[0]).toEqual({ col: 1, row: 1 })
    expect(matrix.emptyCells[17]).toEqual({ col: 2, row: 9 })
  })

  it('supports drag session preview and commit for card swapping', () => {
    const { rightGridConfig } = useHomeGridEngine()
    // Row 9 has grid-arxiv at col 1 and grid-mailbox at col 2
    startDragSession('grid-arxiv')
    const success = previewDragOver('grid-arxiv', 2, 9)
    expect(success).toBe(true)

    const arxiv = rightGridConfig.value.find(it => it.id === 'grid-arxiv')
    const mailbox = rightGridConfig.value.find(it => it.id === 'grid-mailbox')
    expect(arxiv.col).toBe(2)
    expect(mailbox.col).toBe(1)

    // Commit saves new positions
    commitDragSession()
    expect(arxiv.col).toBe(2)
    expect(mailbox.col).toBe(1)
  })

  it('supports cancelDragSession to restore previous snapshot', () => {
    const { rightGridConfig } = useHomeGridEngine()
    startDragSession('grid-arxiv')
    previewDragOver('grid-arxiv', 2, 9)
    expect(rightGridConfig.value.find(it => it.id === 'grid-arxiv').col).toBe(2)

    cancelDragSession()
    expect(rightGridConfig.value.find(it => it.id === 'grid-arxiv').col).toBe(1)
  })

  it('handles cascade push-down cleanly with zero overlaps when moving weather to row 1', () => {
    const { rightGridConfig, totalGridRows } = useHomeGridEngine()
    // Move weather (Medium, rows 5-6) to row 1 (where next-seminar Large is at rows 1-4)
    startDragSession('grid-weather')
    const success = previewDragOver('grid-weather', 1, 1)
    expect(success).toBe(true)

    const weather = rightGridConfig.value.find(it => it.id === 'grid-weather')
    const seminar = rightGridConfig.value.find(it => it.id === 'grid-next-seminar')
    const library = rightGridConfig.value.find(it => it.id === 'grid-library')

    expect(weather.row).toBe(1)
    expect(weather.rowSpan).toBe(2) // rows 1-2
    expect(seminar.row).toBe(3)
    expect(seminar.rowSpan).toBe(4) // rows 3-6
    expect(library.row).toBe(7) // row 7
    expect(totalGridRows.value).toBe(9) // Still exactly 9 rows total!
  })

  it('removes widget and frees up empty slots in the 9-row grid', () => {
    const { rightGridConfig, gridMatrixData, clearDragSnapshot } = useHomeGridEngine()
    startDragSession('grid-mailbox')
    removeWidgetFromLayout('grid-mailbox', false)
    clearDragSnapshot()
    cancelDragSession() // Calling cancel should not resurrect the deleted item
    expect(rightGridConfig.value.length).toBe(5)
    expect(rightGridConfig.value.find(it => it.id === 'grid-mailbox')).toBeUndefined()
    // 1 empty slot freed at (col 2, row 9)
    const empty = gridMatrixData.value.emptyCells
    expect(empty.length).toBe(1)
    expect(empty[0]).toEqual({ col: 2, row: 9 })
  })

  it('automatically clamps double-column widgets to col 1 when pointer moves to right column', () => {
    const { rightGridConfig } = useHomeGridEngine()
    startDragSession('grid-weather')
    // Attempting to drop double-span widget at col 2 should be clamped to col 1 without returning null or crashing
    const success = previewDragOver('grid-weather', 2, 5)
    expect(success).toBe(true)
    const weather = rightGridConfig.value.find(it => it.id === 'grid-weather')
    expect(weather.col).toBe(1)
  })

  it('swaps to origin space when dragging across compact widgets', () => {
    const { rightGridConfig, totalGridRows } = useHomeGridEngine()
    // Drag library (Small, row 7) to weather (Medium, rows 5-6)
    startDragSession('grid-library')
    const success = previewDragOver('grid-library', 1, 5)
    expect(success).toBe(true)

    const library = rightGridConfig.value.find(it => it.id === 'grid-library')
    const weather = rightGridConfig.value.find(it => it.id === 'grid-weather')
    expect(library.row).toBe(5)
    // Weather swapped into origin space or cascades smoothly without exceeding 9 rows
    expect(totalGridRows.value).toBe(9)
  })
})
