<script setup>
import { computed } from 'vue'

/** Material Symbols 图标封装 */
const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
  filled: { type: Boolean, default: false },
})

const style = computed(() => {
  const size = typeof props.size === 'number' ? `${props.size}px` : props.size
  return {
    fontSize: size,
    fontVariationSettings: props.filled ? "'FILL' 1" : undefined,
  }
})
</script>

<template>
  <span
    class="material-symbols-outlined inline-flex items-center justify-center leading-none shrink-0"
    :style="style"
    >{{ name }}</span
  >
</template>
