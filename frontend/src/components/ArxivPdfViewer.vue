<template>
  <div class="arxiv-pdf-viewer-root" ref="rootContainerRef">
    <!-- 单层高保真统一顶部工具条 (对齐图 2 原版设计) -->
    <div class="pdf-unified-toolbar">
      <!-- 左侧操作组：返回工作台首页、点赞(按条件)、收藏、分享到推荐流、论文编号快速切换 -->
      <div class="toolbar-left-group">
        <!-- 0. 返回工作台首页按钮 -->
        <button
          type="button"
          class="tb-icon-btn back-landing-btn"
          title="退出当前文献，返回 arXiv 伴读工作台首页"
          @click="emit('paper-change', '')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </button>

        <!-- 1. 点赞按钮：仅当当前文献在推荐流中时显示，复用文献推荐流组件 -->
        <PopularPumaLikeButton
          v-if="feedPaper"
          :liked="feedPaper.is_liked_by_me"
          :count="feedPaper.like_count || 0"
          :disabled="likePending"
          size="small"
          @toggle="handleToggleFeedLike"
        />

        <!-- 2. 收藏按钮：复用文献推荐流五角星组件，收藏至“我的收藏”-“文献” -->
        <FavoriteButton
          kind="paper"
          :target="cleanId"
        />

        <!-- 3. 分享按钮：若当前用户已分享过，亮起且不可点击；若未分享过，点击跳转至推荐流分享 -->
        <button
          type="button"
          class="tb-icon-btn share-feed-btn"
          :class="{ 'is-active': isSharedByMe, 'is-disabled': isSharedByMe }"
          :disabled="isSharedByMe"
          :title="isSharedByMe ? '您已将此文献分享至文献推荐流' : '分享此文献至文献推荐流'"
          @click="handleShareToFeed"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
        </button>

        <!-- 4. 论文编号胶囊与切换弹出卡片 (支持阅读任意 arXiv 编号) -->
        <div class="paper-id-trigger-wrap">
          <button
            type="button"
            class="paper-id-capsule-btn"
            title="切换或检索其他 arXiv 论文"
            @click="showPaperIdPopover = !showPaperIdPopover"
          >
            <span class="id-text">{{ cleanId ? `arXiv:${cleanId}` : '选择 arXiv 论文' }}</span>
            <svg class="pencil-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>

          <Transition name="popover-fade">
            <div v-if="showPaperIdPopover" class="paper-id-popover" @click.stop>
              <div class="popover-input-row">
                <span class="popover-tag">arXiv:</span>
                <input
                  type="text"
                  v-model="inputPaperId"
                  class="popover-input"
                  placeholder="如 2312.00752 或 arXiv 链接"
                  @keydown.enter="submitNewPaperId"
                />
                <button
                  type="button"
                  class="popover-go-btn"
                  :disabled="loading || !inputPaperId.trim()"
                  @click="submitNewPaperId"
                >
                  切换
                </button>
              </div>
              <div v-if="recentPapers.length > 0" class="popover-recents-list">
                <span class="recents-hint">最近阅读:</span>
                <div class="recents-row">
                  <button
                    v-for="item in recentPapers.slice(0, 4)"
                    :key="item.id"
                    type="button"
                    class="recent-chip"
                    :class="{ active: item.id === cleanId }"
                    @click="selectRecentPaper(item.id)"
                  >
                    {{ item.id }}
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- 中间操作组：翻页与页码直接输入 (硬绑定真实页码并修复输入显示 Bug) -->
      <div class="toolbar-center-group">
        <button
          type="button"
          class="page-nav-arrow"
          :disabled="currentPage <= 1 || loading"
          title="上一页"
          @click="prevPage"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        <div class="page-counter-badge" title="输入页码并按回车直接跳转">
          <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            class="page-num-input"
            :value="currentPage"
            :disabled="loading || numPages <= 1"
            @keydown.enter="handlePageInputSubmit($event.target.value)"
            @blur="handlePageInputSubmit($event.target.value)"
          />
          <span class="page-slash">/</span>
          <span class="page-total-num">{{ numPages || '-' }}</span>
        </div>

        <button
          type="button"
          class="page-nav-arrow"
          :disabled="currentPage >= numPages || loading"
          title="下一页"
          @click="nextPage"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <!-- 右侧操作组：缩小、放大相邻并排，官方原版 PDF，最右侧 Moon/Sun 昼夜模式切换 -->
      <div class="toolbar-right-group">
        <!-- 缩小 (放大镜减号) -->
        <button
          type="button"
          class="tb-icon-btn"
          :disabled="scale <= 0.1 || loading"
          title="缩小显示比例"
          @click="zoomOut"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>

        <!-- 放大 (放大镜加号) 紧挨着缩小按钮 -->
        <button
          type="button"
          class="tb-icon-btn"
          :disabled="scale >= 10.0 || loading"
          title="放大显示比例"
          @click="zoomIn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>

        <!-- 打开官方原版 PDF -->
        <a
          v-if="pdfUrl"
          :href="pdfUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="tb-icon-btn"
          title="在新标签页打开官方原版 PDF"
        >
          <svg viewBox="0 0 1024 1024" width="16" height="16">
            <path fill="currentColor" d="M974.848 647.168c-28.672-30.72-86.016-48.128-167.936-48.128-44.032 0-94.208 4.096-149.504 14.336-30.72-30.72-62.464-66.56-92.16-108.544-21.504-29.696-39.936-60.416-56.32-91.136 32.768-101.376 48.128-183.296 48.128-242.688 0-66.56-23.552-136.192-93.184-136.192-21.504 0-41.984 13.312-53.248 31.744-30.72 56.32-17.408 179.2 36.864 300.032-20.48 60.416-40.96 118.784-67.584 183.296-22.528 54.272-49.152 111.616-76.8 162.816-155.648 63.488-256 137.216-265.216 194.56-4.096 21.504 3.072 41.984 18.432 57.344 5.12 4.096 25.6 21.504 59.392 21.504 103.424 0 211.968-169.984 267.264-273.408 41.984-14.336 84.992-27.648 126.976-39.936 46.08-13.312 93.184-23.552 135.168-30.72C753.664 741.376 849.92 757.76 898.048 757.76c59.392 0 80.896-24.576 88.064-45.056 11.264-25.6 3.072-54.272-10.24-69.632l-1.024 4.096z m-55.296 41.984c-4.096 21.504-25.6 35.84-55.296 35.84-8.192 0-15.36-1.024-23.552-3.072-54.272-13.312-104.448-40.96-155.648-83.968 50.176-8.192 92.16-10.24 118.784-10.24 29.696 0 55.296 1.024 71.68 6.144 19.456 4.096 50.176 17.408 44.032 55.296z m-300.032-67.584c-36.864 7.168-75.776 16.384-116.736 27.648-32.768 9.216-66.56 18.432-100.352 30.72 18.432-35.84 33.792-70.656 48.128-103.424 17.408-40.96 30.72-81.92 45.056-120.832 14.336 24.576 29.696 49.152 45.056 70.656 25.6 33.792 52.224 66.56 78.848 95.232zM434.176 83.968c6.144-11.264 17.408-17.408 26.624-17.408 29.696 0 34.816 34.816 34.816 62.464 0 46.08-14.336 116.736-37.888 197.632-40.96-112.64-44.032-205.824-23.552-242.688zM279.552 756.736c-71.68 120.832-141.312 196.608-183.296 196.608-8.192 0-15.36-3.072-21.504-7.168-8.192-8.192-12.288-18.432-10.24-30.72 8.192-43.008 89.088-103.424 215.04-158.72z" />
          </svg>
        </a>

        <!-- 昼夜背景切换 (放置在官方 PDF 标右边，使用 moon.svg / sun.svg 矢量切换显示) -->
        <button
          type="button"
          class="tb-icon-btn pdf-theme-toggle-btn"
          :title="pdfTheme === 'dark' ? '切换为明亮白底背景' : '切换为护眼暗色背景'"
          @click="togglePdfTheme"
        >
          <!-- 暗色护眼模式下显示 sun 图标以供切换至明亮 -->
          <svg
            v-if="pdfTheme === 'dark'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="theme-icon sun-icon"
          >
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2"/>
            <path d="M12 20v2"/>
            <path d="m4.93 4.93 1.41 1.41"/>
            <path d="m17.66 17.66 1.41 1.41"/>
            <path d="M2 12h2"/>
            <path d="M20 12h2"/>
            <path d="m6.34 17.66-1.41 1.41"/>
            <path d="m19.07 4.93-1.41 1.41"/>
          </svg>
          <!-- 明亮模式下显示 moon 图标以供切换至护眼暗色 -->
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="theme-icon moon-icon"
          >
            <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 视口滚动容器 -->
    <div
      class="pdf-scroll-viewport"
      :class="{ 'scrolling-x': isScrollingX, 'scrolling-y': isScrollingY }"
      ref="viewportRef"
      @scroll.passive="handleScroll"
      @mouseup="handleTextSelection"
      @keyup="handleTextSelection"
    >
      <!-- 加载中指示 -->
      <div v-if="loading" class="pdf-loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-hint">正在加载 arXiv:{{ cleanId }} 高清排版...</div>
      </div>

      <!-- 加载失败回退 -->
      <div v-else-if="loadError" class="pdf-error-state">
        <div class="error-badge">PDF 载入提示</div>
        <div class="error-msg">{{ loadError }}</div>
        <div class="error-actions">
          <a
            :href="pdfUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="action-btn primary"
          >
            在官方独立窗口打开 PDF
          </a>
          <button
            type="button"
            class="action-btn secondary"
            @click="useIframeFallback = true"
            v-if="!useIframeFallback"
          >
            使用内嵌框架加载
          </button>
          <button
            type="button"
            class="action-btn secondary"
            @click="reloadPdf"
          >
            重新尝试加载
          </button>
        </div>

        <div v-if="useIframeFallback" class="iframe-container">
          <iframe :src="pdfUrl" class="fallback-iframe" title="PDF Preview"></iframe>
        </div>
      </div>

      <!-- 渲染页面列表 (支持暗色与明亮模式) -->
      <div
        v-show="!loading && !loadError"
        class="pdf-pages-container"
        :class="pdfTheme === 'dark' ? 'theme-dark' : 'theme-light'"
        ref="pagesContainerRef"
      >
        <div
          v-for="p in numPages"
          :key="p"
          :ref="el => setPageRef(el, p)"
          class="pdf-page-card"
          :data-page="p"
        >
          <div
            class="pdf-page-inner"
            :style="{
              width: `${(pageDimensions[p]?.width || defaultPageWidth) * scale}px`,
              height: `${(pageDimensions[p]?.height || defaultPageHeight) * scale}px`
            }"
          >
            <!-- 渲染画板 -->
            <canvas
              :ref="el => setCanvasRef(el, p)"
              class="pdf-canvas"
            ></canvas>

            <!-- 文本划选与交互层 (对齐图 4 纯净高级质感) -->
            <div
              :ref="el => setTextLayerRef(el, p)"
              class="textLayer"
              :style="{
                transform: `scale(${pageRenderedScale[p] ? (scale / pageRenderedScale[p]) : 1})`,
                transformOrigin: '0 0'
              }"
            ></div>

            <!-- 页面占位骨架 -->
            <div
              v-if="!renderedPages.has(p)"
              class="page-skeleton-placeholder"
            >
              <span>第 {{ p }} 页排版中...</span>
            </div>
          </div>

          <div class="page-footer-tag">第 {{ p }} / {{ numPages }} 页</div>
        </div>
      </div>

      <!-- 浮动划词动作气泡 (类似 alphaXiv 的划词即问) -->
      <Transition name="bubble-fade">
        <div
          v-if="bubbleVisible"
          class="floating-action-bubble"
          :style="{
            left: `${bubblePos.x}px`,
            top: `${bubblePos.y}px`
          }"
          @mousedown.stop
        >
          <button
            type="button"
            class="bubble-btn"
            @click="triggerAction('explain')"
            title="让 AI 深入阐释选中的学术内容与公式"
          >
            <svg class="bubble-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
            </svg>
            <span>解释</span>
          </button>

          <button
            type="button"
            class="bubble-btn"
            @click="triggerAction('translate')"
            title="将选中文本翻译为地道严谨的中文"
          >
            <svg class="bubble-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span>翻译</span>
          </button>

          <button
            type="button"
            class="bubble-btn"
            @click="triggerAction('summarize')"
            title="精炼提炼选中段落的核心要点"
          >
            <svg class="bubble-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            <span>总结</span>
          </button>

          <button
            type="button"
            class="bubble-btn quote-btn"
            @click="triggerAction('quote')"
            title="将选中文本作为引用带入右侧对话框"
          >
            <svg class="bubble-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path>
            </svg>
            <span>引用提问</span>
          </button>
        </div>
      </Transition>
    </div>

    <!-- PDF 右侧章节指示横杠轨道 (Minimap) 与悬浮/常驻目录卡片 (对齐 alphaxiv) -->
    <div
      v-if="flatSections.length > 0"
      class="pdf-section-minimap"
      ref="sectionMinimapRef"
      @mouseenter="handleMinimapMouseEnter"
      @mouseleave="handleMinimapMouseLeave"
    >
      <div
        class="minimap-track"
        title="点击固定常驻，悬浮查看文章分节目录"
        @click.stop="toggleMinimapPin"
      >
        <div
          v-for="(sec, sIdx) in flatSections"
          :key="sIdx"
          class="minimap-tick"
          :class="{
            'is-active': activeSectionIndex === sIdx,
            'is-parent-active': isParentActive(sIdx),
            [`level-${sec.level}`]: true
          }"
          :title="`${sec.title} (第 ${sec.page} 页)`"
          @click.stop="jumpToSection(sec)"
        ></div>
      </div>

      <!-- 悬浮文章分节目录卡片 (对齐图 2 & 图 3 alphaxiv 效果) -->
      <Transition name="fade-slide">
        <div
          v-if="showSectionPopover"
          class="section-outline-popover"
          :class="{ 'is-pinned': isSectionPinned }"
          @mouseenter="cancelMinimapClose"
          @mouseleave="handlePopoverMouseLeave"
          @click.stop
        >
          <div class="popover-header">
            <div class="popover-header-title-wrap">
              <span class="popover-title">文章分节目录 (Sections)</span>
              <span class="popover-count">{{ flatSections.length }} 节</span>
              <span v-if="isSectionPinned" class="popover-pin-badge" title="已固定常驻">已固定</span>
            </div>
            <button
              type="button"
              class="popover-close-btn"
              title="关闭目录"
              @click.stop="closeSectionPopover"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="popover-scroll-body">
            <div
              v-for="(sec, sIdx) in flatSections"
              :key="sIdx"
              class="outline-tree-item"
              :class="{
                'is-active': activeSectionIndex === sIdx,
                [`level-${sec.level}`]: true
              }"
              @click="jumpToSection(sec)"
            >
              <div class="outline-item-row">
                <span class="outline-item-title" :title="sec.title">{{ sec.title }}</span>
                <span class="outline-item-page">p.{{ sec.page }}</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'
