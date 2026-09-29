<template>
  <div
    ref="containerRef"
    class="sliding-segmented"
    @click="handleContainerClick"
  >
    <div
      class="glass-glider"
      :style="gliderStyle"
      aria-hidden="true"
    ></div>
    <slot></slot>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

const props = defineProps({
  activeKey: {
    type: [String, Number, Boolean],
    default: undefined
  }
})

const containerRef = ref(null)
const gliderStyle = ref({
  opacity: '0',
  transform: 'translateX(0px)',
  width: '0px',
  height: '0px',
  top: '0px',
  borderRadius: ''
})

let mutationObserver = null
let resizeObserver = null

function updateGlider() {
  if (!containerRef.value) return

  const container = containerRef.value
  const activeEl = container.querySelector(
    'button.active, .active:not(.glass-glider), [aria-selected="true"], input:checked + label'
  )

  if (!activeEl) {
    gliderStyle.value = {
      ...gliderStyle.value,
      opacity: '0'
    }
    return
  }

  // Calculate coordinates relative to container
  const offsetLeft = activeEl.offsetLeft || 0
  const offsetTop = activeEl.offsetTop || 0
  const offsetWidth = activeEl.offsetWidth || 0
  const offsetHeight = activeEl.offsetHeight || 0

  let borderRadius = ''
  if (typeof window !== 'undefined') {
    try {
      const computedBtn = window.getComputedStyle(activeEl)
      if (computedBtn && computedBtn.borderRadius && computedBtn.borderRadius !== '0px') {
        borderRadius = computedBtn.borderRadius
      } else {
        const computedContainer = window.getComputedStyle(container)
        if (computedContainer && computedContainer.borderRadius) {
          borderRadius = computedContainer.borderRadius
        }
      }
    } catch {
      // fallback
    }
  }

  gliderStyle.value = {
    opacity: '1',
    transform: `translateX(${offsetLeft}px)`,
    top: `${offsetTop}px`,
    width: `${offsetWidth}px`,
    height: `${offsetHeight}px`,
    borderRadius: borderRadius || ''
  }
}

function handleContainerClick() {
  nextTick(() => {
    updateGlider()
    setTimeout(updateGlider, 60)
  })
}

watch(
  () => props.activeKey,
  () => {
    nextTick(updateGlider)
  }
)

onMounted(() => {
  nextTick(() => {
    updateGlider()
    setTimeout(updateGlider, 100)
  })

  if (typeof window !== 'undefined' && containerRef.value) {
    // Observe DOM changes (such as .active class added or removed on buttons)
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => {
        updateGlider()
      })
      mutationObserver.observe(containerRef.value, {
        attributes: true,
        attributeFilter: ['class', 'aria-selected', 'checked'],
        subtree: true,
        childList: true
      })
    }

    // Observe container or child resizes
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateGlider()
      })
      resizeObserver.observe(containerRef.value)
    }

    window.addEventListener('resize', updateGlider)
  }
})

onBeforeUnmount(() => {
  if (mutationObserver) {
    mutationObserver.disconnect()
    mutationObserver = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateGlider)
  }
})

defineExpose({
  updateGlider
})
</script>

<style scoped>
.sliding-segmented {
  position: relative;
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  box-sizing: border-box;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.sliding-segmented::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

.glass-glider {
  position: absolute;
  left: 0;
  z-index: 1;
  pointer-events: none;
  box-sizing: border-box;
  border-radius: var(--glider-radius, 8px);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow:
    0 0 16px rgba(120, 119, 198, 0.32),
    inset 0 1px 2px rgba(255, 255, 255, 0.28),
    inset 0 -1px 2px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.16);
  transition:
    transform 0.45s cubic-bezier(0.37, 1.95, 0.66, 0.56),
    width 0.35s cubic-bezier(0.37, 1.95, 0.66, 0.56),
    height 0.25s ease,
    border-radius 0.25s ease,
    opacity 0.2s ease;
  will-change: transform, width;
}

:deep(button),
:deep(a),
:deep(label) {
  position: relative;
  z-index: 2;
  transition: color 0.25s ease, opacity 0.25s ease;
}

:deep(button.active),
:deep(a.active),
:deep([aria-selected="true"]) {
  background: transparent !important;
  color: var(--text, #ffffff) !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}
</style>
