<script setup>
import Icon from '../ui/Icon.vue'

const reasonLabels = {
  PAIN_RECOVERY: '疼痛反馈',
  PAIN_RECOVERY: '疼痛恢复',
  FATIGUE_REDUCE: '疲劳反馈',
  INCOMPLETE_RECOVERY: '完成度反馈',
  LOAD_CONTROL: '负荷控制',
  SCHEDULE_ADAPT: '训练安排',
}

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
            'bg-primary-fixed text-primary': Boolean(item.reasonCode),
          }"
        >
          {{ reasonLabels[item.reasonCode] || 'AI 调整建议' }}
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
