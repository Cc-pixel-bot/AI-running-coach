<script setup>
import { computed } from 'vue'
import Icon from '../ui/Icon.vue'
import StatusTag from '../ui/StatusTag.vue'
import { formatPace } from '../../domain/utils/pace.js'

/** 课次卡片（计划总览周列表用） */
const props = defineProps({
  session: { type: Object, required: true },
  week: { type: Object, default: null },
  today: { type: Boolean, default: false },
  status: { type: String, default: 'pending' }, // pending | done | replaced
})

const TYPE_ICON = {
  easy: 'directions_run',
  aerobic: 'directions_run',
  recovery: 'self_improvement',
  long: 'route',
  tempo: 'speed',
  interval: 'bolt',
  race: 'flag',
  strength: 'fitness_center',
  rest: 'self_improvement',
}

const meta = computed(() => ({
  icon: TYPE_ICON[props.session.type] || 'directions_run',
  pace:
    props.session.intensity && props.session.intensity.paceHigh
      ? `${formatPace(props.session.intensity.paceLow)}–${formatPace(props.session.intensity.paceHigh)}/公里`
      : '有氧心率区间',
}))

const dayNumber = computed(() => {
  const match = String(props.session.id || '').match(/s(\d+)$/)
  return match ? match[1] : props.session.dayOffset
})

const statusMeta = computed(() => {
  if (props.status === 'done') return { tone: 'good', text: '已完成', icon: 'check_circle' }
  if (props.status === 'replaced') return { tone: 'warn', text: '已调整', icon: 'edit_note' }
  if (props.today) return { tone: 'brand', text: '今日待练', icon: 'timer' }
  return { tone: 'muted', text: '待开始', icon: 'schedule' }
})
</script>

<template>
  <component
    :is="today ? 'router-link' : 'div'"
    :to="today ? '/run/prep' : undefined"
    class="block bg-surface-container-lowest rounded-xl p-3 relative overflow-hidden"
    :class="[
      today ? 'border border-primary-container/25 active:scale-[0.99] hover:shadow-card-lg transition-all' : '',
      status === 'done' ? 'opacity-80' : '',
    ]"
  >
    <div v-if="today" class="absolute top-0 left-0 right-0 h-1 bg-primary-container" />
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <div
          class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          :class="today ? 'bg-primary-fixed text-primary' : 'bg-surface-container text-on-surface-variant'"
        >
          <Icon :name="status === 'done' ? 'check_circle' : meta.icon" :size="20" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-label-caps text-label-caps text-on-surface-variant">第{{ dayNumber }}天</span>
            <span
              v-if="today"
              class="px-1.5 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-caps text-label-caps"
              >核心课次</span
            >
            <h3 class="font-headline-sm text-headline-sm text-on-surface truncate">{{ session.title.split('·')[0] }}</h3>
          </div>
          <p class="session-meta flex items-center font-body-sm text-body-sm text-on-surface-variant mt-0.5 truncate">
            <template v-if="session.distanceKm">
              <span>{{ session.distanceKm.toFixed(1) }} 公里</span><span aria-hidden="true">·</span><span>{{ session.durationMin }} 分钟</span><span aria-hidden="true">·</span>
            </template>
            <template v-else><span>{{ session.durationMin }} 分钟</span><span aria-hidden="true">·</span></template>
            <span>{{ meta.pace }}</span>
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <StatusTag :tone="statusMeta.tone" :icon="statusMeta.icon" :pulse="today">{{ statusMeta.text }}</StatusTag>
        <Icon v-if="today" name="chevron_right" :size="18" class="text-on-surface-variant" />
      </div>
    </div>
  </component>
</template>
