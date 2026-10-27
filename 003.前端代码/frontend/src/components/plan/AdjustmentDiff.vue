<script setup>
import Icon from '../ui/Icon.vue'
import { REASON_CODES } from '../../domain/engine/adjustEngine.js'

/** 变更 diff（PRD §E3） */
defineProps({
  items: { type: Array, required: true },
})
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(item, i) in items"
      :key="i"
      class="bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden"
    >
      <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-surface-container">
        <span class="font-headline-sm text-[15px] text-on-surface font-bold truncate">{{ item.label }}</span>
        <span
          class="px-2 py-0.5 rounded-full font-label-caps text-label-caps shrink-0"
          :class="{
            'bg-error-container text-on-error-container': REASON_CODES[item.reasonCode]?.tone === 'danger',
            'bg-primary-fixed text-primary': REASON_CODES[item.reasonCode]?.tone === 'warn',
            'bg-success-container text-on-success-container': REASON_CODES[item.reasonCode]?.tone === 'good',
            'bg-surface-container text-on-surface-variant': REASON_CODES[item.reasonCode]?.tone === 'info',
          }"
        >
          {{ REASON_CODES[item.reasonCode]?.label || item.reasonCode }}
        </span>
      </div>
      <div class="p-3 space-y-2">
        <div class="flex items-center gap-2 text-body-sm">
          <span class="text-on-surface-variant w-12 shrink-0">原来</span>
          <span class="flex-1 px-2 py-1 rounded bg-surface-container-low text-on-surface-variant line-through decoration-error/50">
            {{ item.beforeText }}
          </span>
        </div>
        <div class="flex items-center gap-2 text-body-sm">
          <span class="text-on-surface-variant w-12 shrink-0">改成</span>
          <span class="flex-1 px-2 py-1 rounded bg-success-container/50 text-on-surface font-semibold">
            {{ item.afterText }}
          </span>
        </div>
        <p class="flex items-start gap-1.5 pt-1 text-body-sm text-on-surface-variant leading-relaxed">
          <Icon name="info" :size="14" class="mt-0.5 shrink-0 text-primary" />
          <span>{{ item.reasonText }}</span>
        </p>
      </div>
    </div>
  </div>
</template>