import { cleanArxivId, getRecentArxivPapers, saveRecentArxivPaper } from '../utils/arxivHtml.js'
import { notify } from '../composables/feedback.js'
import { arxivApi } from '../api/client.js'
import PopularPumaLikeButton from './PopularPumaLikeButton.vue'
import FavoriteButton from './FavoriteButton.vue'

// 配置 PDF.js Worker 路径
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
}

const router = useRouter()

const props = defineProps({
  paperId: {
    type: String,
    default: ''
  },
  initialPage: {
    type: Number,
    default: 1
  }
})

const emit = defineEmits([
  'selection-action',
  'page-change',
  'paper-change',
  'pdf-loaded',
  'pdf-error'
])

// 当前登录用户
const currentUser = computed(() => {
  try {
    const raw = localStorage.getItem('laborbit_user') || localStorage.getItem('labhub_user')
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
})

// 规范化 arXiv 编号
const cleanId = computed(() => cleanArxivId(props.paperId))

// 官方 PDF URL（注意：arXiv 原生 endpoint 为 /pdf/id 不加 .pdf 后缀，加 .pdf 会触发无 CORS 头的 301 重定向）
const pdfUrl = computed(() => {
  if (!cleanId.value) return ''
  return `https://arxiv.org/pdf/${cleanId.value}`
})

// 文献推荐流中的对应记录（若当前文献不在推荐流中则为 null）
const feedPaper = ref(null)
const likePending = ref(false)

async function checkFeedPaper() {
  if (!cleanId.value) {
    feedPaper.value = null
    return
  }
  try {
    const feed = await arxivApi.getFeed('all')
    const list = Array.isArray(feed) ? feed : (feed?.data || [])
    const found = list.find(p => {
      const pId = cleanArxivId(p.arxiv_id || '')
      return pId === cleanId.value
    })
    feedPaper.value = found || null
  } catch (err) {
    console.error('Failed to check feed paper:', err)
  }
}

// 是否已被当前登录用户分享到推荐流
const isSharedByMe = computed(() => {
  if (!feedPaper.value || !currentUser.value) return false
  return (feedPaper.value.recommender?.id || feedPaper.value.recommended_by_id) === currentUser.value.id
})

// 处理推荐流点赞切换（复用推荐流逻辑）
async function handleToggleFeedLike() {
  if (!feedPaper.value || likePending.value) return
  likePending.value = true
  const prevLiked = Boolean(feedPaper.value.is_liked_by_me)
  const prevCount = Number(feedPaper.value.like_count) || 0
  const nextLiked = !prevLiked
  const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1)
  feedPaper.value.is_liked_by_me = nextLiked
  feedPaper.value.like_count = nextCount
  try {
    const res = await arxivApi.toggleLike(feedPaper.value.id)
    feedPaper.value.is_liked_by_me = res.is_liked
    feedPaper.value.like_count = res.like_count
  } catch (err) {
    feedPaper.value.is_liked_by_me = prevLiked
    feedPaper.value.like_count = prevCount
    notify(err.message || '点赞失败', 'error')
  } finally {
    likePending.value = false
  }
}

