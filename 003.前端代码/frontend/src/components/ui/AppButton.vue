<script setup>
import Icon from './Icon.vue'

/** 主按钮 / 次按钮 / 危险按钮 —— PRD §3.3.4 */
defineProps({
  variant: { type: String, default: 'primary' }, // primary | secondary | ghost | danger
  icon: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: true },
  size: { type: String, default: 'md' }, // sm | md | lg
})
</script>

<template>
  <button
    class="btn"
    :class="[
      variant === 'primary' && 'btn-primary',
      variant === 'secondary' && 'btn-secondary',
      variant === 'ghost' && 'btn-ghost',
      variant === 'danger' && 'btn-danger',
      size === 'sm' && 'py-2 px-3 text-body-sm',
      size === 'lg' && 'py-3.5 text-headline-sm',
      block && 'w-full',
    ]"
    :disabled="disabled"
    type="button"
  >
    <Icon v-if="icon" :name="icon" :size="18" />
    <span><slot /></span>
    <Icon v-if="$slots.trailing" name="arrow_forward" :size="18" />
  </button>
</template>
