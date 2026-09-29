<script setup>
defineProps({
  size: {
    type: [Number, String],
    default: 20
  }
})
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    :width="size"
    :height="size"
    fill="none"
    aria-hidden="true"
    class="app-icon icon-feed-paper icon-stroke"
  >
    <g stroke="currentColor" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <rect x="10" y="4" width="44" height="56" rx="5" fill="none" />
      <path d="M32 13C24.27 13 18 17.25 18 22.5C18 25.77 20.44 28.66 24.18 30.37L22.5 35L30.25 31.93C30.82 31.98 31.41 32 32 32C39.73 32 46 27.75 46 22.5C46 17.25 39.73 13 32 13Z" fill="none" />
      <path d="M27 20H37M27 25.5H34" stroke-width="3" fill="none" />
      <path d="M21 43H43M21 50H37" fill="none" />
    </g>
  </svg>
</template>

<style scoped>
.icon-feed-paper,
.icon-feed-paper * {
  fill: none !important;
  stroke: currentColor;
}
</style>