// 分享到推荐流：若尚未被当前用户分享，点击跳转至推荐流并带上 share_id
function handleShareToFeed() {
  if (isSharedByMe.value || !cleanId.value) return
  router.push({
    path: '/arxiv',
    query: { share_id: cleanId.value }
  })
}

// 页码跳转输入处理（支持 Enter 与失焦）
function handlePageInputSubmit(val) {
  let p = parseInt(val, 10)
  if (isNaN(p)) {
    return
  }
  p = Math.max(1, Math.min(numPages.value || 1, p))
  scrollToPage(p)
}

// DOM 元素引用
const rootContainerRef = ref(null)
const viewportRef = ref(null)
const pagesContainerRef = ref(null)

const pageElements = reactive({})
const canvasElements = reactive({})
const textLayerElements = reactive({})

function setPageRef(el, page) {
  if (el) pageElements[page] = el
  else delete pageElements[page]
}

function setCanvasRef(el, page) {
  if (el) canvasElements[page] = el
  else delete canvasElements[page]
}

function setTextLayerRef(el, page) {
  if (el) textLayerElements[page] = el
  else delete textLayerElements[page]
}

// 状态管理
const loading = ref(true)
const loadError = ref('')
const useIframeFallback = ref(false)
const numPages = ref(0)
const currentPage = ref(props.initialPage || 1)
const pageInputValue = ref(props.initialPage || 1)
const scale = ref(1.15)
const defaultPageWidth = ref(595)
const defaultPageHeight = ref(842)
const pageDimensions = reactive({})
const pageRenderedScale = reactive({})
const renderedPages = reactive(new Set())

// 滑动条自动隐藏与独立轴检测状态
const isScrollingX = ref(false)
const isScrollingY = ref(false)
let scrollXTimer = null
let scrollYTimer = null
let lastScrollLeft = 0
let lastScrollTop = 0

// PDF 背景主题模式：'dark' (暗色护眼，对齐图 4) | 'light' (明亮白底)
const pdfTheme = ref(localStorage.getItem('laborbit_arxiv_pdf_theme') || 'dark')

function togglePdfTheme() {
  pdfTheme.value = pdfTheme.value === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem('laborbit_arxiv_pdf_theme', pdfTheme.value)
  } catch (_) {}
  notify(pdfTheme.value === 'dark' ? '已开启暗色护眼背景' : '已切换为明亮白底背景', 'info')
}

// 工具条快捷交互状态
const showPaperIdPopover = ref(false)
const inputPaperId = ref(cleanId.value)
const recentPapers = ref(loadRecentPapers())

function loadRecentPapers() {
  return getRecentArxivPapers(currentUser.value)
}

