<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRunStore } from '../../stores/run.js'
import { usePlanStore } from '../../stores/plan.js'
import { useUiStore } from '../../stores/ui.js'
import AppHeader from '../../components/layout/AppHeader.vue'
import Icon from '../../components/ui/Icon.vue'
import StatusTag from '../../components/ui/StatusTag.vue'
import AppButton from '../../components/ui/AppButton.vue'
import AdjustmentDiff from '../../components/plan/AdjustmentDiff.vue'
import { formatDuration, formatPace } from '../../domain/utils/pace.js'

const router = useRouter()
const run = useRunStore()
const planStore = usePlanStore()
const ui = useUiStore()

const record = computed(() => run.record || {})
const feedback = computed(() => run.feedback || {})
const summary = computed(() => run.summary)
const adjustments = computed(() => run.lastAdjustments || [])
const safetyNotice = computed(() => run.safetyNotice)
const adjustmentMeta = computed(() => planStore.pendingAdjustmentMeta || {})
const needsPlanAdjustment = computed(() => Boolean(safetyNotice.value) || adjustments.value.length > 0 || adjustmentMeta.value.decision === 'need_more_info')
function formatSessionRefs(text) {
  return String(text || '').replace(/\bw(\d+)s(\d+)\b/gi, '第$1周第$2节')
}
const adjustmentReason = computed(() => formatSessionRefs(safetyNotice.value?.text || adjustments.value[0]?.reasonText || '本次训练反馈需要进一步评估。'))
const showAdjustmentDiff = ref(false)

const planned = computed(() => run.session?.distanceKm || 0)
const achievement = computed(() =>
  planned.value ? Math.min(100, Math.round(((record.value.actualDistanceKm || 0) / planned.value) * 100)) : 0,
)

const SECTION_STYLE = {
  replay: { icon: 'analytics', bg: 'bg-primary-container/20', fg: 'text-primary' },
  positive: { icon: 'thumb_up', bg: 'bg-secondary-container/20', fg: 'text-secondary' },
  watch: { icon: 'notifications_active', bg: 'bg-surface-container-highest', fg: 'text-on-surface-variant' },
  next: { icon: 'event_upcoming', bg: 'bg-success-container', fg: 'text-on-success-container' },
}

const diffItems = computed(() =>
  adjustments.value.map((a) => ({
    label: a.target.label || '后续训练',
    beforeText: a.type === 'MODIFY_WEEK' ? `${a.before.targetKm}公里/周` : `${a.before?.distanceKm ?? 0}公里`,
    afterText: a.type === 'MODIFY_WEEK' ? `${a.after.targetKm}公里/周` : `${a.after?.distanceKm ?? 0}公里`,
    reasonText: formatSessionRefs(a.reasonText),
    reasonCode: a.reasonCode,
  })),
)

async function acceptAdjustments() {
  await planStore.decideAdjustments('accepted')
  ui.toast('调整已采纳，计划已同步', 'success')
  router.push('/plan')
}

async function keepPlan() {
  await planStore.decideAdjustments('rejected')
  ui.toast('已保持原计划，本次决策已留痕', 'info')
  router.push('/plan')
}
</script>

