<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useNoticeScanState } from '../composables/useNoticeScanState'
import AppIcon from './AppIcon.vue'

const router = useRouter()
const route = useRoute()

const {
  isNoticeScanning,
  noticeScanProgress,
  noticeScanCandidates,
  hasUnreadNoticeResults,
  showNoticeScanModal,
  openNoticeScanModal,
  cancelNoticeScan,
  dismissNoticeScanBanner
} = useNoticeScanState()

const isVisible = computed(() => {
  // 当模态弹窗正在显示时，隐藏浮动胶囊避免视觉重复
  if (showNoticeScanModal.value) return false
  return isNoticeScanning.value || hasUnreadNoticeResults.value
})

function handleOpenModal() {
  if (route.path !== '/notices') {
    router.push('/notices')
  }
  openNoticeScanModal()
}
</script>

<template>
  <Transition name="scan-banner-slide">
    <div v-if="isVisible" class="notice-scan-floating-banner glass-card" :class="{ 'is-completed': !isNoticeScanning && hasUnreadNoticeResults }">
      <!-- 扫描中状态 -->
      <template v-if="isNoticeScanning">
        <div class="banner-spinner-ring">
          <div class="loading-spinner mini"></div>
        </div>
        <div class="banner-content">
          <div class="banner-title-row">
            <AppIcon name="sparkle" :size="14" class="sparkle-icon" />
            <span class="banner-title">AI 后台扫描邮件通知中…</span>
          </div>
          <span class="banner-desc">{{ noticeScanProgress || '正在分析最近一周邮件…' }}</span>
        </div>
        <div class="banner-actions">
          <button type="button" class="btn-banner-action" @click="handleOpenModal">
            查看
          </button>
          <button type="button" class="btn-banner-close" title="取消后台扫描" @click="cancelNoticeScan">
            <AppIcon name="close" :size="14" />
          </button>
        </div>
      </template>

      <!-- 扫描完成提醒状态 -->
      <template v-else-if="hasUnreadNoticeResults">
        <div class="banner-icon-success">
          <AppIcon name="check" :size="16" />
        </div>
        <div class="banner-content">
          <span class="banner-title">邮件通知识别完成！</span>
          <span class="banner-desc">共识别出 <b>{{ noticeScanCandidates.length }}</b> 条候选通知</span>
        </div>
        <div class="banner-actions">
          <button type="button" class="btn-banner-action primary" @click="handleOpenModal">
            查看并导入
          </button>
          <button type="button" class="btn-banner-close" title="关闭提示" @click="dismissNoticeScanBanner">
            <AppIcon name="close" :size="14" />
          </button>
        </div>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
.notice-scan-floating-banner {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 180;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  max-width: 420px;
  border-radius: 9999px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  background: var(--bg-card, rgba(22, 33, 49, 0.88));
  color: var(--text-primary, #ffffff);
  animation: banner-glow 3s infinite ease-in-out;
  pointer-events: auto;
}

.notice-scan-floating-banner.is-completed {
  border-color: rgba(16, 185, 129, 0.35);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), 0 0 15px rgba(16, 185, 129, 0.2);
}

.banner-spinner-ring {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.loading-spinner.mini {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--accent, #38bdf8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.banner-icon-success {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  flex-shrink: 0;
}

.banner-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.banner-title-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.sparkle-icon {
  color: var(--accent, #38bdf8);
}

.banner-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.banner-desc {
  font-size: 11px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.btn-banner-action {
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #ffffff);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-banner-action:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.btn-banner-action.primary {
  background: var(--accent, #38bdf8);
  color: #0d1520;
  border-color: var(--accent, #38bdf8);
  font-weight: 600;
}

.btn-banner-action.primary:hover {
  filter: brightness(1.1);
}

.btn-banner-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-banner-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--text-primary, #ffffff);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes banner-glow {
  0%, 100% {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.12);
  }
  50% {
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), 0 0 12px rgba(56, 189, 248, 0.25);
  }
}

.scan-banner-slide-enter-active,
.scan-banner-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.scan-banner-slide-enter-from,
.scan-banner-slide-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

@media (max-width: 640px) {
  .notice-scan-floating-banner {
    bottom: 80px;
    right: 16px;
    left: 16px;
    max-width: none;
    border-radius: 16px;
  }
}
</style>
