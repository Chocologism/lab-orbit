<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { refreshArxivUnread, getCachedArxivUnread, clearArxivUnread, markArxivFeedViewed, ARXIV_UNREAD_EVENT } from '../utils/arxivUnread'
import { useResourceUnread, RESOURCE_UNREAD_EVENT } from '../composables/resourceUnread'

const route = useRoute()
const unreadArxivCount = ref(0)
const hasDirectArxiv = ref(false)

const { unreadResourceCount, preferredCategory, refresh: refreshResourceUnread } = useResourceUnread()

function handleArxivUnreadState(e) {
  const summary = e?.detail || getCachedArxivUnread()
  unreadArxivCount.value = Number(summary.unreadCount || 0)
  hasDirectArxiv.value = Boolean(summary.hasDirect)
}

async function refreshUnreadArxivState() {
  try {
    const summary = await refreshArxivUnread()
    unreadArxivCount.value = Number(summary.unreadCount || 0)
    hasDirectArxiv.value = Boolean(summary.hasDirect)
  } catch {}
}

function handleResourceUnreadState(e) {
  if (e?.detail) {
    unreadResourceCount.value = Number(e.detail.count || 0)
    preferredCategory.value = e.detail.category || ''
  }
}

function getMobileDestination(item) {
  if (item.to === '/resources' && preferredCategory.value) {
    return { path: '/resources', query: { category: preferredCategory.value } }
  }
  return item.to
}

watch(() => route.path, (newPath) => {
  if (newPath === '/arxiv') {
    markArxivFeedViewed()
  }
  if (newPath === '/resources') {
    refreshResourceUnread()
  }
})

onMounted(() => {
  const initialArxiv = getCachedArxivUnread()
  unreadArxivCount.value = initialArxiv.unreadCount
  hasDirectArxiv.value = initialArxiv.hasDirect
  refreshUnreadArxivState()
  refreshResourceUnread()
  window.addEventListener(ARXIV_UNREAD_EVENT, handleArxivUnreadState)
  window.addEventListener('arxiv-feed-updated', refreshUnreadArxivState)
  window.addEventListener(RESOURCE_UNREAD_EVENT, handleResourceUnreadState)
})

onBeforeUnmount(() => {
  window.removeEventListener(ARXIV_UNREAD_EVENT, handleArxivUnreadState)
  window.removeEventListener('arxiv-feed-updated', refreshUnreadArxivState)
  window.removeEventListener(RESOURCE_UNREAD_EVENT, handleResourceUnreadState)
})

const navItems = [
  { to: '/', label: '工作台', icon: 'workbench', exact: true },
  { to: '/arxiv', label: '文献推荐', icon: 'feed-paper' },
  { to: '/seminars', label: '学术日程', icon: 'schedule' },
  { to: '/mailbox', label: '学术邮箱', icon: 'envelope' },
  { to: '/resources', label: '资料库', icon: 'resource-db' },
]

function isActive(item) {
  if (item.exact) {
    return route.path === item.to
  }
  return route.path.startsWith(item.to)
}
</script>

<template>
  <Teleport to="body">
    <nav class="mobile-nav-bar" aria-label="移动端主导航">
      <div class="mobile-nav-track">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="getMobileDestination(item)"
          class="mobile-nav-item"
          :class="{ active: isActive(item) }"
          @click="item.to === '/arxiv' && markArxivFeedViewed()"
        >
          <div class="nav-icon-wrap">
            <AppIcon :name="item.icon" :size="20" />
            <span v-if="isActive(item)" class="nav-active-glow" aria-hidden="true"></span>
            <span
              v-if="item.to === '/arxiv' && unreadArxivCount > 0"
              class="mobile-arxiv-badge"
              :class="{ 'is-gold': hasDirectArxiv, 'is-red': !hasDirectArxiv }"
            >
              {{ unreadArxivCount > 99 ? '99+' : unreadArxivCount }}
            </span>
            <span
              v-if="item.to === '/resources' && unreadResourceCount > 0"
              class="mobile-resource-dot"
              title="资料库有更新"
            ></span>
          </div>
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </div>
    </nav>
  </Teleport>
</template>

<style scoped>
.mobile-nav-bar {
  display: none;
}