<template>
  <main class="min-h-screen bg-surface">
    <AppHeader title="今日训练总结" subtitle="AI训练复盘" back />

    <div class="pt-14 pb-10 px-gutter space-y-space-md">
      <template v-if="summary">
        <section class="bg-surface-container-lowest rounded-2xl p-4 shadow-card flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-full bg-success-container flex items-center justify-center text-on-success-container shrink-0">
              <Icon name="task_alt" :size="24" />
            </div>
            <div class="min-w-0">
              <span class="font-label-data text-label-data text-success">今日训练已完成</span>
              <h2 class="font-headline-sm text-headline-sm text-on-surface mt-1 truncate">{{ run.session?.title || '本次训练' }}</h2>
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="text-body-sm text-body-sm text-on-surface-variant block">完成度</span>
            <strong class="font-headline-lg text-headline-lg text-primary">{{ achievement }}%</strong>
          </div>
        </section>

        <section class="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-headline-sm text-headline-sm text-on-surface">训练数据</h2>
            <span class="font-body-sm text-body-sm text-on-surface-variant">计划 {{ planned.toFixed(1) }} 公里</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="rounded-xl bg-surface-container-low p-3 text-center">
              <span class="text-body-sm text-body-sm text-on-surface-variant block">实际距离</span>
              <strong class="font-headline-sm text-headline-sm text-on-surface block mt-1">{{ Number(record.actualDistanceKm || 0).toFixed(1) }}公里</strong>
            </div>
            <div class="rounded-xl bg-surface-container-low p-3 text-center">
              <span class="text-body-sm text-body-sm text-on-surface-variant block">训练用时</span>
              <strong class="font-headline-sm text-headline-sm text-on-surface block mt-1">{{ formatDuration(record.actualDurationSec || 0) }}</strong>
            </div>
            <div class="rounded-xl bg-surface-container-low p-3 text-center">
              <span class="text-body-sm text-body-sm text-on-surface-variant block">平均配速</span>
              <strong class="font-headline-sm text-headline-sm text-primary block mt-1">{{ formatPace(record.avgPace || 0) }}</strong>
            </div>
          </div>
        </section>

        <section class="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
          <div class="flex items-center justify-between mb-2">
            <h2 class="font-headline-sm text-headline-sm text-on-surface">训练反馈</h2>
            <span class="font-body-sm text-body-sm text-on-surface-variant">用户自评</span>
          </div>
          <div class="flex items-center justify-between py-2 border-b border-surface-container-high">
            <span class="font-body-md text-body-md text-on-surface-variant">主观强度</span>
            <strong class="font-headline-sm text-headline-sm text-on-surface">{{ feedback.rpe || '—' }} / 10</strong>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="font-body-md text-body-md text-on-surface-variant">身体状态</span>
            <strong class="font-body-md text-body-md text-on-surface">{{ feedback.painScore > 0 ? `不适 ${feedback.painScore} 分` : '无明显不适' }}</strong>
          </div>
        </section>

        <section class="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
          <div class="flex items-center gap-2 mb-2">
            <Icon name="auto_awesome" :size="18" class="text-primary" filled />
            <h2 class="font-headline-sm text-headline-sm text-on-surface">智程训练总结</h2>
          </div>
          <p class="font-body-md text-body-md text-on-surface leading-relaxed">{{ summary.text || '本次训练已完成，继续保持稳定节奏。' }}</p>
        </section>

        <section v-if="needsPlanAdjustment" class="bg-primary-fixed/70 rounded-2xl p-4 border border-primary-container/20">
          <h2 class="font-headline-sm text-headline-sm text-on-surface">{{ adjustmentMeta.decision === 'need_more_info' ? '需要继续观察' : '需要调整训练计划' }}</h2>
          <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">{{ adjustmentReason }}</p>
          <p v-if="adjustmentMeta.adjustmentEpisode?.holdCondition" class="font-body-sm text-on-surface-variant mt-2 leading-relaxed">观察重点：{{ adjustmentMeta.adjustmentEpisode.holdCondition }}</p>
          <AppButton v-if="adjustments.length && !showAdjustmentDiff" class="mt-3" variant="primary" icon="tune" @click="showAdjustmentDiff = true">查看计划调整</AppButton>
          <div v-if="adjustments.length && showAdjustmentDiff" class="mt-4 space-y-3">
            <AdjustmentDiff :items="diffItems" />
            <AppButton class="w-full" variant="primary" icon="check" @click="acceptAdjustments">采纳调整</AppButton>
          </div>
          <AppButton v-if="!adjustments.length" class="mt-3" variant="secondary" @click="router.push('/plan')">继续执行当前计划</AppButton>
        </section>

        <section v-else class="bg-success-container/70 rounded-2xl p-4">
          <div class="flex items-center gap-2 text-on-success-container">
            <Icon name="check_circle" :size="20" />
            <h2 class="font-headline-sm text-headline-sm">按原计划继续</h2>
          </div>
          <p class="font-body-sm text-body-sm text-on-success-container mt-1">本次训练状态稳定，下一次训练继续按原计划执行。</p>
          <AppButton class="mt-3" variant="secondary" @click="router.push('/plan')">按原计划继续</AppButton>
        </section>

        <AppButton variant="ghost" @click="router.push('/plan')">返回训练计划</AppButton>
      </template>

      <section v-if="!summary" class="bg-surface-container-lowest rounded-2xl p-6 shadow-card text-center">
        <p class="font-body-md text-body-md text-on-surface-variant">还没有可展示的训练总结。</p>
        <AppButton class="mt-4" variant="secondary" @click="router.push('/plan')">返回训练计划</AppButton>
      </section>
    </div>
  </main>
</template>
