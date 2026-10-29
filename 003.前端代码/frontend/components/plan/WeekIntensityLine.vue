<script setup>
import { computed } from 'vue'

const props = defineProps({
  weeks: { type: Array, required: true },
})

const COLORS = {
  recovery: '#73A7A0',
  easy: '#7BAE84',
  aerobic: '#7F9FC7',
  long: '#6F8FAF',
  tempo: '#E38B48',
  interval: '#D65B55',
  race: '#9A6BC2',
  strength: '#8A7A6A',
}

const line = computed(() => (props.weeks || []).map((week) => {
  const sessions = week.sessions || []
  const quality = sessions.find((session) => ['interval', 'tempo', 'race'].includes(session.type))
  const active = quality || sessions.find((session) => session.type !== 'strength') || sessions[0]
  const level = active?.type || 'easy'
  return { week: week.week, color: COLORS[level] || COLORS.easy }
}))
</script>

<template>
  <div class="pt-3" aria-label="每周训练强度变化">
    <div class="relative px-2">
      <div class="absolute left-2 right-2 top-2.5 h-1 rounded-full bg-surface-container-high" />
      <div class="relative flex justify-between">
        <div v-for="item in line" :key="item.week" class="flex flex-col items-center gap-1">
          <span class="w-3 h-3 rounded-full border-2 border-surface-container-lowest shadow-sm" :style="{ backgroundColor: item.color }" />
          <span class="font-label-caps text-[10px] text-on-surface-variant">W{{ item.week }}</span>
        </div>
      </div>
    </div>
    <div class="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-on-surface-variant">
      <span class="flex items-center gap-1"><i class="w-2 h-2 rounded-full bg-[#7BAE84]" />基础</span>
      <span class="flex items-center gap-1"><i class="w-2 h-2 rounded-full bg-[#E38B48]" />质量</span>
      <span class="flex items-center gap-1"><i class="w-2 h-2 rounded-full bg-[#9A6BC2]" />专项</span>
    </div>
  </div>
</template>
