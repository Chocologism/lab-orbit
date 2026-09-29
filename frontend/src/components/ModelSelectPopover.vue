<template>
  <div class="model-popover-container" ref="containerRef">
    <!-- 全域可点击触发按钮 -->
    <button
      type="button"
      class="model-trigger-btn"
      :class="{ 'is-open': isOpen, 'is-compact': compact }"
      :title="`当前模型：${currentModel?.name || currentModel?.id || '未选择'} (点击切换)`"
      @click.stop="toggleOpen"
    >
      <span class="status-indicator-dot"></span>
      <span class="model-name-label">{{ currentModelShortName }}</span>
      <svg
        class="dropdown-chevron"
        :class="{ 'is-rotated': isOpen }"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <!-- 浮层下拉选单 (毛玻璃半透明微质感) -->
    <Transition name="model-popover-anim">
      <div
        v-if="isOpen"
        class="model-popover-dropdown"
        :class="[placement]"
        @click.stop
      >
        <div class="popover-header">
          <div class="header-left">
            <svg class="header-ai-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path>
              <path d="M12 6v6l4 2"></path>
            </svg>
            <span class="header-title">可用 AI 大模型</span>
          </div>
          <span class="header-count-badge">{{ models.length }} 款模型</span>
        </div>

        <div class="popover-scroll-list">
          <button
            v-for="m in models"
            :key="m.id"
            type="button"
            class="model-option-card"
            :class="{ 'is-active': m.id === modelValue }"
            @click="handleSelect(m.id)"
          >
            <div class="option-main-info">
              <div class="option-title-row">
                <span class="option-name">{{ m.name || m.id }}</span>
              </div>
              <div v-if="getModelProvider(m) || isReasoningModel(m) || isVisionModel(m)" class="option-badges-row">
                <span v-if="getModelProvider(m)" class="model-badge provider-badge">
                  {{ getModelProvider(m) }}
                </span>
                <span v-if="m.supportsReasoningEffort || isReasoningModel(m)" class="model-badge reasoning-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="badge-icon">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                  </svg>
                  思考
                </span>
                <span v-if="m.supportsVision || isVisionModel(m)" class="model-badge vision-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="badge-icon">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  视觉
                </span>
              </div>
            </div>

            <div class="option-check-indicator">
              <svg
                v-if="m.id === modelValue"
                class="check-svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  models: {
    type: Array,
    default: () => []
  },
  placement: {
    type: String,
    default: 'top', // 'top' (朝上弹出，适合底部输入框) | 'bottom' (朝下弹出，适合顶部栏)
    validator: (v) => ['top', 'bottom'].includes(v)
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const containerRef = ref(null)
const isOpen = ref(false)

const currentModel = computed(() => {
  return props.models.find(m => m.id === props.modelValue) || props.models[0] || null
})

const currentModelShortName = computed(() => {
  if (!currentModel.value) return '选择模型'
  const name = currentModel.value.name || currentModel.value.id
  // 智能简化长名称供药丸按钮紧凑展示
  return name.replace(/DeepSeek\s*/i, 'DeepSeek-').trim()
})

function toggleOpen() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

function handleSelect(id) {
  emit('update:modelValue', id)
  emit('change', id)
  close()
}

function getModelProvider(m) {
  const name = (m.name || m.id || '').toLowerCase()
  if (name.includes('deepseek')) return 'DeepSeek'
  if (name.includes('gpt') || name.includes('openai')) return 'OpenAI'
  if (name.includes('claude') || name.includes('anthropic')) return 'Anthropic'
  if (name.includes('gemini') || name.includes('google')) return 'Google'
  if (name.includes('qwen') || name.includes('ali')) return 'Alibaba'
  return ''
}

function isReasoningModel(m) {
  const str = (m.id + ' ' + (m.name || '')).toLowerCase()
  return str.includes('r1') || str.includes('reasoner') || str.includes('o1') || str.includes('o3') || str.includes('thinking')
}

function isVisionModel(m) {
  const str = (m.id + ' ' + (m.name || '')).toLowerCase()
  return str.includes('vision') || str.includes('4o') || str.includes('vl') || str.includes('sonnet')
}

function onDocumentClick(e) {
  if (isOpen.value && containerRef.value && !containerRef.value.contains(e.target)) {
    close()
  }
}

function onKeydown(e) {
  if (e.key === 'Escape' && isOpen.value) {
    close()
  }
}

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('click', onDocumentClick, true)
    document.addEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', onDocumentClick, true)
    document.removeEventListener('keydown', onKeydown)
  }
})
</script>

