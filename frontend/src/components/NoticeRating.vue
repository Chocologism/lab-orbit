<template>
  <div class="notice-rating-wrap" :class="{ 'is-compact': size === 'small' }" @click.stop>
    <div class="rating">
      <div class="rating-form">
        <!-- Super happy -->
        <button
          type="button"
          class="rating-btn super-happy"
          :class="{ active: currentRating === 'super-happy', 'has-count': (counts['super-happy'] || 0) > 0 }"
          :disabled="isSubmitting"
          title="满意 / 点赞"
          @click="submitRating('super-happy')"
        >
          <svg class="svg" viewBox="0 0 24 24">
            <path d="M12,17.5C14.33,17.5 16.3,16.04 17.11,14H6.89C7.69,16.04 9.67,17.5 12,17.5M8.5,11A1.5,1.5 0 0,0 10,9.5A1.5,1.5 0 0,0 8.5,8A1.5,1.5 0 0,0 7,9.5A1.5,1.5 0 0,0 8.5,11M15.5,11A1.5,1.5 0 0,0 17,9.5A1.5,1.5 0 0,0 15.5,8A1.5,1.5 0 0,0 14,9.5A1.5,1.5 0 0,0 15.5,11M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
          </svg>
          <span class="count-pill">{{ counts['super-happy'] || 0 }}</span>
        </button>

        <!-- Neutral -->
        <button
          type="button"
          class="rating-btn neutral"
          :class="{ active: currentRating === 'neutral', 'has-count': (counts['neutral'] || 0) > 0 }"
          :disabled="isSubmitting"
          title="中立 / 已知悉"
          @click="submitRating('neutral')"
        >
          <svg class="svg" viewBox="0 0 24 24">
            <path d="M8.5,11A1.5,1.5 0 0,1 7,9.5A1.5,1.5 0 0,1 8.5,8A1.5,1.5 0 0,1 10,9.5A1.5,1.5 0 0,1 8.5,11M15.5,11A1.5,1.5 0 0,1 14,9.5A1.5,1.5 0 0,1 15.5,8A1.5,1.5 0 0,1 17,9.5A1.5,1.5 0 0,1 15.5,11M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M9,14H15A1,1 0 0,1 16,15A1,1 0 0,1 15,16H9A1,1 0 0,1 8,15A1,1 0 0,1 9,14Z" />
          </svg>
          <span class="count-pill">{{ counts['neutral'] || 0 }}</span>
        </button>

        <!-- Super sad -->
        <button
          type="button"
          class="rating-btn super-sad"
          :class="{ active: currentRating === 'super-sad', 'has-count': (counts['super-sad'] || 0) > 0 }"
          :disabled="isSubmitting"
          title="不满 / 困扰"
          @click="submitRating('super-sad')"
        >
          <svg class="svg" viewBox="0 0 24 24">
            <path d="M12,2C6.47,2 2,6.47 2,12C2,17.53 6.47,22 12,22A10,10 0 0,0 22,12C22,6.47 17.5,2 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M16.18,7.76L15.12,8.82L14.06,7.76L13,8.82L14.06,9.88L13,10.94L14.06,12L15.12,10.94L16.18,12L17.24,10.94L16.18,9.88L17.24,8.82L16.18,7.76M7.82,12L8.88,10.94L9.94,12L11,10.94L9.94,9.88L11,8.82L9.94,7.76L8.88,8.82L7.82,7.76L6.76,8.82L7.82,9.88L6.76,10.94L7.82,12M12,14C9.67,14 7.69,15.46 6.89,17.5H17.11C16.31,15.46 14.33,14 12,14Z" />
          </svg>
          <span class="count-pill">{{ counts['super-sad'] || 0 }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { noticeApi } from '../api/client'

const props = defineProps({
  noticeId: {
    type: [Number, String],
    required: true
  },
  ratingsCount: {
    type: Object,
    default: () => ({ 'super-happy': 0, 'neutral': 0, 'super-sad': 0 })
  },
  myRating: {
    type: String,
    default: null
  },
  size: {
    type: String,
    default: 'normal'
  }
})

const emit = defineEmits(['update'])

const isSubmitting = ref(false)
const currentRating = ref(props.myRating || null)
const counts = ref({
  'super-happy': props.ratingsCount?.['super-happy'] || 0,
  'neutral': props.ratingsCount?.['neutral'] || 0,
  'super-sad': props.ratingsCount?.['super-sad'] || 0
})

watch(
  () => props.myRating,
  (val) => {
    currentRating.value = val || null
  }
)

watch(
  () => props.ratingsCount,
  (val) => {
    if (val) {
      counts.value = {
        'super-happy': val['super-happy'] || 0,
        'neutral': val['neutral'] || 0,
        'super-sad': val['super-sad'] || 0
      }
    }
  },
  { deep: true }
)

async function submitRating(type) {
  if (isSubmitting.value) return
  isSubmitting.value = true

  // Optimistic UI state
  const prevRating = currentRating.value
  const prevCounts = { ...counts.value }

  if (prevRating === type) {
    // Toggle off
    currentRating.value = null
    counts.value[type] = Math.max(0, (counts.value[type] || 0) - 1)
  } else {
    // Switch or new vote
    if (prevRating && counts.value[prevRating]) {
      counts.value[prevRating] = Math.max(0, counts.value[prevRating] - 1)
    }
    currentRating.value = type
    counts.value[type] = (counts.value[type] || 0) + 1
  }

  try {
    const res = await noticeApi.rate(props.noticeId, type)
    const payload = res?.data || res
    if (payload && payload.ratings_count) {
      currentRating.value = payload.my_rating ?? null
      counts.value = {
        'super-happy': payload.ratings_count['super-happy'] || 0,
        'neutral': payload.ratings_count['neutral'] || 0,
        'super-sad': payload.ratings_count['super-sad'] || 0
      }
      emit('update', {
        noticeId: props.noticeId,
        myRating: currentRating.value,
        ratingsCount: { ...counts.value }
      })
    }
  } catch (err) {
    // Rollback on failure
    currentRating.value = prevRating
    counts.value = prevCounts
    console.error('Failed to submit notice rating:', err)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.notice-rating-wrap {
  display: inline-flex;
  align-items: center;
  user-select: none;
  line-height: 1;
}

.rating {
  background-color: rgba(0, 0, 16, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 2.5px 5px;
  border-radius: 9999px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
  transition: all 0.25s ease;
  display: inline-flex;
  align-items: center;
}

.rating:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background-color: rgba(0, 0, 16, 0.85);
}

.rating-form {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.rating-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: transparent;
  border: none;
  border-radius: 9999px;
  padding: 2.5px 6px;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  color: var(--muted, #94a3b8);
  flex-shrink: 0;
  box-sizing: border-box;
}

.svg {
  fill: #94a3b8;
  height: 16px;
  width: 16px;
  flex-shrink: 0;
  transform-origin: center center;
  transition: fill 0.25s ease, transform 0.2s cubic-bezier(0.34, 1.3, 0.64, 1);
}

.count-pill {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  min-width: 6px;
  text-align: center;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  transition: color 0.25s ease;
  flex-shrink: 0;
}

.rating-btn:hover .svg {
  transform: scale(1.1);
}

.rating-btn:hover .count-pill,
.rating-btn.has-count .count-pill {
  color: #cbd5e1;
}

/* Super Happy State (Green) */
.super-happy:hover .svg,
.super-happy.active .svg {
  fill: rgb(0, 204, 79);
}
.super-happy.active {
  background: rgba(0, 204, 79, 0.14);
  box-shadow: inset 0 0 0 1px rgba(0, 204, 79, 0.22);
}
.super-happy.active .count-pill {
  color: rgb(0, 204, 79);
  font-weight: 700;
}

/* Neutral State (Yellow) */
.neutral:hover .svg,
.neutral.active .svg {
  fill: rgb(232, 214, 0);
}
.neutral.active {
  background: rgba(232, 214, 0, 0.14);
  box-shadow: inset 0 0 0 1px rgba(232, 214, 0, 0.22);
}
.neutral.active .count-pill {
  color: rgb(232, 214, 0);
  font-weight: 700;
}

/* Super Sad State (Red) */
.super-sad:hover .svg,
.super-sad.active .svg {
  fill: rgb(239, 42, 16);
}
.super-sad.active {
  background: rgba(239, 42, 16, 0.14);
  box-shadow: inset 0 0 0 1px rgba(239, 42, 16, 0.22);
}
.super-sad.active .count-pill {
  color: rgb(239, 42, 16);
  font-weight: 700;
}

/* Compact Mode (used in card meta rows) */
.notice-rating-wrap.is-compact .rating {
  padding: 2px 4px;
}
.notice-rating-wrap.is-compact .rating-form {
  gap: 2px;
}
.notice-rating-wrap.is-compact .rating-btn {
  padding: 2px 5px;
  gap: 2.5px;
}
.notice-rating-wrap.is-compact .svg {
  height: 14px;
  width: 14px;
}
.notice-rating-wrap.is-compact .count-pill {
  font-size: 10px;
}
.notice-rating-wrap.is-compact .rating-btn:hover .svg {
  transform: scale(1.08);
}
</style>
