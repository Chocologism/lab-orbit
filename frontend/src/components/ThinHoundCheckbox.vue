<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: [Boolean, Array],
    default: undefined
  },
  value: {
    type: [String, Number, Boolean, Object],
    default: undefined
  },
  checked: {
    type: Boolean,
    default: undefined
  },
  disabled: {
    type: Boolean,
    default: false
  },
  id: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  labelPosition: {
    type: String,
    default: 'after', // 'before' | 'after'
    validator: v => ['before', 'after'].includes(v)
  },
  size: {
    type: [Number, String],
    default: 26
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const getPropChecked = () => {
  if (Array.isArray(props.modelValue)) {
    return props.value !== undefined ? props.modelValue.includes(props.value) : false
  }
  if (props.modelValue !== undefined) return Boolean(props.modelValue)
  if (props.checked !== undefined) return Boolean(props.checked)
  return false
}

// Internal optimistic state ensures smooth animation even during parent async work
const innerChecked = ref(getPropChecked())

watch(
  () => [props.modelValue, props.checked, props.value],
  () => {
    innerChecked.value = getPropChecked()
  },
  { deep: true }
)

const isChecked = computed(() => innerChecked.value)

const handleChange = (e) => {
  if (props.disabled) return
  const val = e.target.checked
  innerChecked.value = val

  if (Array.isArray(props.modelValue)) {
    let nextArr = [...props.modelValue]
    if (val) {
      if (props.value !== undefined && !nextArr.includes(props.value)) {
        nextArr.push(props.value)
      }
    } else {
      nextArr = nextArr.filter(item => item !== props.value)
    }
    emit('update:modelValue', nextArr)
  } else {
    emit('update:modelValue', val)
  }
  emit('change', e)
}
</script>

<template>
  <label 
    class="thin-hound-wrapper" 
    :class="{ 
      'is-disabled': disabled, 
      'is-checked': isChecked, 
      [`label-${labelPosition}`]: true 
    }"
    :title="title"
  >
    <span v-if="labelPosition === 'before' && ($slots.default || label)" class="label-text">
      <slot>{{ label }}</slot>
    </span>

    <div class="checkbox-box" :style="{ width: size + 'px', height: size + 'px' }">
      <!-- Native input covers the box completely (z-index: 5) to capture clicks with 100% reliability -->
      <input
        :id="id || undefined"
        type="checkbox"
        class="check-input"
        :name="name || undefined"
        :checked="isChecked"
        :disabled="disabled"
        @change="handleChange"
      />

      <!-- Visual SVG with thin-hound-49 hand-drawn path, pointer-events: none so clicks land on input -->
      <svg 
        :width="size" 
        :height="size" 
        viewBox="0 0 95 95" 
        class="checkbox-svg" 
        aria-hidden="true"
      >
        <rect 
          x="30" 
          y="20" 
          width="50" 
          height="50" 
          rx="8" 
          class="box-rect"
        />
        <g transform="translate(0,-952.36222)">
          <path
            d="m 56,963 c -102,122 6,9 7,9 17,-5 -66,69 -38,52 122,-77 -7,14 18,4 29,-11 45,-43 23,-4"
            class="path1"
          />
        </g>
      </svg>
    </div>

    <span v-if="labelPosition === 'after' && ($slots.default || label)" class="label-text">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<style scoped>
.thin-hound-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  vertical-align: middle;
  cursor: pointer;
  line-height: 1.2;
}

.thin-hound-wrapper *,
.thin-hound-wrapper *::after,
.thin-hound-wrapper *::before {
  box-sizing: border-box;
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
}

.thin-hound-wrapper::selection,
.thin-hound-wrapper *::selection {
  background: transparent !important;
  color: inherit !important;
}

.thin-hound-wrapper.is-disabled,
.thin-hound-wrapper.is-disabled * {
  cursor: not-allowed !important;
}

.thin-hound-wrapper.is-disabled {
  opacity: 0.65;
}

