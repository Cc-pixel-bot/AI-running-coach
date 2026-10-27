<script setup>
import { useUiStore } from '../../stores/ui.js'
import Icon from './Icon.vue'

const ui = useUiStore()

const ICONS = { info: 'info', success: 'check_circle', warn: 'warning', error: 'error' }
</script>

<template>
  <div class="fixed top-16 inset-x-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-gutter">
    <transition-group name="toast">
      <div
        v-for="t in ui.toasts"
        :key="t.id"
        class="max-w-[90vw] px-4 py-2.5 rounded-xl shadow-lg bg-inverse-surface text-inverse-on-surface text-body-sm flex items-center gap-2"
      >
        <Icon :name="ICONS[t.type] || 'info'" :size="18" :class="t.type === 'error' ? 'text-error' : 'text-primary-fixed'" />
        <span>{{ t.text }}</span>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.24s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