// 监听当前登录用户账号变动，刷新最近文献列表
watch(
  () => currentUser.value?.id || currentUser.value?.username || currentUser.value?.email || '',
  () => {
    recentPapers.value = loadRecentPapers()
  }
)

function submitNewPaperId() {
  const clean = cleanArxivId(inputPaperId.value)
  if (!clean) {
    notify('请输入合规的 arXiv 论文编号或链接', 'warning')
    return
  }
  showPaperIdPopover.value = false
  saveRecentArxivPaper(clean, '', currentUser.value)
  recentPapers.value = loadRecentPapers()
  emit('paper-change', clean)
}

function selectRecentPaper(id) {
  showPaperIdPopover.value = false
  saveRecentArxivPaper(id, '', currentUser.value)
  recentPapers.value = loadRecentPapers()
  emit('paper-change', id)
}

// 划选浮动气泡状态
const bubbleVisible = ref(false)
const bubblePos = reactive({ x: 0, y: 0 })
const activeSelectedText = ref('')
const activeSelectedPage = ref(1)

// PDF 章节与目录大纲状态 (参考 alphaxiv 章节指示器与浮层)
const flatSections = ref([])
const activeSectionIndex = ref(-1)
const showSectionPopover = ref(false)
const isSectionPinned = ref(false)
const sectionMinimapRef = ref(null)
let minimapCloseTimer = null

async function extractPdfOutline() {
  flatSections.value = []
  activeSectionIndex.value = -1
  if (!pdfDoc) return

  try {
    const outline = await pdfDoc.getOutline()
    if (outline && outline.length > 0) {
      const parsedTree = []
      for (const node of outline) {
        parsedTree.push(await parseOutlineNode(node, 1))
      }
      flatSections.value = flattenOutline(parsedTree)
    } else {
      flatSections.value = generateFallbackSections()
    }
  } catch (err) {
    console.warn('[ArxivPdfViewer] Failed to extract outline:', err)
    flatSections.value = generateFallbackSections()
  }

  updateActiveSection()
}

async function parseOutlineNode(node, level = 1) {
  let page = 1
  try {
    let dest = node.dest
    if (typeof dest === 'string') {
      dest = await pdfDoc.getDestination(dest)
    }
    if (Array.isArray(dest) && dest.length > 0) {
      const pageRef = dest[0]
      if (typeof pageRef === 'object' && pageRef !== null) {
        const pageIdx = await pdfDoc.getPageIndex(pageRef)
        page = pageIdx + 1
      } else if (typeof pageRef === 'number') {
        page = pageRef + 1
      }
    }
  } catch (err) {
    console.warn('Failed to parse outline dest:', err)
  }

  const result = {
    title: node.title?.replace(/[\r\n\t]+/g, ' ').trim() || 'Untitled Section',
    page: Math.max(1, Math.min(numPages.value || 1, page)),
    level: Math.min(level, 3),
    items: []
  }

  if (Array.isArray(node.items) && node.items.length > 0) {
    for (const child of node.items) {
      result.items.push(await parseOutlineNode(child, level + 1))
    }
  }
  return result
}

function flattenOutline(nodes) {
  const list = []
  function traverse(item) {
    list.push({
      title: item.title,
      page: item.page,
      level: item.level
    })
    if (item.items && item.items.length > 0) {
      for (const child of item.items) {
        traverse(child)
      }
    }
  }
  for (const node of nodes) {
    traverse(node)
  }
  return list
}

function generateFallbackSections() {
  const total = numPages.value || 1
  if (total <= 1) {
    return [{ title: 'Main Document', page: 1, level: 1 }]
  }
  const fallback = [
    { title: 'Abstract & Introduction', page: 1, level: 1 }
  ]
  if (total >= 3) {
    fallback.push({ title: 'Methodology & Setup', page: Math.min(2, total), level: 1 })
  }
  if (total >= 5) {
    fallback.push({ title: 'Results & Experiments', page: Math.min(Math.ceil(total * 0.5), total), level: 1 })
  }
  if (total >= 4) {
    fallback.push({ title: 'Discussion & Conclusion', page: Math.max(1, total - 1), level: 1 })
  }
  fallback.push({ title: 'References', page: total, level: 1 })
  return fallback
}

function updateActiveSection() {
  if (!flatSections.value || flatSections.value.length === 0) {
    activeSectionIndex.value = -1
    return
  }
  const cur = currentPage.value
  let found = -1
  for (let i = 0; i < flatSections.value.length; i++) {
    if (flatSections.value[i].page <= cur) {
      found = i
    } else {
      break
    }
  }
  activeSectionIndex.value = found !== -1 ? found : 0
}

function isParentActive(sIdx) {
  if (activeSectionIndex.value === -1) return false
  if (sIdx === activeSectionIndex.value) return true
  if (sIdx > activeSectionIndex.value) return false
  const activeItem = flatSections.value[activeSectionIndex.value]
  const currentItem = flatSections.value[sIdx]
  if (currentItem.level >= activeItem.level) return false
  for (let i = sIdx + 1; i <= activeSectionIndex.value; i++) {
    if (flatSections.value[i].level <= currentItem.level) {
      return false
    }
  }
  return true
}

function jumpToSection(sec) {
  if (!sec || !sec.page) return
  scrollToPage(sec.page)
  closeSectionPopover()
}

function handleMinimapMouseEnter() {
  cancelMinimapClose()
  showSectionPopover.value = true
}

function handleMinimapMouseLeave() {
  if (!isSectionPinned.value) {
    scheduleMinimapClose()
  }
}

function handlePopoverMouseLeave() {
  if (!isSectionPinned.value) {
    scheduleMinimapClose()
  }
}

function toggleMinimapPin() {
  cancelMinimapClose()
  if (showSectionPopover.value && isSectionPinned.value) {
    closeSectionPopover()
  } else {
    showSectionPopover.value = true
    isSectionPinned.value = true
  }
}

function closeSectionPopover() {
  clearTimeout(minimapCloseTimer)
  minimapCloseTimer = null
  showSectionPopover.value = false
  isSectionPinned.value = false
}

function scheduleMinimapClose() {
  clearTimeout(minimapCloseTimer)
  minimapCloseTimer = setTimeout(() => {
    if (!isSectionPinned.value) {
      showSectionPopover.value = false
    }
  }, 500)
}

function cancelMinimapClose() {
  if (minimapCloseTimer) {
    clearTimeout(minimapCloseTimer)
    minimapCloseTimer = null
  }
}

function handleDocumentClick(e) {
  if (!showSectionPopover.value) return
  if (sectionMinimapRef.value && sectionMinimapRef.value.contains(e.target)) {
    return
  }
  closeSectionPopover()
}

watch(currentPage, () => {
  updateActiveSection()
})

let pdfDoc = null
let renderTasks = new Map()
let intersectionObserver = null

