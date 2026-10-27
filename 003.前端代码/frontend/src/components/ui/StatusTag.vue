<script setup>
import Icon from './Icon.vue'

/**
 * 状态标签 —— PRD §3.3.4：同时包含颜色、图标和文字（不只依赖颜色）。
 * tone: good | warn | danger | info | muted | brand
 */
defineProps({
  tone: { type: String, default: 'muted' },
  icon: { type: String, default: '' },
  pulse: { type: Boolean, default: false },
})

const TONE_CLASS = {
  good: 'bg-success-container text-on-success-container',
  warn: 'bg-primary-fixed text-primary',
  danger: 'bg-error-container text-on-error-container',
  info: 'bg-info-container text-info',
  brand: 'bg-primary-container text-on-primary',
  muted: 'bg-surface-container text-on-surface-variant',
}
</script>

<template>
  <span class="status-tag tag" :class="TONE_CLASS[tone]">
    <Icon v-if="icon" :name="icon" :size="12" :filled="tone === 'brand'" />
    <span
      v-if="pulse"
      class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"
    />
    <slot />
  </span>
</template>
