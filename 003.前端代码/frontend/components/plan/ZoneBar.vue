<script setup>
import { computed } from 'vue'
import { INTENSITY } from '../../domain/constants/intensity.js'

/** 强度分布堆叠条（PRD §B3 第 4 项） */
const props = defineProps({
  zones: { type: Array, default: () => [] },
})

const segments = computed(() =>
  props.zones.map((z) => ({
    ...z,
    name: INTENSITY[z.level]?.shortName || z.name,
    color: INTENSITY[z.level]?.color || '#ccc',
  })),
)
</script>

<template>
  <div>
    <div class="flex w-full h-1 rounded-full overflow-hidden bg-surface-container">
      <div
        v-for="z in segments"
        :key="z.level"
        class="h-full"
        :style="{ width: `${(z.ratio * 100).toFixed(1)}%`, background: z.color }"
        :title="`${z.name} ${(z.ratio * 100).toFixed(0)}%`"
      />
    </div>
    <div class="flex flex-wrap gap-x-3 gap-y-1 pt-2">
      <span v-for="z in segments" :key="z.level" class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full" :style="{ background: z.color }" />
        <span class="font-body-sm text-body-sm text-on-surface-variant">{{ z.name }}</span>
        <span class="font-label-data text-label-data text-on-surface font-bold">{{ (z.ratio * 100).toFixed(0) }}%</span>
      </span>
    </div>
  </div>
</template>
