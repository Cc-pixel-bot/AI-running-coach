<script setup>
import { computed } from 'vue'
import { useHistoryStore } from '../../stores/history.js'
import AppHeader from '../../components/layout/AppHeader.vue'
import Icon from '../../components/ui/Icon.vue'
import StatusTag from '../../components/ui/StatusTag.vue'
import { formatPace } from '../../domain/utils/pace.js'

const history = useHistoryStore()

const weeks = computed(() => history.weeklyTrend)
const maxKm = computed(() => Math.max(10, ...weeks.value.map((w) => w.km)))

const pacePoints = computed(() => {
  const list = weeks.value.filter((w) => w.avgPace > 0)
  if (!list.length) return ''
  const paces = list.map((w) => w.avgPace)
  const min = Math.min(...paces) - 20
  const max = Math.max(...paces) + 20
  return list
    .map((w, i) => {
      const x = (i / Math.max(1, weeks.value.length - 1)) * 100
      const y = 100 - ((w.avgPace - min) / (max - min || 1)) * 80 - 10
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
})

const zoneTotals = computed(() => {
  const totals = history.zoneTotals
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1
  const names = { easy: '轻松跑', long: '长距离', tempo: '节奏跑', interval: '间歇', recovery: '恢复跑' }
  return Object.entries(totals)
    .map(([k, v]) => ({ key: k, name: names[k] || k, ratio: v / sum, sec: v }))
    .sort((a, b) => b.sec - a.sec)
})
</script>

<template>
  <main class="min-h-screen bg-surface">
    <AppHeader title="数据趋势" subtitle="训练趋势 · 智程" />

    <div class="pt-14 pb-24 px-gutter space-y-space-md">
      <!-- 周跑量 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
            <span class="section-bar" />近 6 周跑量
          </h2>
          <span class="font-label-data text-label-data text-on-surface-variant">单位：公里</span>
        </div>
        <div class="flex items-end gap-2 h-32">
          <div v-for="w in weeks" :key="w.label" class="flex-1 flex flex-col items-center gap-1">
            <span class="font-label-data text-label-data text-on-surface font-bold">{{ w.km }}</span>
            <div
              class="w-full rounded-t-lg bg-gradient-to-t from-primary-container to-secondary-container transition-all"
              :style="{ height: `${Math.max(4, (w.km / maxKm) * 100)}px` }"
            />
            <span class="font-label-caps text-label-caps text-outline">{{ w.label }}</span>
          </div>
        </div>
      </section>

      <!-- 平均配速曲线 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
            <span class="w-1.5 h-4 bg-secondary-container rounded-full" />平均配速趋势
          </h2>
          <span class="font-label-data text-label-data text-on-surface-variant">越低越快</span>
        </div>
        <svg v-if="pacePoints" viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-28">
          <line x1="0" y1="90" x2="100" y2="90" stroke="#DFE4EE" stroke-width="1" />
          <path :d="pacePoints" fill="none" stroke="#FF9F43" stroke-width="2.5" stroke-linecap="round" />
        </svg>
        <div class="flex justify-between pt-1">
          <span v-for="w in weeks" :key="w.label" class="font-label-caps text-label-caps text-outline">
            {{ w.avgPace ? formatPace(w.avgPace) : '—' }}
          </span>
        </div>
      </section>

      <!-- 完成率 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
            <span class="w-1.5 h-4 bg-success rounded-full" />课次完成率
          </h2>
          <span class="font-label-data text-label-data text-on-surface-variant">完全完成占比</span>
        </div>
        <div class="space-y-2">
          <div v-for="w in weeks" :key="w.label" class="flex items-center gap-2">
            <span class="font-label-data text-label-data text-outline w-10 shrink-0">{{ w.label }}</span>
            <div class="flex-1 h-2 rounded-full bg-surface-container overflow-hidden">
              <div class="h-full bg-success rounded-full" :style="{ width: `${w.completionRate * 100}%` }" />
            </div>
            <span class="font-label-data text-label-data text-on-surface w-10 text-right shrink-0">
              {{ Math.round(w.completionRate * 100) }}%
            </span>
          </div>
        </div>
      </section>

      <!-- 强度区间占比 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
            <span class="w-1.5 h-4 bg-info rounded-full" />训练时间区间分布
          </h2>
          <span class="font-label-data text-label-data text-on-surface-variant">累计</span>
        </div>
        <div v-if="!zoneTotals.length" class="text-body-sm text-on-surface-variant">暂无区间数据。</div>
        <div v-else class="space-y-2">
          <div v-for="z in zoneTotals" :key="z.key" class="flex items-center gap-2">
            <span class="font-body-sm text-body-sm text-on-surface w-16 shrink-0">{{ z.name }}</span>
            <div class="flex-1 h-2 rounded-full bg-surface-container overflow-hidden">
              <div class="h-full bg-primary-container rounded-full" :style="{ width: `${z.ratio * 100}%` }" />
            </div>
            <span class="font-label-data text-label-data text-on-surface w-10 text-right shrink-0">
              {{ Math.round(z.ratio * 100) }}%
            </span>
          </div>
        </div>
      </section>

      <!-- 风险提示 -->
      <section v-if="history.painAlerts.length" class="bg-error-container/70 rounded-xl p-3 flex items-start gap-2">
        <Icon name="healing" :size="18" class="text-error shrink-0 mt-0.5" />
        <div class="text-body-sm text-on-error-container leading-snug">
          <p class="font-bold">近 30 天有 {{ history.painAlerts.length }} 次课次疼痛评分 ≥4</p>
          <p class="mt-0.5">
            按安全底线规则，同一部位连续 2 次疼痛 ≥4 将被永久降级强度；请关注身体信号。
          </p>
        </div>
      </section>
    </div>
  </main>
</template>