// 加载 PDF 文档 (优先直连 arXiv 官方端点，遇阻自动无缝切换本域代理)
async function loadPdfDocument() {
  if (!cleanId.value) return
  loading.value = true
  loadError.value = ''
  useIframeFallback.value = false
  renderedPages.clear()
  renderTasks.clear()

  const candidateUrls = [
    `https://arxiv.org/pdf/${cleanId.value}`,
    `/api/arxiv/proxy-pdf/${cleanId.value}`
  ]

  let loaded = false
  let lastErr = null

  for (const url of candidateUrls) {
    try {
      const loadingTask = pdfjsLib.getDocument({
        url,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
        cMapPacked: true
      })

      pdfDoc = await loadingTask.promise
      numPages.value = pdfDoc.numPages
      currentPage.value = 1
      pageInputValue.value = 1

      // 获取第 1 页的原始尺寸
      const firstPage = await pdfDoc.getPage(1)
      const viewport = firstPage.getViewport({ scale: 1.0 })
      defaultPageWidth.value = viewport.width
      defaultPageHeight.value = viewport.height

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        pageDimensions[i] = {
          width: viewport.width,
          height: viewport.height
        }
      }

      loading.value = false
      loaded = true
      emit('pdf-loaded', { numPages: pdfDoc.numPages })

      await nextTick()
      setupIntersectionObserver()
      renderVisiblePages()
      extractPdfOutline()
      break
    } catch (err) {
      lastErr = err
      console.warn(`[ArxivPdfViewer] Failed loading from ${url}:`, err)
    }
  }

  if (!loaded) {
    loading.value = false
    loadError.value = lastErr?.message || '加载 PDF 文件失败，可能受网络连接或跨域策略限制'
    emit('pdf-error', loadError.value)
  }
}

// 设置可视交叉观察器，实现按需惰性渲染与当前页码识别
function setupIntersectionObserver() {
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
  }

  if (typeof IntersectionObserver === 'undefined' || !viewportRef.value) return

  intersectionObserver = new IntersectionObserver((entries) => {
    let mostVisiblePage = currentPage.value
    let maxIntersectionRatio = 0

    for (const entry of entries) {
      const pageNum = parseInt(entry.target.dataset.page, 10)
      if (entry.isIntersecting) {
        if (!renderedPages.has(pageNum)) {
          renderPage(pageNum)
        }
        if (entry.intersectionRatio > maxIntersectionRatio) {
          maxIntersectionRatio = entry.intersectionRatio
          mostVisiblePage = pageNum
        }
      }
    }

    if (maxIntersectionRatio > 0.1 && mostVisiblePage !== currentPage.value) {
      currentPage.value = mostVisiblePage
      pageInputValue.value = mostVisiblePage
      emit('page-change', mostVisiblePage)
    }
  }, {
    root: viewportRef.value,
    rootMargin: '400px 0px 400px 0px',
    threshold: [0, 0.2, 0.5, 0.8, 1.0]
  })

  for (let i = 1; i <= numPages.value; i++) {
    const el = pageElements[i]
    if (el) intersectionObserver.observe(el)
  }
}

// 渲染单个页面 (Canvas + 高保真 TextLayer)
async function renderPage(pageNumber) {
  if (!pdfDoc || pageNumber < 1 || pageNumber > numPages.value) return
  if (renderedPages.has(pageNumber)) return

  const canvas = canvasElements[pageNumber]
  const textLayerDiv = textLayerElements[pageNumber]
  if (!canvas || !textLayerDiv) return

  try {
    const page = await pdfDoc.getPage(pageNumber)
    const viewport = page.getViewport({ scale: scale.value })

    pageDimensions[pageNumber] = {
      width: viewport.width / scale.value,
      height: viewport.height / scale.value
    }
    pageRenderedScale[pageNumber] = scale.value

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)
    canvas.style.width = '100%'
    canvas.style.height = '100%'

    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (renderTasks.has(pageNumber)) {
      try {
        renderTasks.get(pageNumber).cancel()
      } catch (_) {}
    }

    const renderTask = page.render({
      canvasContext: ctx,
      viewport: viewport
    })
    renderTasks.set(pageNumber, renderTask)
    await renderTask.promise
    renderTasks.delete(pageNumber)

    textLayerDiv.innerHTML = ''
    textLayerDiv.style.width = `${Math.floor(viewport.width)}px`
    textLayerDiv.style.height = `${Math.floor(viewport.height)}px`
    textLayerDiv.style.setProperty('--scale-factor', scale.value)

    const textContent = await page.getTextContent()
    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: textContent,
      container: textLayerDiv,
      viewport: viewport
    })
    await textLayer.render()

    renderedPages.add(pageNumber)
  } catch (err) {
    if (err?.name !== 'RenderingCancelledException') {
      console.warn(`[ArxivPdfViewer] Page ${pageNumber} render failed:`, err)
    }
  }
}

function renderVisiblePages() {
  renderedPages.clear()
  if (!pdfDoc) return

  const start = Math.max(1, currentPage.value - 1)
  const end = Math.min(numPages.value, currentPage.value + 1)
  for (let i = start; i <= end; i++) {
    renderPage(i)
  }
}

function handleScroll() {
  if (bubbleVisible.value) {
    bubbleVisible.value = false
  }

  if (!viewportRef.value) return
  const currentLeft = viewportRef.value.scrollLeft
  const currentTop = viewportRef.value.scrollTop

  // 垂直方向滑动独立检测：滚动时浮现，停止滚动 800ms 后自动淡出隐藏
  if (Math.abs(currentTop - lastScrollTop) > 1) {
    isScrollingY.value = true
    if (scrollYTimer) clearTimeout(scrollYTimer)
    scrollYTimer = setTimeout(() => {
      isScrollingY.value = false
    }, 800)
  }
  lastScrollTop = currentTop

  // 水平方向滑动独立检测：滚动时浮现，停止滚动 800ms 后自动淡出隐藏
  if (Math.abs(currentLeft - lastScrollLeft) > 1) {
    isScrollingX.value = true
    if (scrollXTimer) clearTimeout(scrollXTimer)
    scrollXTimer = setTimeout(() => {
      isScrollingX.value = false
    }, 800)
  }
  lastScrollLeft = currentLeft
}

function prevPage() {
  if (currentPage.value > 1) {
    scrollToPage(currentPage.value - 1)
  }
}

function nextPage() {
  if (currentPage.value < numPages.value) {
    scrollToPage(currentPage.value + 1)
  }
}

function jumpToInputPage() {
  let p = parseInt(pageInputValue.value, 10)
  if (isNaN(p) || p < 1) p = 1
  if (p > numPages.value) p = numPages.value
  pageInputValue.value = p
  scrollToPage(p)
}

function scrollToPage(p) {
  const el = pageElements[p]
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    currentPage.value = p
    pageInputValue.value = p
    renderPage(p)
  }
}

let renderDebounceTimer = null
function debouncedRenderPages() {
  if (renderDebounceTimer) clearTimeout(renderDebounceTimer)
  renderDebounceTimer = setTimeout(() => {
    renderVisiblePages()
  }, 120)
}

