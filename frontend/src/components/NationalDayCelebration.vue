<script setup>
import { computed } from 'vue'
import { isNationalDayHoliday } from '../utils/nationalDay'

const isNationalDay = computed(() => isNationalDayHoliday())

const defaultFlagPath = '/assets/icons/national-flag.svg'
const basePrefix = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
const flagIconUrl = basePrefix !== '/'
  ? `${basePrefix.replace(/\/$/, '')}/assets/icons/national-flag.svg`
  : defaultFlagPath

// 气球矢量路径数据
const BALLOON_SVG_PATH =
  'M963.2 502.6c0-171-117-310.2-260.8-310.2-34.4 0-67.2 8-97.2 22.4C556.8 88.4 449.6 0 325.4 0 155.8 0 18 164.2 18 366c0 173.6 102 319.2 238.4 356.6L231 800.4h68.8l-8.6 34.4c-5.4 21.4 0 43.8 14.6 60 6.2 7 7.4 17.2 2.8 25.4l-39.4 72c-5.6 10.2-2 23.2 8 29 3.2 1.8 6.8 2.8 10.2 2.8 7.2 0 14.2-4 18-10.8l39.4-72c13.4-24.4 10-54.8-8.6-75.4-5-5.4-6.8-13-5-20.2l11.4-45h77.2l-25.6-77.8c33.2-9.2 64.4-24.6 92.6-45.4C525.6 744.8 586 793.2 656.2 808l-11.8 36h40l-2.2 8.8c-4.4 17 0 35 11.6 47.8 2.6 2.8 3 7 1.2 10.2L667.6 961c-5.6 10.2-2 23.2 8 29 3.2 1.8 6.8 2.8 10.2 2.8 7.2 0 14.2-4 18-10.8l27.4-50.2c10.6-19.6 8-43.6-6.8-60.2-2-2.2-2.8-5.2-2-8.2l5-19.6h30.2L746 808.4C869 783.8 963.2 656 963.2 502.6zM288.6 757.8l8-24.6H354l8 24.6h-73.4zM468 638.6c-41.2 32-90.2 50.8-142.6 50.8-146.6 0-265.8-145-265.8-323.4S178.8 42.6 325.4 42.6c108.6 0 202.4 79.8 243.4 193.8 5 14 9.2 28.4 12.6 43.4 6.2 27.4 9.6 56.4 9.6 86.4 0 96.4-35 183.2-90.2 242.4-10.2 11-21.2 21-32.8 30z m234.4 131.6c-76.4 0-143.8-48-183-120.4 69.2-67.2 113.4-169.4 113.4-283.6 0-38.4-5-75.6-14.4-110.4 26-13.2 54.2-20.4 84-20.4 121 0 219.4 120 219.4 267.4 0 147.4-98.4 267.4-219.4 267.4zM301.2 129.4c4.8 10.6 0.4 23.4-10 28.4-65.8 31.6-114 94.2-128.4 167.6-2 10.2-10.6 17-20.2 17-1.4 0-2.8-0.2-4.2-0.4-11.2-2.4-18.4-13.6-16.2-25.2 17.2-86.4 73.8-160.4 151.6-197.6 10.2-5 22.4-0.4 27.4 10.2zM842.4 612c-10.8 42.2-41 77-80.4 93.2-2.6 1-5.2 1.6-7.6 1.6-8.2 0-16-5-19.2-13.4-4.2-11 1-23.4 11.6-27.8 27.4-11.2 48.2-35.2 55.6-64.4 3-11.4 14.4-18.2 25.4-15.2 11 2.8 17.6 14.6 14.6 26z'

