<script setup>
import { computed } from 'vue'
import { isMidAutumnFestival } from '../utils/midAutumn'

const isMidAutumn = computed(() => isMidAutumnFestival())

// 稀疏分布的 11 枚月饼，具有差异化的水平位置、尺寸、透明度、下落周期与左右轻摆
const mooncakes = [
  { id: 1, left: 6, size: 34, fallDuration: 22, swayDuration: 5.2, delay: -4, swayDelay: -1.2, opacity: 0.72, swayRange: 22 },
  { id: 2, left: 15, size: 26, fallDuration: 28, swayDuration: 6.4, delay: -16, swayDelay: -2.8, opacity: 0.52, swayRange: 16 },
  { id: 3, left: 24, size: 42, fallDuration: 19, swayDuration: 4.8, delay: -9, swayDelay: -0.6, opacity: 0.82, swayRange: 28 },
  { id: 4, left: 33, size: 30, fallDuration: 25, swayDuration: 5.8, delay: -21, swayDelay: -3.5, opacity: 0.60, swayRange: 20 },
  { id: 5, left: 43, size: 38, fallDuration: 21, swayDuration: 5.0, delay: -7, swayDelay: -1.8, opacity: 0.76, swayRange: 24 },
  { id: 6, left: 52, size: 28, fallDuration: 29, swayDuration: 6.6, delay: -18, swayDelay: -4.1, opacity: 0.55, swayRange: 18 },
  { id: 7, left: 61, size: 44, fallDuration: 18, swayDuration: 4.6, delay: -12, swayDelay: -0.9, opacity: 0.85, swayRange: 30 },
  { id: 8, left: 70, size: 32, fallDuration: 24, swayDuration: 5.5, delay: -3, swayDelay: -2.3, opacity: 0.68, swayRange: 22 },
  { id: 9, left: 79, size: 27, fallDuration: 27, swayDuration: 6.2, delay: -23, swayDelay: -3.8, opacity: 0.50, swayRange: 16 },
  { id: 10, left: 88, size: 40, fallDuration: 20, swayDuration: 4.9, delay: -14, swayDelay: -1.5, opacity: 0.78, swayRange: 26 },
  { id: 11, left: 95, size: 31, fallDuration: 26, swayDuration: 5.7, delay: -8, swayDelay: -2.7, opacity: 0.62, swayRange: 19 }
]
</script>

<template>
  <div v-if="isMidAutumn" class="mid-autumn-mooncakes-container" aria-hidden="true">
    <div
      v-for="cake in mooncakes"
      :key="cake.id"
      class="mooncake-fall-track"
      :style="{
        left: `${cake.left}vw`,
        animationDuration: `${cake.fallDuration}s`,
        animationDelay: `${cake.delay}s`
      }"
    >
      <div
        class="mooncake-sway"
        :style="{
          animationDuration: `${cake.swayDuration}s`,
          animationDelay: `${cake.swayDelay}s`,
          '--sway-x': `${cake.swayRange}px`
        }"
      >
        <img
          src="/assets/icons/mooncake.svg"
          alt=""
          class="mooncake-img"
          draggable="false"
          :style="{
            width: `${cake.size}px`,
            height: `${cake.size}px`,
            opacity: cake.opacity
          }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mid-autumn-mooncakes-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  user-select: none;
  z-index: 99;
  overflow: hidden;
}

.mooncake-fall-track {
  position: absolute;
  top: -80px;
  animation-name: mooncake-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}

.mooncake-sway {
  animation-name: mooncake-sway-motion;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  will-change: transform;
}

.mooncake-img {
  display: block;
  user-select: none;
  pointer-events: none;
  filter: drop-shadow(0 4px 10px rgba(180, 110, 30, 0.35));
}

@keyframes mooncake-fall {
  0% {
    transform: translateY(-80px);
  }
  100% {
    transform: translateY(calc(100vh + 100px));
  }
}

@keyframes mooncake-sway-motion {
  0% {
    transform: translateX(calc(-1 * var(--sway-x, 20px))) rotate(-14deg);
  }
  100% {
    transform: translateX(var(--sway-x, 20px)) rotate(16deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mid-autumn-mooncakes-container {
    display: none;
  }
}
</style>