function zoomIn() {
  if (scale.value < 10.0) {
    const step = scale.value < 0.5 ? 0.05 : (scale.value < 1.5 ? 0.15 : (scale.value < 4.0 ? 0.35 : 0.75))
    zoomToScale(Math.min(10.0, Number((scale.value + step).toFixed(2))))
  }
}

function zoomOut() {
  if (scale.value > 0.1) {
    const step = scale.value <= 0.5 ? 0.05 : (scale.value <= 1.5 ? 0.15 : (scale.value <= 4.0 ? 0.35 : 0.75))
    zoomToScale(Math.max(0.1, Number((scale.value - step).toFixed(2))))
  }
}

function zoomToScale(nextScale, focalX = null, focalY = null) {
  if (!viewportRef.value) {
    scale.value = nextScale
    debouncedRenderPages()
    return
  }

  const viewport = viewportRef.value
  const container = pagesContainerRef.value || viewport
  const vRect = viewport.getBoundingClientRect()
  const cRect = container.getBoundingClientRect()

  // 缩放锚点：若传入具体鼠标坐标，以光标为锚点；否则以视口中心为锚点
  const clientX = (focalX !== null) ? focalX : (vRect.left + vRect.width / 2)
  const clientY = (focalY !== null) ? focalY : (vRect.top + vRect.height / 2)

  // 计算光标相对于 PDF 页面内容容器的当前像素偏移
  const mouseOffsetX = Math.max(0, Math.min(cRect.width, clientX - cRect.left))
  const mouseOffsetY = Math.max(0, Math.min(cRect.height, clientY - cRect.top))

  const prevScale = scale.value
  const ratio = nextScale / prevScale

  // 计算内容在光标处的尺寸增量：
  // 保持光标下的文档像素点在视口中的绝对坐标完全静止不动
  const deltaX = mouseOffsetX * (ratio - 1)
  const deltaY = mouseOffsetY * (ratio - 1)

  const targetScrollLeft = Math.max(0, viewport.scrollLeft + deltaX)
  const targetScrollTop = Math.max(0, viewport.scrollTop + deltaY)

  // 立即更新响应式 scale，使得 .pdf-page-inner 和 100% canvas 立即在当前帧硬件加速缩放
  scale.value = Number(nextScale.toFixed(3))

  // 立即同步更新滚动条位置
  viewport.scrollLeft = targetScrollLeft
  viewport.scrollTop = targetScrollTop

  // 在 DOM 渲染后微调，防止因滚动高度尚未完全展开导致的边界截断
  nextTick(() => {
    if (viewportRef.value) {
      viewportRef.value.scrollLeft = targetScrollLeft
      viewportRef.value.scrollTop = targetScrollTop
    }
  })

  debouncedRenderPages()
}

function handleWheel(e) {
  // 1. 按住 Ctrl / Cmd + 滚轮 或 触控板捏合缩放：只缩放 PDF，严防缩放整个网页页面
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    e.stopPropagation()

    const prevScale = scale.value
    // 标准化跨浏览器滚轮模式 (0: 像素, 1: 行, 2: 页面)
    let dy = e.deltaY
    if (e.deltaMode === 1) {
      dy *= 24
    } else if (e.deltaMode === 2) {
      dy *= 100
    }

    // 显著提升放缩灵敏度并支持 10% 到 1000% (0.1 ~ 10.0) 全域等比缩放：
    // 使用等比指数缩放 Math.exp(-dy * 0.0035)，高倍率不迟钝，低倍率不坍缩；
    // 单次微手势极速跟手，手感对齐 Figma / alphaXiv
    const ratio = Math.max(0.65, Math.min(1.5, Math.exp(-dy * 0.0035)))
    const nextScale = Math.min(10.0, Math.max(0.1, prevScale * ratio))

    if (Math.abs(nextScale - prevScale) > 0.001) {
      zoomToScale(nextScale, e.clientX, e.clientY)
    }
    return
  }

  // 2. 触控板左右滑动防误触网页历史回退：
  // 当 PDF 放大后大于视口时，如果左右滑块尚未达到最左侧（viewport.scrollLeft > 0），
  // 向右滑动（e.deltaX < 0）本意是查看 PDF 左侧内容，绝不能让浏览器将其作为手势传递触发网页回退！
  // 只有当左右滑块已经达到最左侧（viewport.scrollLeft <= 0）时，继续右滑才由浏览器原生触发回退。
  if (viewportRef.value && e.deltaX < 0) {
    const viewport = viewportRef.value
    if (viewport.scrollLeft > 0) {
      if (viewport.scrollLeft + e.deltaX <= 0) {
        e.preventDefault()
        viewport.scrollLeft = 0
      }
    }
  }
}

function handleGesture(e) {
  if (e && e.preventDefault) {
    e.preventDefault()
  }
}

function fitToWidth() {
  if (!viewportRef.value) return
  const availableWidth = viewportRef.value.clientWidth - 48
  if (availableWidth > 200 && defaultPageWidth.value > 0) {
    const targetScale = availableWidth / defaultPageWidth.value
    scale.value = Number(Math.max(0.7, Math.min(2.0, targetScale)).toFixed(2))
    nextTick(() => renderVisiblePages())
  }
}

function reloadPdf() {
  loadPdfDocument()
}

function handleGlobalMouseUp(e) {
  if (e && e.target && e.target.closest && e.target.closest('.floating-action-bubble')) {
    return
  }
  setTimeout(() => {
    handleTextSelection()
  }, 10)
}

// 划选文本事件监听 (精准计算滚动视口坐标与自适应翻转)
function handleTextSelection() {
  if (typeof window === 'undefined') return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) {
    bubbleVisible.value = false
    return
  }

  const text = sel.toString().trim()
  if (text.length < 2) {
    bubbleVisible.value = false
    return
  }

  if (!viewportRef.value) return

  try {
    const range = sel.getRangeAt(0)
    let node = range.commonAncestorContainer
    if (node && node.nodeType === 3) node = node.parentNode
    if (!node || !viewportRef.value.contains(node)) {
      bubbleVisible.value = false
      return
    }

    const rect = range.getBoundingClientRect()
    const viewportRect = viewportRef.value.getBoundingClientRect()

    if (
      rect.bottom < viewportRect.top ||
      rect.top > viewportRect.bottom ||
      rect.right < viewportRect.left ||
      rect.left > viewportRect.right
    ) {
      bubbleVisible.value = false
      return
    }

    let foundPage = currentPage.value
    if (node && node.closest) {
      const pageCard = node.closest('.pdf-page-card')
      if (pageCard && pageCard.dataset.page) {
        foundPage = parseInt(pageCard.dataset.page, 10) || currentPage.value
      }
    }

    activeSelectedText.value = text
    activeSelectedPage.value = foundPage

    const scrollLeft = viewportRef.value.scrollLeft || 0
    const scrollTop = viewportRef.value.scrollTop || 0

    const bubbleWidth = 260
    const centerLeft = (rect.left - viewportRect.left) + scrollLeft + (rect.width / 2) - (bubbleWidth / 2)
    const clampedLeft = Math.max(12 + scrollLeft, Math.min(viewportRect.width + scrollLeft - bubbleWidth - 12, centerLeft))

    // 默认悬浮在选中文本上方；若顶部空间不足（如靠顶选区），自适应翻转到底部
    let relTop = (rect.top - viewportRect.top) + scrollTop - 46
    if (rect.top - viewportRect.top < 56) {
      relTop = (rect.bottom - viewportRect.top) + scrollTop + 10
    }

    bubblePos.x = Math.round(clampedLeft)
    bubblePos.y = Math.round(relTop)
    bubbleVisible.value = true
  } catch (_) {
    bubbleVisible.value = false
  }
}

