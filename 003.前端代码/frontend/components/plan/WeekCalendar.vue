<script setup>
import { computed } from 'vue'

/** 周期周历（PRD §B3 第 2 项：按模板周期长度的格子，标注各周类型） */
const props = defineProps({
  weeks: { type: Array, required: true },
  currentWeek: { type: Number, default: 1 },
})
const emit = defineEmits(['select'])

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

const phaseGroups = computed(() => {
  const list = props.weeks || []
  const group = (label, items, bg, fg) => ({
    label,
    weeks: items.map((w) => `W${w.week}`).join(' · ') || '—',
    bg,
    fg,
  })
  const base = list.filter((w) => /适应|基础/i.test(`${w.phase || ''}${w.phaseName || ''}`))
  const step = list.filter((w) => w.stepBack || w.taper || /回撤|减量/i.test(`${w.phase || ''}${w.phaseName || ''}`))
  const specific = list.filter((w) => !base.includes(w) && !step.includes(w))
  return [
    group('适应/基础', base, 'bg-surface-container-low', 'text-primary'),
    group('回撤周', step, 'bg-primary-fixed/60', 'text-primary'),
    group('专项提升', specific, 'bg-surface-container-low', 'text-on-surface'),
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
        <button
          class="w-full py-1.5 rounded text-center font-label-caps text-label-caps"
          :class="cellClass(w)"
          type="button"
          :aria-label="`查看第${w.week}周训练`"
          @click="emit('select', w.week)"
        >
          W{{ w.week }}
        </button>
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
      <div v-for="phase in phaseGroups" :key="phase.label" class="rounded-lg p-2 text-center" :class="phase.bg">
        <span class="block font-label-caps text-label-caps font-bold" :class="phase.fg">{{ phase.label }}</span>
        <span class="plan-summary-text block font-body-sm text-body-sm text-on-surface-variant scale-90">{{ phase.weeks }}</span>
      </div>
    </div>
  </div>
</template>