// 稀疏分布的 9 面红旗，自上而下飘落，带有绸缎迎风轻摆动效与负延迟（首屏即刻分布）
const flags = [
  { id: 1, left: 6, size: 36, fallDuration: 22, swayDuration: 5.2, delay: -4, swayDelay: -1.2, opacity: 0.78, swayRange: 22 },
  { id: 2, left: 17, size: 28, fallDuration: 27, swayDuration: 6.2, delay: -16, swayDelay: -2.6, opacity: 0.62, swayRange: 16 },
  { id: 3, left: 29, size: 42, fallDuration: 20, swayDuration: 4.8, delay: -9, swayDelay: -0.8, opacity: 0.85, swayRange: 26 },
  { id: 4, left: 41, size: 32, fallDuration: 25, swayDuration: 5.6, delay: -21, swayDelay: -3.4, opacity: 0.68, swayRange: 20 },
  { id: 5, left: 53, size: 38, fallDuration: 21, swayDuration: 5.0, delay: -7, swayDelay: -1.8, opacity: 0.80, swayRange: 24 },
  { id: 6, left: 65, size: 30, fallDuration: 28, swayDuration: 6.4, delay: -18, swayDelay: -3.8, opacity: 0.65, swayRange: 18 },
  { id: 7, left: 76, size: 44, fallDuration: 19, swayDuration: 4.6, delay: -12, swayDelay: -0.9, opacity: 0.88, swayRange: 28 },
  { id: 8, left: 87, size: 34, fallDuration: 24, swayDuration: 5.4, delay: -3, swayDelay: -2.2, opacity: 0.72, swayRange: 22 },
  { id: 9, left: 95, size: 29, fallDuration: 26, swayDuration: 5.8, delay: -14, swayDelay: -2.9, opacity: 0.64, swayRange: 19 }
]

// 稀疏分布的 10 组欢庆气球，自下而上缓缓升空，带有氦气球轻盈浮动微摇与丰富喜庆配色
const balloons = [
  { id: 1, left: 11, size: 36, riseDuration: 21, swayDuration: 4.9, delay: -6, swayDelay: -1.4, opacity: 0.78, color: '#ef4444', glow: 'rgba(239, 68, 68, 0.45)', swayRange: 18 },
  { id: 2, left: 23, size: 30, riseDuration: 26, swayDuration: 5.8, delay: -17, swayDelay: -3.1, opacity: 0.65, color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.45)', swayRange: 14 },
  { id: 3, left: 35, size: 42, riseDuration: 19, swayDuration: 4.5, delay: -10, swayDelay: -0.7, opacity: 0.82, color: '#f43f5e', glow: 'rgba(244, 63, 94, 0.45)', swayRange: 22 },
  { id: 4, left: 47, size: 32, riseDuration: 24, swayDuration: 5.4, delay: -22, swayDelay: -2.8, opacity: 0.68, color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)', swayRange: 16 },
  { id: 5, left: 59, size: 38, riseDuration: 20, swayDuration: 4.7, delay: -4, swayDelay: -1.9, opacity: 0.80, color: '#fb923c', glow: 'rgba(251, 146, 60, 0.45)', swayRange: 20 },
  { id: 6, left: 71, size: 34, riseDuration: 25, swayDuration: 5.7, delay: -14, swayDelay: -3.5, opacity: 0.70, color: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)', swayRange: 17 },
  { id: 7, left: 81, size: 40, riseDuration: 18, swayDuration: 4.4, delay: -8, swayDelay: -1.1, opacity: 0.85, color: '#eab308', glow: 'rgba(234, 179, 8, 0.45)', swayRange: 21 },
  { id: 8, left: 91, size: 28, riseDuration: 27, swayDuration: 6.1, delay: -20, swayDelay: -4.0, opacity: 0.62, color: '#34d399', glow: 'rgba(52, 211, 153, 0.4)', swayRange: 15 },
  { id: 9, left: 3, size: 35, riseDuration: 22, swayDuration: 5.1, delay: -12, swayDelay: -2.3, opacity: 0.72, color: '#dc2626', glow: 'rgba(220, 38, 38, 0.45)', swayRange: 18 },
  { id: 10, left: 97, size: 31, riseDuration: 23, swayDuration: 5.3, delay: -15, swayDelay: -2.7, opacity: 0.66, color: '#fb7185', glow: 'rgba(251, 113, 133, 0.45)', swayRange: 16 }
]
</script>