function triggerAction(actionName) {
  if (!activeSelectedText.value) return
  emit('selection-action', {
    action: actionName,
    text: activeSelectedText.value,
    page: activeSelectedPage.value
  })

  if (typeof window !== 'undefined' && window.getSelection) {
    try {
      window.getSelection().removeAllRanges()
    } catch (_) {}
  }
  bubbleVisible.value = false
}

watch(() => props.paperId, (newId) => {
  if (newId) {
    inputPaperId.value = cleanArxivId(newId)
    loadPdfDocument()
    checkFeedPaper()
  }
}, { immediate: true })

onMounted(() => {
  window.addEventListener('resize', handleScroll)
  window.addEventListener('mouseup', handleGlobalMouseUp)
  window.addEventListener('click', handleDocumentClick)
  if (viewportRef.value) {
    viewportRef.value.addEventListener('wheel', handleWheel, { passive: false })
    viewportRef.value.addEventListener('gesturestart', handleGesture, { passive: false })
    viewportRef.value.addEventListener('gesturechange', handleGesture, { passive: false })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleScroll)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
  window.removeEventListener('click', handleDocumentClick)
  if (viewportRef.value) {
    viewportRef.value.removeEventListener('wheel', handleWheel)
    viewportRef.value.removeEventListener('gesturestart', handleGesture)
    viewportRef.value.removeEventListener('gesturechange', handleGesture)
  }
  if (scrollYTimer) clearTimeout(scrollYTimer)
  if (scrollXTimer) clearTimeout(scrollXTimer)
  clearTimeout(minimapCloseTimer)
  if (renderDebounceTimer) {
    clearTimeout(renderDebounceTimer)
  }
  if (intersectionObserver) {
    intersectionObserver.disconnect()
    intersectionObserver = null
  }
  renderTasks.forEach(task => {
    try { task.cancel() } catch (_) {}
  })
  renderTasks.clear()
})
</script>

<style scoped>
.arxiv-pdf-viewer-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #090a0f;
  position: relative;
  overflow: hidden;
  user-select: text;
}

/* 单层高保真统一顶部工具条 (对齐图 2 原版设计) */
.pdf-unified-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 44px;
  background: #090a0f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  gap: 12px;
  flex-shrink: 0;
  z-index: 30;
}

.toolbar-left-group,
.toolbar-center-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-right-group {
  display: flex;
  align-items: center;
  gap: 3px;
}

.tb-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
}

.tb-icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.07);
  color: #f1f5f9;
}

.tb-icon-btn.is-active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

.tb-icon-btn.is-disabled {
  opacity: 0.9 !important;
  cursor: default !important;
}

.tb-icon-btn:disabled:not(.is-disabled) {
  opacity: 0.35;
  cursor: not-allowed;
}

.tb-icon-btn svg {
  width: 17px;
  height: 17px;
}

/* 论文编号快速切换胶囊 */
.paper-id-trigger-wrap {
  position: relative;
  margin-left: 4px;
}

.paper-id-capsule-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.09);
  color: #cbd5e1;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.paper-id-capsule-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.16);
}

.pencil-icon {
  width: 11px;
  height: 11px;
  opacity: 0.75;
}

/* 弹出快速输入与最近阅读列表 */
.paper-id-popover {
  position: absolute;
  top: 36px;
  left: 0;
  width: 290px;
  background: #141724;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.7);
  padding: 12px;
  z-index: 100;
}

.popover-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.popover-tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}

.popover-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 13px;
  color: #fff;
  outline: none;
}

.popover-go-btn {
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--accent);
  color: var(--accent-ink, #000000);
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.popover-recents-list {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.recents-hint {
  font-size: 11px;
  color: #64748b;
  display: block;
  margin-bottom: 6px;
}

.recents-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.recent-chip {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  cursor: pointer;
}

.recent-chip.active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border-color: var(--accent);
  color: var(--accent);
}

/* 中间翻页组 */
.page-nav-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s ease;
}

.page-nav-arrow:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
}

.page-nav-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-nav-arrow svg {
  width: 14px;
  height: 14px;
}

.page-counter-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #cbd5e1;
  font-variant-numeric: tabular-nums;
  padding: 0 4px;
}

.page-num-input {
  width: 38px;
  min-width: 32px;
  height: 24px;
  text-align: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #f1f5f9;
  font-size: 13px;
  font-weight: 500;
  outline: none;
  padding: 0;
  margin: 0;
  -moz-appearance: textfield;
  -webkit-appearance: none;
  appearance: none;
}

.page-num-input::-webkit-outer-spin-button,
.page-num-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.page-num-input:focus {
  background: rgba(255, 255, 255, 0.08);
  border-color: color-mix(in srgb, var(--accent) 60%, transparent);
}

.page-slash {
  color: #64748b;
  font-size: 12px;
}

.page-total-num {
  color: #94a3b8;
  font-weight: 400;
}

/* 昼夜模式切换按钮与图标 */
.pdf-theme-toggle-btn {
  color: #94a3b8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.pdf-theme-toggle-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.pdf-theme-toggle-btn .sun-icon {
  color: #fbbf24;
}

.pdf-theme-toggle-btn .moon-icon {
  color: #94a3b8;
}

/* PDF 右侧章节指示横杠轨道 (Minimap) */
.pdf-section-minimap {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 45;
  display: flex;
  align-items: center;
  padding: 16px 0;
}

