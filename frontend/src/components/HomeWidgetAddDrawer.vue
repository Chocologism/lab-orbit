<script setup>
import { ref, computed, watch } from 'vue'
import BaseDialog from './BaseDialog.vue'
import AppIcon from './AppIcon.vue'
import { WIDGET_REGISTRY, SIZE_SPANS, CANONICAL_SIZE_ORDER } from '../composables/useHomeGridEngine'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  initialWidgetId: {
    type: String,
    default: null
  },
  initialSize: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'add'])

const widgetList = computed(() => Object.values(WIDGET_REGISTRY))

const selectedWidgetId = ref(props.initialWidgetId || 'conferences')
const selectedWidget = computed(() => WIDGET_REGISTRY[selectedWidgetId.value] || widgetList.value[0])

const selectedSize = ref(props.initialSize || 'wide')

watch(() => props.open, (val) => {
  if (val) {
    if (props.initialWidgetId) selectedWidgetId.value = props.initialWidgetId
    if (props.initialSize) selectedSize.value = props.initialSize
  }
})

const orderedSupportedSizes = computed(() => {
  const supported = selectedWidget.value?.supportedSizes || []
  return CANONICAL_SIZE_ORDER.filter(s => supported.includes(s))
})

function handleSelectWidget(id) {
  selectedWidgetId.value = id
  const item = WIDGET_REGISTRY[id]
  if (item && item.supportedSizes && !item.supportedSizes.includes(selectedSize.value)) {
    selectedSize.value = item.defaultSize || item.supportedSizes[0]
  }
}

function handleAdd() {
  emit('add', {
    widgetId: selectedWidgetId.value,
    size: selectedSize.value
  })
  emit('close')
}

function getSizeBadge(size) {
  const meta = SIZE_SPANS[size]
  return meta ? `${meta.label} (${size})` : size
}
</script>

<template>
  <BaseDialog
    :open="open"
    title="添加小组件至首页"
    drawer
    @close="emit('close')"
  >
    <div class="widget-add-drawer-content">
      <p class="drawer-subtitle">
        选择需要添加的科研业务卡片及对应尺寸。添加后将自动寻找可用空间就位，并可在编辑模式下自由拖拽排版。
      </p>

      <!-- 组件类别选择列表 -->
      <div class="drawer-section">
        <label class="drawer-label">选择小组件业务</label>
        <div class="widget-pick-grid">
          <button
            v-for="w in widgetList"
            :key="w.id"
            type="button"
            class="widget-pick-btn"
            :class="{ 'is-selected': selectedWidgetId === w.id }"
            @click="handleSelectWidget(w.id)"
          >
            <div class="pick-btn-icon">
              <AppIcon :name="w.icon" :size="18" />
            </div>
            <div class="pick-btn-text">
              <span class="pick-btn-title">{{ w.name }}</span>
              <span class="pick-btn-desc">{{ w.defaultLocation === 'slot1' ? '1号位优先' : '右栏网格' }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- 组件详情与尺寸配置 -->
      <div v-if="selectedWidget" class="drawer-section selected-detail-section">
        <div class="selected-detail-header">
          <div class="header-icon-badge">
            <AppIcon :name="selectedWidget.icon" :size="20" />
          </div>
          <div class="header-text">
            <h4>{{ selectedWidget.name }}</h4>
            <p>{{ selectedWidget.description }}</p>
          </div>
        </div>

        <div class="drawer-size-selector">
          <label class="drawer-label">选择卡片几何尺寸</label>
          <div class="size-options-grid">
            <button
              v-for="s in orderedSupportedSizes"
              :key="s"
              type="button"
              class="size-option-card"
              :class="{ 'is-active': selectedSize === s }"
              @click="selectedSize = s"
            >
              <div class="size-option-top">
                <span class="size-label">{{ SIZE_SPANS[s]?.label }}</span>
                <span class="size-code mono">{{ s }}</span>
              </div>
              <p class="size-desc">{{ SIZE_SPANS[s]?.desc }}</p>
            </button>
          </div>
        </div>
      </div>

      <!-- 底部添加动作栏 -->
      <div class="drawer-actions">
        <button type="button" class="btn-cancel" @click="emit('close')">
          取消
        </button>
        <button type="button" class="btn-confirm-add" @click="handleAdd">
          <AppIcon name="plus" :size="16" />
          <span>确认添加至首页</span>
        </button>
      </div>
    </div>
  </BaseDialog>
</template>

<style scoped>
.widget-add-drawer-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  color: var(--text-color, #e2e8f0);
}

.drawer-subtitle {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary, #94a3b8);
}

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.drawer-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted, #64748b);
}

.widget-pick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.widget-pick-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  color: inherit;
}

.widget-pick-btn:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  transform: translateY(-1px);
}

.widget-pick-btn.is-selected {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border-color: var(--accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 25%, transparent);
}

.pick-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--accent);
}

.pick-btn-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pick-btn-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pick-btn-desc {
  font-size: 11px;
  color: var(--text-muted, #64748b);
}

.selected-detail-section {
  padding: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.selected-detail-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.header-icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  flex-shrink: 0;
}

.header-text h4 {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #f8fafc);
}

.header-text p {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary, #94a3b8);
}

.size-options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
  margin-top: 6px;
}

.size-option-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.18s ease;
  color: inherit;
}

.size-option-card:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
}

.size-option-card.is-active {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  border-color: var(--accent);
}

.size-option-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.size-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #f8fafc);
}

.size-code {
  font-size: 10px;
  color: var(--accent);
}

.size-desc {
  margin: 0;
  font-size: 11px;
  line-height: 1.35;
  color: var(--text-secondary, #94a3b8);
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
}

.btn-cancel {
  padding: 8px 16px;
  font-size: 13px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
  color: var(--text-secondary, #94a3b8);
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary, #f8fafc);
}

.btn-confirm-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong, var(--accent)) 100%);
  border: none;
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 35%, transparent);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-confirm-add:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 45%, transparent);
}
</style>