<template>
  <div v-if="isNationalDay" class="national-day-celebration-container" aria-hidden="true">
    <!-- 1. 红旗自上而下飘落 -->
    <div
      v-for="flag in flags"
      :key="`flag-${flag.id}`"
      class="national-flag-fall-track"
      :style="{
        left: `${flag.left}vw`,
        animationDuration: `${flag.fallDuration}s`,
        animationDelay: `${flag.delay}s`
      }"
    >
      <div
        class="national-flag-sway"
        :style="{
          animationDuration: `${flag.swayDuration}s`,
          animationDelay: `${flag.swayDelay}s`,
          '--sway-x': `${flag.swayRange}px`
        }"
      >
        <img
          :src="flagIconUrl"
          alt=""
          class="national-flag-img"
          draggable="false"
          :style="{
            width: `${flag.size}px`,
            height: `${flag.size}px`,
            opacity: flag.opacity
          }"
        />
      </div>
    </div>

    <!-- 2. 欢庆气球自下而上缓缓升空 -->
    <div
      v-for="balloon in balloons"
      :key="`balloon-${balloon.id}`"
      class="celebration-balloon-rise-track"
      :style="{
        left: `${balloon.left}vw`,
        animationDuration: `${balloon.riseDuration}s`,
        animationDelay: `${balloon.delay}s`
      }"
    >
      <div
        class="celebration-balloon-sway"
        :style="{
          animationDuration: `${balloon.swayDuration}s`,
          animationDelay: `${balloon.swayDelay}s`,
          '--sway-x': `${balloon.swayRange}px`
        }"
      >
        <svg
          viewBox="0 0 1024 1024"
          class="celebration-balloon-svg"
          draggable="false"
          aria-hidden="true"
          :style="{
            width: `${balloon.size}px`,
            height: `${balloon.size}px`,
            color: balloon.color,
            filter: `drop-shadow(0 4px 12px ${balloon.glow})`,
            opacity: balloon.opacity
          }"
        >
          <path :d="BALLOON_SVG_PATH" fill="currentColor" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
.national-day-celebration-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  user-select: none;
  z-index: 99;
  overflow: hidden;
}

/* 红旗飘落轨道与摆动 */
.national-flag-fall-track {
  position: absolute;
  top: -80px;
  animation-name: national-flag-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}

.national-flag-sway {
  animation-name: national-flag-sway-motion;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  will-change: transform;
}

.national-flag-img {
  display: block;
  user-select: none;
  pointer-events: none;
  filter: drop-shadow(0 4px 12px rgba(222, 41, 16, 0.45));
}

@keyframes national-flag-fall {
  0% {
    transform: translateY(-80px);
  }
  100% {
    transform: translateY(calc(100vh + 100px));
  }
}

@keyframes national-flag-sway-motion {
  0% {
    transform: translateX(calc(-1 * var(--sway-x, 22px))) rotate(-12deg);
  }
  100% {
    transform: translateX(var(--sway-x, 22px)) rotate(14deg);
  }
}

/* 气球升空轨道与轻盈微摇 */
.celebration-balloon-rise-track {
  position: absolute;
  bottom: -80px;
  animation-name: celebration-balloon-rise;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}

.celebration-balloon-sway {
  animation-name: celebration-balloon-sway-motion;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  will-change: transform;
}

.celebration-balloon-svg {
  display: block;
  user-select: none;
  pointer-events: none;
}

@keyframes celebration-balloon-rise {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(calc(-100vh - 160px));
  }
}

@keyframes celebration-balloon-sway-motion {
  0% {
    transform: translateX(calc(-1 * var(--sway-x, 18px))) rotate(-8deg);
  }
  100% {
    transform: translateX(var(--sway-x, 18px)) rotate(9deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .national-day-celebration-container {
    display: none;
  }
}
</style>