.minimap-track {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 7px;
  padding: 10px 6px;
  background: rgba(18, 19, 23, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.minimap-track:hover {
  background: rgba(18, 19, 23, 0.88);
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
}

.minimap-tick {
  height: 2px;
  border-radius: 1px;
  background: #52525b;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.minimap-tick.level-1 {
  width: 22px;
  background: #71717a;
}

.minimap-tick.level-2 {
  width: 14px;
  background: #52525b;
}

.minimap-tick.level-3 {
  width: 8px;
  background: #3f3f46;
}

/* 当前章节与父级章节高亮 (对齐图 2 与图 4，跟随主题色) */
.minimap-tick.is-active,
.minimap-tick.is-parent-active {
  background: var(--accent, #f87171) !important;
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent, #f87171) 60%, transparent);
}

.minimap-tick.is-active {
  transform: scaleX(1.18);
}

.minimap-tick:hover {
  background: #ffffff !important;
  transform: scaleX(1.28);
}

/* 悬浮文章分节目录卡片 (对齐图 2 alphaxiv 设计) */
.section-outline-popover {
  position: absolute;
  right: 42px;
  top: 50%;
  transform: translateY(-50%);
  width: 310px;
  max-height: 480px;
  background: rgba(18, 19, 22, 0.96);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 50;
}

/* 无缝热区桥接 (Hitbox Bridge)：消除横杠与卡片之间的 8px 中缝断层 */
.section-outline-popover::after {
  content: '';
  position: absolute;
  top: -24px;
  bottom: -24px;
  right: -28px;
  width: 36px;
  background: transparent;
  pointer-events: auto;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.popover-header-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.popover-title {
  font-size: 13px;
  font-weight: 600;
  color: #f4f4f5;
  letter-spacing: 0.01em;
}

.popover-pin-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  font-weight: 500;
}

.popover-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s ease;
}

.popover-close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
}

.popover-count {
  font-size: 11px;
  color: #71717a;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 7px;
  border-radius: 10px;
}

.popover-scroll-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.outline-tree-item {
  cursor: pointer;
  border-radius: 8px;
  padding: 6px 10px;
  transition: all 0.15s ease;
}

.outline-tree-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.outline-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.outline-item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.outline-item-page {
  font-size: 11px;
  color: #71717a;
  flex-shrink: 0;
}

.outline-tree-item.level-1 {
  font-size: 13px;
  font-weight: 600;
  color: #e4e4e7;
  margin-top: 6px;
}

.outline-tree-item.level-2 {
  font-size: 12.5px;
  font-weight: 500;
  color: #a1a1aa;
  padding-left: 20px;
}

.outline-tree-item.level-3 {
  font-size: 11.5px;
  font-weight: 400;
  color: #71717a;
  padding-left: 32px;
}

.outline-tree-item.is-active .outline-item-title {
  color: var(--accent, #f87171);
  font-weight: 600;
}

.outline-tree-item.is-active .outline-item-page {
  color: var(--accent, #f87171);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translate(10px, -50%);
}

/* 视口滚动区域 */
.pdf-scroll-viewport {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  overscroll-behavior-x: auto;
  position: relative;
  background: #090a0f;
  padding: 24px 16px 80px 16px;
  box-sizing: border-box;
  /* Firefox 优雅独立滑动条：未滚动时完全透明，垂直滚动时显示 */
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.25s ease;
}

.pdf-scroll-viewport.scrolling-y {
  scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
}

/* WebKit/Blink (Chrome, Edge, Safari) 优雅自动隐藏滚动条 */
.pdf-scroll-viewport::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.pdf-scroll-viewport::-webkit-scrollbar-track {
  background: transparent;
}

/* 默认状态下滑动块全透明（无滑动时自动隐藏） */
.pdf-scroll-viewport::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 9999px;
  transition: background-color 0.25s ease;
}

/* 仅在垂直滚动时点亮纵向滚动条 */
.pdf-scroll-viewport.scrolling-y::-webkit-scrollbar-thumb:vertical {
  background-color: rgba(148, 163, 184, 0.4);
}
.pdf-scroll-viewport.scrolling-y::-webkit-scrollbar-thumb:vertical:hover {
  background-color: rgba(148, 163, 184, 0.7);
}

/* 仅在水平滚动时点亮横向滚动条 */
.pdf-scroll-viewport.scrolling-x::-webkit-scrollbar-thumb:horizontal {
  background-color: rgba(148, 163, 184, 0.4);
}
.pdf-scroll-viewport.scrolling-x::-webkit-scrollbar-thumb:horizontal:hover {
  background-color: rgba(148, 163, 184, 0.7);
}

/* 彻底去除右下角两个滑动条交汇处的白色方块 (corner) */
.pdf-scroll-viewport::-webkit-scrollbar-corner {
  background: transparent !important;
  display: none !important;
}

.pdf-scroll-viewport::-webkit-resizer {
  background: transparent !important;
}

/* 加载状态与错误提示 */
.pdf-loading-state,
.pdf-error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 380px;
  width: 100%;
  text-align: center;
  color: #94a3b8;
  gap: 14px;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid color-mix(in srgb, var(--accent) 20%, transparent);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-hint {
  font-size: 13px;
  color: #94a3b8;
}

.error-badge {
  display: inline-block;
  padding: 4px 10px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 6px;
  color: #f87171;
  font-size: 12px;
  font-weight: 500;
}

.error-msg {
  font-size: 13px;
  max-width: 440px;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 8px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn.primary {
  background: var(--accent);
  color: var(--accent-ink, #000000);
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
}

.iframe-container {
  width: 100%;
  height: 600px;
  margin-top: 20px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.fallback-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* 页面卡片容器 (水平居中且放大超出时靠左对齐，彻底杜绝负坐标截断) */
.pdf-pages-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  width: max-content;
  min-width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

/* 暗色 PDF 模式 (完全对齐图 4) */
.pdf-pages-container.theme-dark .pdf-page-card {
  background: #18191f;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.pdf-pages-container.theme-dark .pdf-canvas {
  filter: invert(0.92) hue-rotate(180deg) brightness(1.02) contrast(0.96);
}

/* 明亮白底 PDF 模式 (对齐图 1) */
.pdf-pages-container.theme-light .pdf-page-card {
  background: #ffffff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.2);
}

.pdf-pages-container.theme-light .pdf-canvas {
  filter: none;
}

.pdf-page-card {
  position: relative;
  border-radius: 3px;
  transition: box-shadow 0.2s ease;
}

.pdf-page-inner {
  position: relative;
  overflow: hidden;
}

.pdf-canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
  object-fit: fill;
}

/* 页面占位骨架 */
.page-skeleton-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #141722;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #64748b;
}

.page-footer-tag {
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #64748b;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

/* 划选高亮核心样式：对齐图 4 的温暖橄榄金底色与纯净边缘 */
:deep(.textLayer) {
  opacity: 1;
  mix-blend-mode: normal;
  width: 100% !important;
  height: 100% !important;
  transform-origin: 0 0;
}

:deep(.textLayer span) {
  color: transparent;
}

:deep(.textLayer ::selection) {
  background: rgba(163, 135, 60, 0.55) !important;
  color: transparent !important;
}

:deep(.theme-light .textLayer ::selection) {
  background: rgba(185, 150, 55, 0.45) !important;
  color: transparent !important;
}

/* 划词浮动动作气泡 (The alphaXiv Experience) */
.floating-action-bubble {
  position: absolute;
  z-index: 999;
  display: flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5), 0 0 16px color-mix(in srgb, var(--accent) 22%, transparent);
  border-radius: 20px;
  padding: 4px;
  gap: 2px;
  user-select: none;
}

.bubble-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: transparent;
  border: none;
  border-radius: 14px;
  color: #f1f5f9;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.bubble-btn:hover {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}

.bubble-btn.quote-btn {
  color: var(--accent);
  font-weight: 600;
}

.bubble-btn.quote-btn:hover {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
}

.bubble-icon {
  width: 13px;
  height: 13px;
}

.bubble-fade-enter-active,
.bubble-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.bubble-fade-enter-from,
.bubble-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