.label-text {
  font-size: inherit;
  color: var(--soft, #cbd5e1);
  white-space: normal;
  word-break: break-word;
  line-height: inherit;
  transition: color 0.2s ease;
  user-select: none !important;
  -webkit-user-select: none !important;
}

.thin-hound-wrapper:hover:not(.is-disabled) .label-text {
  color: var(--text, #fff);
}

/* Box container wrapping input and SVG */
.checkbox-box {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
  border-radius: 6px;
  transition: filter 0.2s ease;
  user-select: none !important;
  -webkit-user-select: none !important;
}

/* Real native checkbox positioned exactly over the visual box to capture user clicks */
.check-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 5;
  user-select: none !important;
  -webkit-user-select: none !important;
}

.check-input::selection {
  background: transparent !important;
  color: inherit !important;
}

.is-disabled .check-input {
  cursor: not-allowed !important;
  pointer-events: none;
}

/* SVG is strictly visual, clicks pass directly to the .check-input overlay */
.checkbox-svg {
  display: block;
  overflow: visible;
  pointer-events: none;
}

/* Outer square box */
.box-rect {
  fill: var(--surface, rgba(255, 255, 255, 0.04));
  stroke: var(--line, rgba(255, 255, 255, 0.22));
  stroke-width: 5;
  transition: stroke 0.2s ease, fill 0.2s ease;
  transform: translateZ(0);
}

/* Hover state on box */
.thin-hound-wrapper:hover:not(.is-disabled) .box-rect {
  stroke: var(--accent, #b89bf8);
}

.thin-hound-wrapper:hover:not(.is-disabled) .checkbox-box {
  filter: drop-shadow(0 0 3px rgba(184, 155, 248, 0.35));
}

[data-theme-style="vanta-fog"] .thin-hound-wrapper:hover:not(.is-disabled) .box-rect {
  stroke: var(--accent, #c5e6df);
}

[data-theme-style="vanta-fog"] .thin-hound-wrapper:hover:not(.is-disabled) .checkbox-box {
  filter: drop-shadow(0 0 3px rgba(197, 230, 223, 0.35));
}

/* Focus-visible on real checkbox outlines the box */
.check-input:focus-visible + .checkbox-svg .box-rect {
  stroke: var(--accent, #b89bf8);
}

.checkbox-box:focus-within {
  filter: drop-shadow(0 0 4px var(--accent, #b89bf8));
}

.thin-hound-wrapper:has(.check-input:focus-visible) .checkbox-box {
  filter: drop-shadow(0 0 4px var(--accent, #b89bf8));
}

[data-theme-style="vanta-fog"] .check-input:focus-visible + .checkbox-svg .box-rect {
  stroke: var(--accent, #c5e6df);
}

[data-theme-style="vanta-fog"] .checkbox-box:focus-within {
  filter: drop-shadow(0 0 4px var(--accent, #c5e6df));
}

[data-theme-style="vanta-fog"] .thin-hound-wrapper:has(.check-input:focus-visible) .checkbox-box {
  filter: drop-shadow(0 0 4px var(--accent, #c5e6df));
}

/* When checked: box border matches accent */
.check-input:checked + .checkbox-svg .box-rect,
.thin-hound-wrapper.is-checked .box-rect {
  stroke: var(--accent, #b89bf8);
  fill: rgba(184, 155, 248, 0.08);
}

[data-theme-style="vanta-fog"] .check-input:checked + .checkbox-svg .box-rect,
[data-theme-style="vanta-fog"] .thin-hound-wrapper.is-checked .box-rect {
  stroke: var(--accent, #c5e6df);
  fill: rgba(197, 230, 223, 0.08);
}

/* Animated hand-drawn checkmark (PriyanshuGupta28 / thin-hound-49) */
.path1 {
  fill: none;
  stroke: var(--accent, #b89bf8);
  stroke-width: 5.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 403;
  stroke-dashoffset: 403;
  transition: stroke-dashoffset 0.45s ease-out, opacity 0.22s ease;
  opacity: 0;
  will-change: stroke-dashoffset, opacity;
  transform: translateZ(0);
}

[data-theme-style="vanta-fog"] .path1 {
  stroke: var(--accent, #c5e6df);
}

.check-input:checked + .checkbox-svg .path1,
.thin-hound-wrapper.is-checked .path1 {
  stroke-dashoffset: 0;
  opacity: 1;
  transition: stroke-dashoffset 0.62s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease;
}
</style>
