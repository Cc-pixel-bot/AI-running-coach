<script setup>
import { computed } from 'vue'
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
import { completionLabel } from '../../domain/engine/adjustEngine.js'

const router = useRouter()
const run = useRunStore()
const planStore = usePlanStore()
const ui = useUiStore()

const record = computed(() => run.record || {})
const feedback = computed(() => run.feedback || {})
const summary = computed(() => run.summary)
const adjustments = computed(() => run.lastAdjustments || [])
const safetyNotice = computed(() => run.safetyNotice)

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
    label: a.target.label,
    beforeText: a.type === 'MODIFY_WEEK' ? `${a.before.targetKm}公里/周` : `${a.before?.distanceKm ?? 0}公里`,
    afterText: a.type === 'MODIFY_WEEK' ? `${a.after.targetKm}公里/周` : `${a.after?.distanceKm ?? 0}公里`,
    reasonText: a.reasonText,
    reasonCode: a.reasonCode,
  })),
)

function acceptAdjustments() {
  planStore.decideAdjustments('accepted')
  ui.toast('调整已采纳，计划已同步', 'success')
  router.push('/plan')
}

function keepPlan() {
  planStore.decideAdjustments('rejected')
  ui.toast('已保持原计划，本次决策已留痕', 'info')
  router.push('/plan')
}
</script>