@media (max-width: 768px) {
  .mobile-nav-bar {
    display: block;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    z-index: 990;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
    background: rgba(10, 6, 20, 0.94);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-top: 1px solid rgba(184, 155, 248, 0.16);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.5);
    user-select: none;
    -webkit-user-select: none;
  }

  .mobile-nav-track {
    display: flex;
    align-items: center;
    justify-content: space-around;
    height: 58px;
    max-width: 500px;
    margin: 0 auto;
    padding: 0 6px;
  }

  .mobile-nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: 100%;
    color: var(--muted, #b2c6c8);
    text-decoration: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
    position: relative;
  }

  .mobile-nav-item:active {
    transform: scale(0.92);
  }

  .nav-icon-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 24px;
  }

  .mobile-arxiv-badge {
    position: absolute;
    top: -5px;
    right: -8px;
    min-width: 15px;
    height: 15px;
    padding: 0 3px;
    border-radius: 9999px;
    font-size: 9px;
    font-weight: 700;
    line-height: 15px;
    text-align: center;
    pointer-events: none;
    z-index: 10;
  }

  .mobile-arxiv-badge.is-red {
    background: #ef4444;
    background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
    color: #ffffff;
    box-shadow: 0 2px 6px rgba(225, 29, 72, 0.45);
  }

  .mobile-arxiv-badge.is-gold {
    background: #f59e0b;
    background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
    color: #1c1917;
    font-weight: 800;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.6), 0 0 10px rgba(251, 191, 36, 0.4);
  }

  .mobile-resource-dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ef4444;
    background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
    box-shadow: 0 0 8px rgba(225, 29, 72, 0.75);
    pointer-events: none;
    z-index: 10;
    animation: resourceDotPulse 2.2s ease-in-out infinite;
  }

  @keyframes resourceDotPulse {
    0%, 100% {
      transform: scale(0.95);
      box-shadow: 0 0 6px rgba(225, 29, 72, 0.65);
    }
    50% {
      transform: scale(1.3);
      box-shadow: 0 0 12px rgba(244, 63, 94, 0.95);
    }
  }

  .nav-active-glow {
    position: absolute;
    bottom: -3px;
    width: 14px;
    height: 3px;
    border-radius: 999px;
    background: var(--accent, #b89bf8);
    box-shadow: 0 0 10px var(--accent, #b89bf8);
  }

  .nav-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
    line-height: 1.2;
    transition: color 0.2s ease;
  }

  .mobile-nav-item.active {
    color: var(--accent, #b89bf8);
  }

  .mobile-nav-item.active .nav-label {
    font-weight: 600;
    color: #ffffff;
    text-shadow: 0 0 12px rgba(184, 155, 248, 0.6);
  }

  /* ==========================================================================
     曜石碳灰风格还原 (Obsidian Gray) - 系统默认
     ========================================================================== */
  [data-color-scheme="obsidian-gray"] .mobile-nav-bar {
    background: rgba(9, 13, 22, 0.94) !important;
    border-top: 1px solid rgba(148, 163, 184, 0.18) !important;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.5) !important;
  }

  [data-color-scheme="obsidian-gray"] .nav-active-glow {
    background: #94a3b8 !important;
    box-shadow: 0 0 10px rgba(148, 163, 184, 0.6) !important;
  }

  [data-color-scheme="obsidian-gray"] .mobile-nav-item.active {
    color: #94a3b8 !important;
  }

  [data-color-scheme="obsidian-gray"] .mobile-nav-item.active .nav-label {
    color: #ffffff !important;
    text-shadow: 0 0 12px rgba(148, 163, 184, 0.5) !important;
  }

  /* ==========================================================================
     星云紫风格还原 (Nebula Purple)
     ========================================================================== */
  [data-color-scheme="nebula-purple"] .mobile-nav-bar {
    background: rgba(12, 8, 30, 0.94) !important;
    border-top: 1px solid rgba(184, 155, 248, 0.22) !important;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.5) !important;
  }

  [data-color-scheme="nebula-purple"] .nav-active-glow {
    background: #b89bf8 !important;
    box-shadow: 0 0 12px rgba(184, 155, 248, 0.7) !important;
  }

  [data-color-scheme="nebula-purple"] .mobile-nav-item.active {
    color: #b89bf8 !important;
  }

  [data-color-scheme="nebula-purple"] .mobile-nav-item.active .nav-label {
    color: #ffffff !important;
    text-shadow: 0 0 12px rgba(184, 155, 248, 0.6) !important;
  }

  /* ==========================================================================
     水波云雾风格还原 (Vanta Fog / Clouds Static / Classic Cyan)
     ========================================================================== */
  [data-color-scheme="classic-cyan"] .mobile-nav-bar,
  [data-theme-style="vanta-fog"] .mobile-nav-bar {
    background: rgba(10, 26, 33, 0.92) !important;
    border-top: 1px solid rgba(218, 238, 235, 0.16) !important;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.4) !important;
  }

  [data-color-scheme="classic-cyan"] .nav-active-glow,
  [data-theme-style="vanta-fog"] .nav-active-glow {
    background: var(--accent, #c5e6df) !important;
    box-shadow: 0 0 10px var(--accent, #c5e6df) !important;
  }

  [data-color-scheme="classic-cyan"] .mobile-nav-item.active,
  [data-theme-style="vanta-fog"] .mobile-nav-item.active {
    color: var(--accent, #c5e6df) !important;
  }

  [data-color-scheme="classic-cyan"] .mobile-nav-item.active .nav-label,
  [data-theme-style="vanta-fog"] .mobile-nav-item.active .nav-label {
    text-shadow: 0 0 12px rgba(197, 230, 223, 0.6) !important;
  }

  /* 自定义配色方案适配 */
  [data-color-scheme="custom"] .mobile-nav-bar {
    background: color-mix(in srgb, var(--bg, #090d16) 94%, transparent) !important;
    border-top: 1px solid var(--line) !important;
  }
  [data-color-scheme="custom"] .nav-active-glow {
    background: var(--accent) !important;
    box-shadow: 0 0 10px var(--accent) !important;
  }
  [data-color-scheme="custom"] .mobile-nav-item.active {
    color: var(--accent) !important;
  }
  [data-color-scheme="custom"] .mobile-nav-item.active .nav-label {
    text-shadow: 0 0 12px color-mix(in srgb, var(--accent) 60%, transparent) !important;
  }
}
</style>
