<script setup>
import { computed } from 'vue'
import Icon from '../ui/Icon.vue'

/** 实时轨迹图（PRD §C2：轨迹图实时描线） */
const props = defineProps({
  points: { type: Array, default: () => [] },
  status: { type: String, default: 'running' },
})

const W = 320
const H = 144

const track = computed(() => {
  if (!props.points || props.points.length < 2) return ''
  const lats = props.points.map((p) => p.lat)
  const lngs = props.points.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const spanLat = maxLat - minLat || 1e-6
  const spanLng = maxLng - minLng || 1e-6
  const pad = 18
  return props.points
    .map((p, i) => {
      const x = pad + ((p.lng - minLng) / spanLng) * (W - pad * 2)
      const y = H - pad - ((p.lat - minLat) / spanLat) * (H - pad * 2)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
})

const start = computed(() => (track.value ? track.value.split(' ').slice(1, 3).map(Number) : [0, 0]))
const end = computed(() => {
  if (!props.points || props.points.length < 2) return [0, 0]
  const lats = props.points.map((p) => p.lat)
  const lngs = props.points.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const spanLat = maxLat - minLat || 1e-6
  const spanLng = maxLng - minLng || 1e-6
  const pad = 18
  const last = props.points[props.points.length - 1]
  return [
    pad + ((last.lng - minLng) / spanLng) * (W - pad * 2),
    H - pad - ((last.lat - minLat) / spanLat) * (H - pad * 2),
  ]
})
</script>

<template>
  <div class="relative w-full h-36 rounded-lg overflow-hidden bg-surface-container-high">
    <!-- 模拟地图底图 -->
    <svg class="absolute inset-0 w-full h-full" viewBox="0 0 320 144" preserveAspectRatio="none">
      <rect width="320" height="144" fill="#dfe4ee" />
      <path d="M0 96 H320 M0 40 H320 M120 0 V144 M220 0 V144" stroke="#cdd5e2" stroke-width="6" />
      <path d="M0 120 C 80 100, 140 130, 320 96" stroke="#e2e7f0" stroke-width="10" fill="none" />
    </svg>

    <svg v-if="track" class="absolute inset-0 w-full h-full pointer-events-none" fill="none" viewBox="0 0 320 144">
      <path :d="track" stroke="#FF7A00" stroke-linecap="round" stroke-linejoin="round" stroke-width="5" />
      <circle :cx="start[0]" :cy="start[1]" r="5" fill="#994700" stroke="#fff" stroke-width="3" />
      <circle :cx="end[0]" :cy="end[1]" r="6" fill="#FF7A00" />
      <circle v-if="status === 'running'" :cx="end[0]" :cy="end[1]" r="10" fill="#FF7A00" opacity="0.4" class="animate-pulse" />
    </svg>

    <div
      v-else
      class="absolute inset-0 flex flex-col items-center justify-center gap-1 text-on-surface-variant"
    >
      <Icon name="location_searching" :size="22" />
      <span class="font-body-sm text-body-sm">等待定位信号…</span>
    </div>

    <div class="absolute bottom-2 left-2 bg-surface-container-lowest/90 backdrop-blur-md px-2 py-1 rounded shadow-sm flex items-center gap-2">
      <span class="w-2 h-2 rounded-full" :class="status === 'running' ? 'bg-primary animate-pulse' : 'bg-outline'" />
      <span class="font-label-caps text-label-caps text-on-surface font-semibold">实时动态回传</span>
    </div>
  </div>
</template>
