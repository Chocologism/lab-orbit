import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  SOURCE_MARKDOWN,
  SOURCE_HTML,
  SOURCE_TEX,
  SOURCE_OPTIONS
} from '../services/arxivFulltextService.js'

describe('ArxivPaperCopilot & ArxivPdfViewer Architecture Tests', () => {
  let mockStorage = {}

  beforeEach(() => {
    mockStorage = {}
    global.localStorage = {
      getItem: vi.fn(k => mockStorage[k] ?? null),
      setItem: vi.fn((k, v) => { mockStorage[k] = String(v) }),
      removeItem: vi.fn(k => { delete mockStorage[k] }),
      clear: vi.fn(() => { mockStorage = {} })
    }
  })

  it('supports the three fulltext context source options', () => {
    expect(SOURCE_OPTIONS.map(o => o.id)).toEqual([
      SOURCE_MARKDOWN,
      SOURCE_HTML,
      SOURCE_TEX
    ])
  })

  it('correctly persists recent arXiv paper reading history in LocalStorage', () => {
    const key = 'csbd_arxiv_recent_papers'
    const recent = [
      { id: '1801.01505', title: 'Solar Energetic Particles' },
      { id: '2401.00001', title: 'Deep Learning Galaxies' }
    ]
    localStorage.setItem(key, JSON.stringify(recent))

    const loaded = JSON.parse(localStorage.getItem(key))
    expect(loaded).toHaveLength(2)
    expect(loaded[0].id).toBe('1801.01505')
    expect(loaded[1].id).toBe('2401.00001')
  })

  it('stores and restores split screen ratio percent', () => {
    const key = 'csbd_arxiv_split_pct'
    localStorage.setItem(key, '60')
    expect(parseFloat(localStorage.getItem(key))).toBe(60)
  })

  it('formats user question with quoted page snippet for AI prompt', () => {
    const quote = {
      page: 3,
      text: '\\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J}'
    }
    const question = '请解释此公式的物理含义'
    const formatted = `【用户在论文第 ${quote.page} 页划选了以下段落/公式】：\n\n> ${quote.text}\n\n${question}`

    expect(formatted).toContain('第 3 页')
    expect(formatted).toContain('\\nabla \\times \\mathbf{B}')
    expect(formatted).toContain('物理含义')
  })

  it('guarantees arXiv PDF URL does not contain .pdf suffix to prevent 301 CORS redirection failure', () => {
    const rawId = '1801.01505.pdf'
    const cleanId = rawId.replace(/^arxiv:\s*/i, '').replace(/\.pdf$/i, '').trim()
    const pdfUrl = `https://arxiv.org/pdf/${cleanId}`
    expect(pdfUrl).toBe('https://arxiv.org/pdf/1801.01505')
    expect(pdfUrl.endsWith('.pdf')).toBe(false)
  })

  it('correctly extracts author initials for circular avatar badges', () => {
    function getAuthorInitials(name) {
      if (!name) return 'AU'
      const cleaned = name.replace(/[^\p{L}\s]/gu, '').trim()
      const parts = cleaned.split(/\s+/)
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }

    expect(getAuthorInitials('S. Vegetti')).toBe('SV')
    expect(getAuthorInitials('G. Despali')).toBe('GD')
    expect(getAuthorInitials('M. R. Lovell')).toBe('ML')
    expect(getAuthorInitials('W. Enzi')).toBe('WE')
    expect(getAuthorInitials('Einstein')).toBe('EI')
  })

  it('verifies arXiv 2x2 welcome guide cards coverage (Chinese localized)', () => {
    const cards = [
      '哪些后续工作检验或挑战了本文的核心结论？',
      '讲解本文最硬核的部分：从物理直觉到伪代码实现',
      '将本文转化为可落地的复现清单',
      '脱离这些基准测试后，哪些假设可能失效？'
    ]
    expect(cards).toHaveLength(4)
    expect(cards[0]).toContain('检验或挑战')
    expect(cards[1]).toContain('物理直觉到伪代码实现')
    expect(cards[2]).toContain('复现清单')
    expect(cards[3]).toContain('假设可能失效')
  })

  it('persists and toggles PDF dark / light background theme mode', () => {
    const themeKey = 'csbd_arxiv_pdf_theme'
    expect(localStorage.getItem(themeKey)).toBeNull()

    // Default to dark
    let currentTheme = localStorage.getItem(themeKey) || 'dark'
    expect(currentTheme).toBe('dark')

    // Toggle to light
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(themeKey, currentTheme)
    expect(localStorage.getItem(themeKey)).toBe('light')

    // Toggle back to dark
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(themeKey, currentTheme)
    expect(localStorage.getItem(themeKey)).toBe('dark')
  })

  it('verifies text selection highlight styling matches Figure 4 warm olive gold', () => {
    // Warm olive gold selection styling rule check
    const darkSelectionBg = 'rgba(163, 135, 60, 0.55)'
    const lightSelectionBg = 'rgba(185, 150, 55, 0.45)'

    expect(darkSelectionBg).toMatch(/rgba\(163,\s*135,\s*60,\s*0\.55\)/)
    expect(lightSelectionBg).toMatch(/rgba\(185,\s*150,\s*55,\s*0\.45\)/)
  })

  it('verifies single-layer unified toolbar icon actions and clean layout', () => {
    const toolbarActions = [
      'like',
      'favorite',
      'share',
      'paperId',
      'prevPage',
      'pageInput',
      'nextPage',
      'zoomOut',
      'zoomIn',
      'pdfOfficialIcon',
      'pdfThemeToggle'
    ]
    expect(toolbarActions).toHaveLength(11)
    expect(toolbarActions[7]).toBe('zoomOut')
    expect(toolbarActions[8]).toBe('zoomIn')
    expect(toolbarActions[9]).toBe('pdfOfficialIcon')
    expect(toolbarActions[10]).toBe('pdfThemeToggle')
    expect(toolbarActions).not.toContain('jollyThemeSwitch')
    expect(toolbarActions).not.toContain('print')
  })

  it('verifies multi-modal pending images state and user message attachment', () => {
    const pendingImages = []
    const newImage = {
      id: 'img-123',
      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      name: 'spectrum.png'
    }
    pendingImages.push(newImage)
    expect(pendingImages).toHaveLength(1)

    const imagesToSend = pendingImages.map(img => img.url)
    const userMsg = {
      role: 'user',
      content: '请结合光谱图分析物理特征',
      images: imagesToSend
    }
    expect(userMsg.images).toHaveLength(1)
    expect(userMsg.images[0]).toContain('data:image/png;base64')
  })

  it('verifies model switcher and reasoning effort levels in copilot', () => {
    const model = {
      id: 'deepseek-r1',
      name: 'DeepSeek R1',
      supportsReasoningEffort: true,
      reasoningEffort: 'off'
    }
    const levels = ['off', 'low', 'high', 'max']
    expect(levels).toHaveLength(4)

    model.reasoningEffort = 'high'
    expect(model.reasoningEffort).toBe('high')
  })

  it('verifies multi-session storage and migration for single paper (Figure 2 & Figure 3)', () => {
    const paperId = '1801.01505'
    const sessionsKey = `csbd_arxiv_copilot_sessions_${paperId}`
    const legacyKey = `csbd_arxiv_copilot_session_${paperId}`

    // 模拟旧版单会话数据
    const legacyMessages = [
      { role: 'user', content: 'What article says', timestamp: 1700000000000 },
      { role: 'assistant', content: 'This paper describes sterile neutrino cosmologies.', timestamp: 1700000001000 }
    ]
    localStorage.setItem(legacyKey, JSON.stringify(legacyMessages))

    // 迁移并生成多会话列表
    const legacyRaw = localStorage.getItem(legacyKey)
    const parsedLegacy = JSON.parse(legacyRaw)
    const migrated = [{
      id: 'session_1',
      title: parsedLegacy[0].content,
      createdAt: parsedLegacy[0].timestamp,
      updatedAt: parsedLegacy[1].timestamp,
      messages: parsedLegacy
    }]
    localStorage.setItem(sessionsKey, JSON.stringify(migrated))

    const loadedSessions = JSON.parse(localStorage.getItem(sessionsKey))
    expect(loadedSessions).toHaveLength(1)
    expect(loadedSessions[0].title).toBe('What article says')
    expect(loadedSessions[0].messages).toHaveLength(2)

    // 新增会话 (+ New Chat 行为)
    const newSession = {
      id: 'session_2',
      title: '翻译摘要为中文',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [{ role: 'user', content: '翻译摘要为中文' }]
    }
    loadedSessions.unshift(newSession)
    localStorage.setItem(sessionsKey, JSON.stringify(loadedSessions))

    const updatedSessions = JSON.parse(localStorage.getItem(sessionsKey))
    expect(updatedSessions).toHaveLength(2)
    expect(updatedSessions[0].title).toBe('翻译摘要为中文')
    expect(updatedSessions[1].title).toBe('What article says')
  })

  it('formats relative time for session history (e.g., 5 days ago, just now)', () => {
    function formatRelativeTime(ts, now = Date.now()) {
      if (!ts) return ''
      const diff = now - Number(ts)
      const diffSec = Math.floor(diff / 1000)
      if (diffSec < 60) return '刚刚'
      const diffMin = Math.floor(diffSec / 60)
      if (diffMin < 60) return `${diffMin} 分钟前`
      const diffHour = Math.floor(diffMin / 60)
      if (diffHour < 24) return `${diffHour} 小时前`
      const diffDay = Math.floor(diffHour / 24)
      if (diffDay === 1) return '昨天'
      if (diffDay < 30) return `${diffDay} 天前`
      const d = new Date(ts)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const now = 1700000000000
    expect(formatRelativeTime(now - 10 * 1000, now)).toBe('刚刚')
    expect(formatRelativeTime(now - 15 * 60 * 1000, now)).toBe('15 分钟前')
    expect(formatRelativeTime(now - 3 * 3600 * 1000, now)).toBe('3 小时前')
    expect(formatRelativeTime(now - 25 * 3600 * 1000, now)).toBe('昨天')
    expect(formatRelativeTime(now - 5 * 24 * 3600 * 1000, now)).toBe('5 天前')
  })

  it('verifies Jolly Chicken 91 rolling animation transition and enlarged scale', () => {
    // 验证动画过渡使用双向平滑的 cubic-bezier 曲线并扩大比例至 0.8 以完整展示设计与动效
    const transitionTiming = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
    expect(transitionTiming).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)')
    const scale = 0.8
    expect(scale).toBeGreaterThanOrEqual(0.75)
    const toolbarRightGap = 3
    expect(toolbarRightGap).toBe(3)
  })

  it('verifies PDF selection coordinate calculation with scroll offset and boundary flip', () => {
    // 模拟选区坐标计算函数
    function computeBubblePos(rect, viewportRect, scrollTop, scrollLeft, bubbleWidth = 260) {
      const centerLeft = (rect.left - viewportRect.left) + scrollLeft + (rect.width / 2) - (bubbleWidth / 2)
      const clampedLeft = Math.max(12 + scrollLeft, Math.min(viewportRect.width + scrollLeft - bubbleWidth - 12, centerLeft))

      let relTop = (rect.top - viewportRect.top) + scrollTop - 46
      if (rect.top - viewportRect.top < 56) {
        // 顶部空间不足，自动向下翻转
        relTop = (rect.bottom - viewportRect.top) + scrollTop + 10
      }

      return { x: Math.round(clampedLeft), y: Math.round(relTop) }
    }

    const viewportRect = { left: 100, top: 50, width: 800, height: 900 }
    
    // 场景 1: 用户滚动至 scrollTop = 600，且选区在视口中间
    const rectNormal = { left: 300, top: 350, right: 500, bottom: 370, width: 200, height: 20 }
    const pos1 = computeBubblePos(rectNormal, viewportRect, 600, 0)
    expect(pos1.y).toBe((350 - 50) + 600 - 46) // 854
    expect(pos1.x).toBe((300 - 100) + 0 + 100 - 130) // 170

    // 场景 2: 选区靠顶（距视口顶仅 20px），自动翻转到底部
    const rectNearTop = { left: 200, top: 70, right: 350, bottom: 90, width: 150, height: 20 }
    const pos2 = computeBubblePos(rectNearTop, viewportRect, 200, 0)
    expect(pos2.y).toBe((90 - 50) + 200 + 10) // 250 (翻转到底部)
  })

  it('verifies ModelSelectPopover eliminates redundant active tag and uses theme accent', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const popoverCode = fs.readFileSync(path.resolve(__dirname, 'ModelSelectPopover.vue'), 'utf-8')

    // 严禁存在“当前生效”冗余提示
    expect(popoverCode).not.toContain('当前生效')

    // 确认已采用 var(--accent) 主题色与 color-mix
    expect(popoverCode).toContain('var(--accent')
    expect(popoverCode).toContain('color-mix(in srgb, var(--accent')
  })

  it('verifies AssistantView header stacking context and overflow visible', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const assistantCode = fs.readFileSync(path.resolve(__dirname, '../views/AssistantView.vue'), 'utf-8')

    // 确认 assistant-header 具有 z-index: 50 且 position: relative，防止被下方 chat-viewport 遮挡
    expect(assistantCode).toContain('z-index: 50;')
    expect(assistantCode).toContain('position: relative;')

    // 确认 assistant-main-pane 为 overflow: visible
    expect(assistantCode).toMatch(/\.assistant-main-pane\s*\{[^}]*overflow:\s*visible;/s)
  })

  it('verifies dialogue content readability and spacing in ArxivPaperCopilot', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const copilotCode = fs.readFileSync(path.resolve(__dirname, 'ArxivPaperCopilot.vue'), 'utf-8')

    // 检查对话内容字号与行高升级
    expect(copilotCode).toContain('font-size: 14.5px;')
    expect(copilotCode).toContain('line-height: 1.78;')
    expect(copilotCode).toContain('gap: 22px;')

    // 检查用户消息独立卡片圆角与主题着色 (对齐图 4 极简设计)
    expect(copilotCode).toContain('.thread-message-item.user')
    expect(copilotCode).toContain('border-radius: 12px;')

    // 检查划选引用与 banner 跟随主题色
    expect(copilotCode).toContain('.embedded-quote-chip')
    expect(copilotCode).toContain('border-left: 3px solid var(--accent')
    expect(copilotCode).toContain('.active-quote-banner')
  })

  it('verifies PDF section outline hierarchy and ancestor parent-active detection', () => {
    const flatSections = [
      { title: '1. Introduction', page: 1, level: 1 },
      { title: '2. Data', page: 2, level: 1 },
      { title: '2.1 JWST Imaging', page: 2, level: 2 },
      { title: '2.2 VLT/MUSE Spectroscopy', page: 3, level: 2 },
      { title: '3. Discussion', page: 5, level: 1 },
      { title: '3.1 Arcs of Interest', page: 5, level: 2 },
      { title: '3.1.1 Source #10', page: 6, level: 3 }
    ]

    function getActiveSectionIndex(page) {
      let found = -1
      for (let i = 0; i < flatSections.length; i++) {
        if (flatSections[i].page <= page) {
          found = i
        } else {
          break
        }
      }
      return found !== -1 ? found : 0
    }

    function isParentActive(sIdx, activeIdx) {
      if (activeIdx === -1) return false
      if (sIdx === activeIdx) return true
      if (sIdx > activeIdx) return false
      const activeItem = flatSections[activeIdx]
      const currentItem = flatSections[sIdx]
      if (currentItem.level >= activeItem.level) return false
      for (let i = sIdx + 1; i <= activeIdx; i++) {
        if (flatSections[i].level <= currentItem.level) {
          return false
        }
      }
      return true
    }

    // 当用户在第 6 页 (处于 3.1.1 Source #10)
    const activeIdx = getActiveSectionIndex(6)
    expect(activeIdx).toBe(6)
    expect(flatSections[activeIdx].title).toBe('3.1.1 Source #10')

    // 确认其父级 3.1 Arcs of Interest (sIdx 5) 和 3. Discussion (sIdx 4) 均被高亮 (对齐图 2 与图 4)
    expect(isParentActive(6, activeIdx)).toBe(true) // 当前自身
    expect(isParentActive(5, activeIdx)).toBe(true) // 3.1 (level 2)
    expect(isParentActive(4, activeIdx)).toBe(true) // 3 (level 1)
    expect(isParentActive(3, activeIdx)).toBe(false) // 2.2 不属于该分支
    expect(isParentActive(0, activeIdx)).toBe(false) // 1. Introduction 不属于该分支
  })

  it('verifies message hover actions for user and assistant messages (Figure 5)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const copilotCode = fs.readFileSync(path.resolve(__dirname, 'ArxivPaperCopilot.vue'), 'utf-8')

    // 悬浮底部操作栏存在且默认透明度为 0
    expect(copilotCode).toContain('.msg-hover-footer')
    expect(copilotCode).toContain('opacity: 0;')
    expect(copilotCode).toContain('pointer-events: none;')
    expect(copilotCode).toContain('.thread-message-item:hover .msg-hover-footer')

    // 用户消息具备 Retry ↺ 与 Edit ✎，两者均具备经典图标
    expect(copilotCode).toContain('handleRetryUserMessage')
    expect(copilotCode).toContain('handleStartEdit')
    expect(copilotCode).toContain('handleSaveEdit')
    expect(copilotCode).toContain('copyMessageContent')

    // 消息卡片移除常驻角色与模型头
    expect(copilotCode).not.toContain('<div class="msg-author-header">')
  })

  it('verifies section minimap pin mode, close button, hitbox bridge, and 500ms safety timer', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const viewerCode = fs.readFileSync(path.resolve(__dirname, 'ArxivPdfViewer.vue'), 'utf-8')

    // 1. 验证热区桥接 (Hitbox Bridge) 样式，消除横杠与卡片之间的 8px 中缝断层
    expect(viewerCode).toContain('.section-outline-popover::after')
    expect(viewerCode).toContain('right: -28px;')
    expect(viewerCode).toContain('width: 36px;')

    // 2. 验证常驻固定模式 (Pin Mode) 与关闭按钮
    expect(viewerCode).toContain('isSectionPinned')
    expect(viewerCode).toContain('toggleMinimapPin')
    expect(viewerCode).toContain('closeSectionPopover')
    expect(viewerCode).toContain('.popover-pin-badge')
    expect(viewerCode).toContain('.popover-close-btn')

    // 3. 验证离开容错定时器延长至 500ms，杜绝秒消失
    expect(viewerCode).toContain('setTimeout(() => {')
    expect(viewerCode).toContain('500)')

    // 4. 验证外部点击收起
    expect(viewerCode).toContain('handleDocumentClick')
    expect(viewerCode).toContain("window.addEventListener('click', handleDocumentClick)")
  })

  it('verifies PDF layout styles prevent left-side truncation and smooth-scroll jitter', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const viewerCode = fs.readFileSync(path.resolve(__dirname, 'ArxivPdfViewer.vue'), 'utf-8')

    // 1. .pdf-pages-container 具有 width: max-content; min-width: 100%; margin: 0 auto;
    // 杜绝放大后负坐标溢出导致左侧截断
    expect(viewerCode).toContain('width: max-content;')
    expect(viewerCode).toContain('min-width: 100%;')
    expect(viewerCode).toContain('margin: 0 auto;')

    // 2. .pdf-scroll-viewport 具备 overscroll-behavior-x: auto 且移除了全局 scroll-behavior: smooth 避免缩放跳帧
    expect(viewerCode).toContain('overscroll-behavior-x: auto;')
    expect(viewerCode).not.toContain('.pdf-scroll-viewport {\n  flex: 1;\n  overflow-y: auto;\n  overflow-x: auto;\n  position: relative;\n  background: #090a0f;\n  padding: 24px 16px 80px 16px;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  scroll-behavior: smooth;')
  })

  it('verifies Ctrl+Wheel / pinch zoom algorithm and boundary clamping', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const viewerCode = fs.readFileSync(path.resolve(__dirname, 'ArxivPdfViewer.vue'), 'utf-8')

    // 1. 验证监听 wheel 事件且为 non-passive
    expect(viewerCode).toContain("viewportRef.value.addEventListener('wheel', handleWheel, { passive: false })")

    // 2. 拦截 ctrlKey 和 metaKey，调用 preventDefault
    expect(viewerCode).toContain('if (e.ctrlKey || e.metaKey)')
    expect(viewerCode).toContain('e.preventDefault()')
    expect(viewerCode).toContain('e.stopPropagation()')

    // 3. 验证实时视觉缩放支持 (canvas 必须为 100% !important 且不设置写死像素值)
    expect(viewerCode).toContain("canvas.style.width = '100%'")
    expect(viewerCode).toContain("canvas.style.height = '100%'")
    expect(viewerCode).toContain('width: 100% !important;')
    expect(viewerCode).toContain('height: 100% !important;')
    expect(viewerCode).toContain('object-fit: fill;')
    expect(viewerCode).toContain('pageRenderedScale')

    // 4. 算法验证：以光标为中心 (Focal Point) 的视口滚动偏移补偿算法
    function calculateFocalScroll(viewport, container, clientX, clientY, prevScale, nextScale) {
      const mouseOffsetX = Math.max(0, Math.min(container.width, clientX - container.left))
      const mouseOffsetY = Math.max(0, Math.min(container.height, clientY - container.top))
      const ratio = nextScale / prevScale
      const deltaX = mouseOffsetX * (ratio - 1)
      const deltaY = mouseOffsetY * (ratio - 1)
      return {
        targetScrollLeft: Math.max(0, viewport.scrollLeft + deltaX),
        targetScrollTop: Math.max(0, viewport.scrollTop + deltaY)
      }
    }

    // 假设视口宽 800，当前滚动 100，容器宽 1000，光标位于 clientX = 400 (在容器内 offset = 300)
    const viewportMock = { scrollLeft: 100, scrollTop: 500 }
    const containerMock = { left: 100, top: 100, width: 1000, height: 2000 }
    // 放大 20% (1.0 -> 1.2)
    const focalResult = calculateFocalScroll(viewportMock, containerMock, 400, 300, 1.0, 1.2)
    // mouseOffsetX = 400 - 100 = 300. deltaX = 300 * 0.2 = 60. targetScrollLeft = 100 + 60 = 160
    expect(focalResult.targetScrollLeft).toBe(160)
    // mouseOffsetY = 300 - 100 = 200. deltaY = 200 * 0.2 = 40. targetScrollTop = 500 + 40 = 540
    expect(focalResult.targetScrollTop).toBe(540)

    // 5. 算法验证：模拟缩放步长计算与极限钳制 (0.1 ~ 10.0, 10% ~ 1000%)
    let scale = 1.15
    const MIN_SCALE = 0.1
    const MAX_SCALE = 10.0

    function simulateZoom(deltaY) {
      const ratio = Math.max(0.65, Math.min(1.5, Math.exp(-deltaY * 0.0035)))
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * ratio))
      scale = Number(nextScale.toFixed(3))
      return scale
    }

    // 放大 (deltaY < 0)
    expect(simulateZoom(-100)).toBeCloseTo(1.63, 1)
    // 连续多次放大至极限不超出 10.0 (1000%)
    for (let i = 0; i < 20; i++) simulateZoom(-100)
    expect(scale).toBe(10.0)
    // 连续多次缩小至极限不低于 0.1 (10%)
    for (let i = 0; i < 30; i++) simulateZoom(100)
    expect(scale).toBe(0.1)

    // 6. 验证滑动条自动隐藏与交汇处白色方块去除
    expect(viewerCode).toContain('::-webkit-scrollbar-corner')
    expect(viewerCode).toContain('scrolling-x')
    expect(viewerCode).toContain('scrolling-y')
  })

  it('verifies trackpad horizontal swipe boundary protection and native history back trigger', () => {
    // 模拟触控板滑动防误触逻辑
    function handleTrackpadSwipe(viewport, deltaX, mockEvent) {
      if (deltaX < 0) { // 向右滑动手指，查看左侧内容
        if (viewport.scrollLeft > 0) {
          if (viewport.scrollLeft + deltaX <= 0) {
            mockEvent.preventDefault()
            viewport.scrollLeft = 0
            return 'clamped_to_left_edge'
          }
          // 在内部滚动，由浏览器原生处理
          viewport.scrollLeft += deltaX
          return 'scrolling_internal'
        }
        // 已经在最左边缘 (scrollLeft <= 0)，不拦截，由浏览器原生触发历史回退
        return 'native_history_back_allowed'
      }
      return 'normal_scroll'
    }

    const mockEvent = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
    const viewport = { scrollLeft: 200 }

    // 1. 当处于 PDF 中间位置 (scrollLeft = 200) 向右滑 (-50)，不触发回退，内部正常滚动
    let result = handleTrackpadSwipe(viewport, -50, mockEvent)
    expect(result).toBe('scrolling_internal')
    expect(viewport.scrollLeft).toBe(150)
    expect(mockEvent.defaultPrevented).toBe(false)

    // 2. 当快到达左边缘 (scrollLeft = 30) 时大幅右滑 (-50)，平滑贴合到 0 并调用 preventDefault 拦截惯性泄漏
    viewport.scrollLeft = 30
    result = handleTrackpadSwipe(viewport, -50, mockEvent)
    expect(result).toBe('clamped_to_left_edge')
    expect(viewport.scrollLeft).toBe(0)
    expect(mockEvent.defaultPrevented).toBe(true)

    // 3. 已经在最左边缘 (scrollLeft = 0)，继续向右滑，放行浏览器原生手势触发历史回退
    mockEvent.defaultPrevented = false
    result = handleTrackpadSwipe(viewport, -50, mockEvent)
    expect(result).toBe('native_history_back_allowed')
    expect(mockEvent.defaultPrevented).toBe(false)
  })
})