<style scoped>
.model-popover-container {
  position: relative;
  display: inline-flex;
  align-items: center;
}

/* 药丸触发按钮：整块全域可点击，彻底解决只能点中间问题 */
.model-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  padding: 4px 12px 4px 10px;
  font-size: 12.5px;
  font-weight: 500;
  color: #e2e8f0;
  cursor: pointer;
  outline: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  max-width: 220px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.model-trigger-btn:hover {
  background: rgba(255, 255, 255, 0.09);
  border-color: color-mix(in srgb, var(--accent, #38bdf8) 40%, transparent);
  color: #ffffff;
  transform: translateY(-0.5px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.model-trigger-btn.is-open {
  background: color-mix(in srgb, var(--accent, #38bdf8) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent, #38bdf8) 60%, transparent);
  color: var(--accent, #38bdf8);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent, #38bdf8) 25%, transparent);
}

.model-trigger-btn.is-compact {
  padding: 3px 9px 3px 8px;
  font-size: 11.5px;
  gap: 5px;
}

/* 呼吸指示绿点 */
.status-indicator-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
  flex-shrink: 0;
  animation: pulse-dot 2.5s infinite ease-in-out;
}

@keyframes pulse-dot {
  0%, 100% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.18);
    opacity: 1;
  }
}

.model-name-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
  letter-spacing: -0.01em;
}

.dropdown-chevron {
  width: 12px;
  height: 12px;
  color: #94a3b8;
  flex-shrink: 0;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease;
}

.model-trigger-btn:hover .dropdown-chevron,
.model-trigger-btn.is-open .dropdown-chevron {
  color: var(--accent, #38bdf8);
}

.dropdown-chevron.is-rotated {
  transform: rotate(180deg);
}

/* 浮层下拉框 */
.model-popover-dropdown {
  position: absolute;
  left: 0;
  z-index: 1050;
  width: 310px;
  max-width: 90vw;
  background: rgba(18, 21, 31, 0.94);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.7),
              0 0 0 1px rgba(255, 255, 255, 0.06),
              0 0 20px color-mix(in srgb, var(--accent, #38bdf8) 12%, transparent);
  overflow: hidden;
  padding: 6px;
  display: flex;
  flex-direction: column;
}

/* 向上弹出 (默认，适用于底部输入框) */
.model-popover-dropdown.top {
  bottom: calc(100% + 8px);
  transform-origin: bottom left;
}

/* 向下弹出 (适用于顶部栏) */
.model-popover-dropdown.bottom {
  top: calc(100% + 8px);
  transform-origin: top left;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  margin-bottom: 4px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-ai-icon {
  width: 14px;
  height: 14px;
  color: var(--accent, #38bdf8);
}

.header-title {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.header-count-badge {
  font-size: 11px;
  color: #64748b;
  background: rgba(255, 255, 255, 0.05);
  padding: 1px 6px;
  border-radius: 6px;
}

.popover-scroll-list {
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-right: 2px;
}

.popover-scroll-list::-webkit-scrollbar {
  width: 4px;
}

.popover-scroll-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

/* 单项卡片 */
.model-option-card {
  width: 100%;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  transition: all 0.16s ease;
  outline: none;
}

.model-option-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.08);
}

.model-option-card.is-active {
  background: color-mix(in srgb, var(--accent, #38bdf8) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent, #38bdf8) 35%, transparent);
}

.option-main-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.option-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.option-name {
  font-size: 13px;
  font-weight: 550;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-option-card.is-active .option-name {
  color: var(--accent, #38bdf8);
  font-weight: 600;
}

.option-badges-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.model-badge {
  font-size: 10.5px;
  padding: 1.5px 5.5px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  line-height: 1.2;
}

.badge-icon {
  width: 10px;
  height: 10px;
}

.provider-badge {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
}

.reasoning-badge {
  background: rgba(168, 85, 247, 0.16);
  color: #c084fc;
}

.vision-badge {
  background: rgba(34, 197, 94, 0.16);
  color: #4ade80;
}

.option-check-indicator {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.check-svg {
  width: 16px;
  height: 16px;
  color: var(--accent, #38bdf8);
}

/* 进退场动效 */
.model-popover-anim-enter-active,
.model-popover-anim-leave-active {
  transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.model-popover-anim-enter-from,
.model-popover-anim-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(4px);
}
</style>
