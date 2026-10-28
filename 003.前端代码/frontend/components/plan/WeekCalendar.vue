<script setup>
import { computed } from 'vue'

/** 周期周历（PRD §B3 第 2 项：按模板周期长度的格子，标注各周类型） */
const props = defineProps({
  weeks: { type: Array, required: true },
  currentWeek: { type: Number, default: 1 },
})

const TONE = {
  base: 'bg-surface-container text-on-surface-variant',
  build: 'bg-surface-container text-on-surface-variant',
  prep: 'bg-surface-container text-on-surface-variant',
  specific: 'bg-surface-container text-on-surface-variant',
  peak: 'bg-surface-container text-on-surface-variant',
}

const cellClass = (w) => {
  if (w.week === props.currentWeek) return 'bg-primary-container text-on-primary font-bold shadow-sm'
  if (w.stepBack) return 'bg-primary-fixed text-primary font-bold'
  return TONE.base
}

const phases = computed(() => {
  const list = props.weeks || []
  const base = list.filter((w) => !w.stepBack)
  const step = list.filter((w) => w.stepBack)
  const range = (arr) => (arr.length ? `第${arr[0].week}-${arr[arr.length - 1].week}周` : '—')
  return [
    { label: '适应/基础', sub: range(base.slice(0, 2)), bg: 'bg-surface-container-low', fg: 'text-primary' },
    { label: '回撤周', sub: step.length ? '第3周' : '—', bg: 'bg-primary-fixed/60', fg: 'text-primary' },
    { label: '专项提升', sub: range(base.slice(2)), bg: 'bg-surface-container-low', fg: 'text-on-surface' },
  ]
})
</script>

<template>
  <div>
    <div
      class="grid gap-1 py-1"
      :style="{ gridTemplateColumns: `repeat(${Math.min(weeks.length, 10)}, minmax(0,1fr))` }"
    >
      <div v-for="w in weeks" :key="w.week" class="flex flex-col items-center">
        <div class="w-full py-1.5 rounded text-center font-label-caps text-label-caps" :class="cellClass(w)">
          W{{ w.week }}
        </div>
        <span
          class="mt-1 w-1.5 h-1.5 rounded-full"
          :class="
            w.week === currentWeek
              ? 'bg-primary-container'
              : w.stepBack
                ? 'bg-primary'
                : 'bg-transparent'
          "
        />
      </div>
    </div>

    <div class="grid grid-cols-3 gap-1.5 pt-2">
      <div v-for="phase in phases" :key="phase.label" class="rounded-lg p-2 text-center" :class="phase.bg">
        <span class="block font-label-caps text-label-caps font-bold" :class="phase.fg">{{ phase.label }}</span>
        <span class="plan-summary-text block font-body-sm text-body-sm text-on-surface-variant scale-90">{{ phase.sub }}</span>
      </div>
    </div>
  </div>
</template>