<template>
  <main class="min-h-screen bg-surface">
      <AppHeader title="训练总结" subtitle="训练回顾 · 智程" back />

    <div v-if="!summary" class="px-gutter pt-20 text-center space-y-3">
      <p class="text-on-surface-variant">还没有训练总结，先完成一次训练并提交反馈。</p>
      <AppButton variant="secondary" @click="router.push('/plan')">返回计划总览</AppButton>
    </div>

    <div v-else class="pt-14 pb-10 px-gutter space-y-space-md">
      <!-- 顶部卡 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card border border-outline-variant/30 flex items-center justify-between">
        <div class="flex items-center gap-space-md">
          <div class="w-12 h-12 rounded-full bg-primary-container/15 flex items-center justify-center text-primary shrink-0">
            <Icon name="task_alt" :size="28" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full bg-primary text-on-primary font-bold text-body-sm">已完成</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">{{ run.session?.title?.split('·')[0] }}</span>
            </div>
            <p class="font-headline-sm text-headline-sm text-on-surface mt-1">
              {{ achievement >= 95 ? '完成度出色' : achievement >= 70 ? '基本达成计划' : '未达计划目标' }}
            </p>
          </div>
        </div>
        <div class="text-right shrink-0">
          <span class="font-label-caps text-label-caps text-on-surface-variant uppercase block">达成率</span>
          <span class="font-headline-lg text-headline-lg text-primary font-bold leading-none">
            {{ achievement }}<span class="text-body-sm">%</span>
          </span>
        </div>
      </section>

      <!-- 安全提示 -->
      <section v-if="safetyNotice" class="bg-error-container rounded-xl p-space-md shadow-card">
        <div class="flex items-start gap-2">
          <Icon name="emergency" :size="22" class="text-error shrink-0 mt-0.5" />
          <div class="min-w-0">
            <p class="font-headline-sm text-headline-sm text-on-error-container font-bold">{{ safetyNotice.title }}</p>
            <p class="text-body-sm text-on-error-container leading-relaxed mt-1">{{ safetyNotice.text }}</p>
            <p class="text-[11px] text-on-error-container/80 mt-1">依据：{{ safetyNotice.rule }}</p>
          </div>
        </div>
      </section>

      <!-- 训练数据 -->
      <section class="flex flex-col gap-space-xs">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-3.5 bg-primary rounded-full" />
            <h2 class="font-headline-sm text-headline-sm text-on-surface">训练数据</h2>
          </div>
          <span class="font-label-data text-label-data text-on-surface-variant">4 项核心指标</span>
        </div>
        <div class="grid grid-cols-2 gap-space-sm">
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-card border border-outline-variant/20 flex flex-col">
            <div class="flex items-center gap-1.5 text-on-surface-variant">
              <Icon name="timer" :size="16" />
              <span class="font-label-caps text-label-caps uppercase">实际用时</span>
            </div>
            <div class="mt-2">
              <span class="font-headline-lg text-headline-lg text-on-surface font-bold">{{ formatDuration(record.actualDurationSec || 0) }}</span>
            </div>
          </div>
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-card border border-outline-variant/20 flex flex-col">
            <div class="flex items-center gap-1.5 text-on-surface-variant">
              <Icon name="straighten" :size="16" />
              <span class="font-label-caps text-label-caps uppercase">实际距离</span>
            </div>
            <div class="mt-2">
              <span class="font-headline-lg text-headline-lg text-on-surface font-bold">{{ (record.actualDistanceKm || 0).toFixed(2) }}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant ml-1">公里</span>
            </div>
          </div>
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-card border border-outline-variant/20 flex flex-col">
            <div class="flex items-center gap-1.5 text-on-surface-variant">
              <Icon name="speed" :size="16" />
              <span class="font-label-caps text-label-caps uppercase">平均配速</span>
            </div>
            <div class="mt-2">
              <span class="font-headline-lg text-headline-lg text-primary font-bold">{{ formatPace(record.avgPace || 0) }}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant ml-1">/公里</span>
            </div>
          </div>
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-card border border-outline-variant/20 flex flex-col">
            <div class="flex items-center gap-1.5 text-on-surface-variant">
              <Icon name="flag" :size="16" />
              <span class="font-label-caps text-label-caps uppercase">目标完成度</span>
            </div>
            <div class="mt-2">
              <span class="font-headline-lg text-headline-lg text-secondary font-bold">{{ achievement }}%</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant ml-1 font-normal">
                {{ completionLabel(feedback.completion) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 用户反馈 -->
      <section class="flex flex-col gap-space-xs">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-3.5 bg-secondary rounded-full" />
            <h2 class="font-headline-sm text-headline-sm text-on-surface">用户反馈</h2>
          </div>
          <span class="font-label-data text-label-data text-on-surface-variant">身心状态自评</span>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-card border border-outline-variant/20 flex flex-col gap-space-sm">
          <div class="flex items-center justify-between py-1 border-b border-surface-container-high">
            <div class="flex items-center gap-2">
              <Icon name="tune" :size="18" class="text-primary" />
              <span class="font-body-md text-body-md text-on-surface">主观强度</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="font-headline-sm text-headline-sm text-primary font-bold">{{ feedback.rpe }}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">/ 目标 {{ run.session?.intensity?.rpe?.[1] }}</span>
            </div>
          </div>
          <div class="flex items-center justify-between py-1 border-b border-surface-container-high">
            <div class="flex items-center gap-2">
              <Icon name="battery_charging_full" :size="18" class="text-secondary" />
              <span class="font-body-md text-body-md text-on-surface">疲劳程度</span>
            </div>
            <span class="px-2 py-0.5 rounded bg-surface-container text-body-sm font-semibold text-on-surface">
              {{ { easy: '轻松', normal: '正常', fatigued: '疲劳', very_hard: '明显吃力' }[feedback.feel] || '—' }}
            </span>
          </div>
          <div class="flex items-center justify-between py-1">
            <div class="flex items-center gap-2">
              <Icon name="health_and_safety" :size="18" class="text-primary" />
              <span class="font-body-md text-body-md text-on-surface">身体不适</span>
            </div>
            <span
              class="px-2 py-0.5 rounded text-body-sm font-semibold"
              :class="feedback.painScore >= 4 ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface'"
            >
              {{ feedback.painScore >= 4 ? `疼痛 ${feedback.painScore} 分 · ${(feedback.painParts || []).join('、')}` : '无明显不适' }}
            </span>
          </div>
        </div>
      </section>

      <!-- AI 训练总结（四段式） -->
      <section class="flex flex-col gap-space-xs">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5">
            <div class="w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center">
              <Icon name="smart_toy" :size="13" filled />
            </div>
            <h2 class="font-headline-sm text-headline-sm text-on-surface">训练总结（智程教练）</h2>
          </div>
          <span class="font-label-caps text-label-caps text-primary font-bold">智能复盘</span>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-card border border-outline-variant/20 flex flex-col gap-space-sm">
          <div v-for="s in summary.structure" :key="s.key" class="flex gap-space-sm items-start">
            <div
              class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              :class="SECTION_STYLE[s.key].bg"
            >
              <Icon :name="SECTION_STYLE[s.key].icon" :size="15" :class="SECTION_STYLE[s.key].fg" />
            </div>
            <div class="flex-1">
              <h3 class="font-body-md text-body-md font-bold text-on-surface">{{ s.title }}</h3>
              <p
                v-for="(p, i) in s.paragraphs"
                :key="i"
                class="font-body-sm text-body-sm text-on-surface-variant mt-0.5 leading-relaxed"
              >
                {{ p }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- 后续建议与行动：调整 diff -->
      <section class="flex flex-col gap-space-xs">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-3.5 bg-primary-container rounded-full" />
            <h2 class="font-headline-sm text-headline-sm text-on-surface">后续建议与行动</h2>
          </div>
          <span class="font-label-data text-label-data text-on-surface-variant">NEXT STEP</span>
        </div>

        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-card border border-outline-variant/20 flex flex-col gap-space-md">
          <div class="bg-surface-container-low rounded-lg p-space-sm flex flex-col gap-1">
            <div class="flex items-center gap-1.5 text-primary">
              <Icon name="event_upcoming" :size="16" />
              <span class="font-body-md text-body-md font-bold">下一次训练安排</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed pl-5">
              {{
                planStore.plan
                  ? `第 ${planStore.plan.currentWeek} 周 · ${planStore.upcomingSessions[0]?.dayLabel || '—'} · ${
                      planStore.upcomingSessions[0]?.title || '—'
                    }`
                  : '—'
              }}
            </p>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5 text-secondary">
                <Icon name="verified" :size="16" />
                <span class="font-body-md text-body-md font-bold">计划调整评估</span>
              </div>
              <StatusTag tone="brand" icon="check_circle">
                {{ adjustments.length ? `${adjustments.length} 处变更` : '无需调整' }}
              </StatusTag>
            </div>

            <AdjustmentDiff v-if="diffItems.length" :items="diffItems" />
            <p v-else class="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              当前状态未触发任何调整规则，计划按原样继续推进。
            </p>
          </div>

          <!-- 安全类不给拒绝按钮 -->
          <div v-if="safetyNotice" class="pt-1">
            <AppButton variant="danger" icon="self_improvement" @click="keepPlan">我今天休息</AppButton>
            <p class="text-[11px] text-on-error-container/80 mt-1 text-center">
              安全类调整不可拒绝，系统会记录本次决策。
            </p>
          </div>
          <div v-else class="flex gap-2 pt-1">
            <AppButton variant="primary" icon="check_circle" @click="acceptAdjustments">采纳调整</AppButton>
            <AppButton variant="secondary" @click="keepPlan">保持原计划</AppButton>
          </div>
        </div>
      </section>

      <p class="disclaimer">
        本产品提供训练信息与建议，不构成医疗建议。开始或修改运动计划前，请咨询有资质的医疗专业人员。
      </p>
    </div>
  </main>
</template>
