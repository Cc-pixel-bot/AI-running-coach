<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useHistoryStore } from '../../stores/history.js'
import AppHeader from '../../components/layout/AppHeader.vue'
import Icon from '../../components/ui/Icon.vue'
import StatusTag from '../../components/ui/StatusTag.vue'
import { formatDuration, formatPace } from '../../domain/utils/pace.js'

const router = useRouter()
const history = useHistoryStore()

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

const records = computed(() => history.records)

const completionText = { full: '完全完成', mostly: '基本完成', partial: '部分完成', none: '未完成' }

function openRecord(r) {
  if (r.summary) {
    router.push('/summary')
  }
}
</script>

<template>
  <main class="min-h-screen bg-surface">
    <AppHeader title="训练记录" subtitle="训练档案 · 智程" />

    <div class="pt-14 pb-24 px-gutter space-y-space-md">
      <!-- 汇总 -->
      <section class="grid grid-cols-4 gap-2">
        <div class="bg-surface-container-lowest rounded-xl p-2 text-center shadow-card">
          <span class="font-label-caps text-label-caps text-on-surface-variant block">总次数</span>
          <span class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ records.length }}</span>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-2 text-center shadow-card">
          <span class="font-label-caps text-label-caps text-on-surface-variant block">总里程</span>
          <span class="font-headline-sm text-headline-sm text-primary-container font-bold">{{ history.totalDistance }}</span>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-2 text-center shadow-card">
          <span class="font-label-caps text-label-caps text-on-surface-variant block">总时长</span>
          <span class="font-headline-sm text-headline-sm text-on-surface font-bold">
            {{ Math.round(history.totalDuration / 60) }}′
          </span>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-2 text-center shadow-card">
          <span class="font-label-caps text-label-caps text-on-surface-variant block">平均强度</span>
          <span class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ history.avgRpe }}</span>
        </div>
      </section>

      <section>
        <div class="flex items-center justify-between px-0.5 mb-2">
          <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
            <span class="section-bar" />历史课次
          </h2>
          <router-link to="/trends" class="font-body-sm text-body-sm text-primary font-semibold">查看趋势 →</router-link>
        </div>

        <div v-if="!records.length" class="bg-surface-container-lowest rounded-xl p-6 text-center">
          <Icon name="directions_run" :size="24" class="text-outline mx-auto mb-1" />
          <p class="text-body-sm text-on-surface-variant">还没有训练记录。</p>
        </div>

        <div
          v-for="r in records"
          :key="r.id"
          class="bg-surface-container-lowest rounded-xl p-space-md shadow-card border border-outline-variant/20 mb-2"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                <Icon :name="TYPE_ICON[r.type] || 'directions_run'" :size="18" class="text-on-surface-variant" />
              </div>
              <div class="min-w-0">
                <p class="font-headline-sm text-[15px] text-on-surface truncate">{{ r.title || r.sessionTitle }}</p>
                <p class="font-body-sm text-body-sm text-on-surface-variant">
                  {{ r.date }} · {{ r.actualDistanceKm ? `${r.actualDistanceKm}公里` : '力量课' }} ·
                  {{ formatDuration(r.actualDurationSec || 0) }}
                  <template v-if="r.avgPace"> · {{ formatPace(r.avgPace) }}/公里</template>
                </p>
              </div>
            </div>
            <div class="flex flex-col items-end gap-1 shrink-0">
              <StatusTag
                :tone="r.feedback?.completion === 'full' ? 'good' : r.feedback?.completion === 'none' ? 'danger' : 'warn'"
              >
                {{ completionText[r.feedback?.completion] || '已完成' }}
              </StatusTag>
              <span v-if="(r.feedback?.painScore || 0) >= 4" class="flex items-center gap-1 text-[11px] text-error">
                <Icon name="healing" :size="12" />疼痛 {{ r.feedback.painScore }}
              </span>
            </div>
          </div>

          <div v-if="r.feedback?.note" class="mt-2 bg-surface-container-low rounded-lg px-2.5 py-1.5">
            <p class="text-body-sm text-body-sm text-on-surface-variant leading-snug">“{{ r.feedback.note }}”</p>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
