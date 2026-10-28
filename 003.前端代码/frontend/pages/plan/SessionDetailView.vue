<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlanStore } from '../../stores/plan.js'
import { useRunStore } from '../../stores/run.js'
import { useHistoryStore } from '../../stores/history.js'
import { useUiStore } from '../../stores/ui.js'
import AppHeader from '../../components/layout/AppHeader.vue'
import Icon from '../../components/ui/Icon.vue'
import StatusTag from '../../components/ui/StatusTag.vue'
import AppButton from '../../components/ui/AppButton.vue'
import CoachBanner from '../../components/coach/CoachBanner.vue'
import { COACH_DIALOGUES, COACH_QUOTES } from '../../data/exercises.js'
import { formatPace } from '../../domain/utils/pace.js'
import { STOP_SIGNALS } from '../../domain/constants/screening.js'

const route = useRoute()
const router = useRouter()
const planStore = usePlanStore()
const run = useRunStore()
const history = useHistoryStore()
const ui = useUiStore()

const warmupDone = ref([])
const cooldownDone = ref([])
const showStructure = ref(false)
const completing = ref(false)
const coachQuoteIndex = ref(0)

const session = computed(() => {
  const id = route.params.id || route.query.session
  for (const w of planStore.plan?.weeks || []) {
    const hit = w.sessions.find((s) => s.id === id)
    if (hit) return { ...hit, weekPlan: w }
  }

  // 从“今日训练”入口进入时，默认展示下一节待训练课次。
  const next = planStore.upcomingSessions?.[0]
  if (next) {
    const weekPlan = planStore.plan?.weeks?.find((w) => w.week === next.week)
    return { ...next, weekPlan }
  }

  return null
})

const isStrength = computed(() => session.value?.type === 'strength')
const isTodayTraining = computed(() => route.name === 'run-prep')
const isReadOnly = computed(() => !isTodayTraining.value)
const isCompleted = computed(() => session.value?.status === 'done')
const canEditPrep = computed(() =>
  isTodayTraining.value && (!isCompleted.value || route.query.feedbackSubmitted === '1'),
)
const completedRecord = computed(() =>
  history.records.find((record) => record.sessionId === session.value?.id) || null,
)
const actualRecord = computed(() =>
  completedRecord.value || (run.record?.sessionId === session.value?.id ? run.record : null),
)
const displayTitle = computed(() =>
  String(session.value?.title || '').replace(/\s*[（(]保守版[）)]/g, ''),
)
const coachAdvice = computed(() => {
  const key = session.value?.type === 'easy' ? 'easy' : session.value?.type
  const options = COACH_DIALOGUES[key] || COACH_DIALOGUES[session.value?.intensity?.level]
  if (options?.length) return options[coachQuoteIndex.value % options.length]
  return COACH_QUOTES[key] || COACH_QUOTES[session.value?.intensity?.level] || COACH_QUOTES.easy
})
const recordedDuration = computed(() => {
  if (!completedRecord.value?.actualDurationSec) return session.value?.durationMin || 0
  return Math.round(completedRecord.value.actualDurationSec / 60)
})
const recordedDistance = computed(() =>
  completedRecord.value?.actualDistanceKm ?? session.value?.distanceKm ?? 0,
)
const recordedPace = computed(() =>
  completedRecord.value?.avgPace || session.value?.intensity?.paceLow || 0,
)
const recordedRpe = computed(() =>
  completedRecord.value?.feedback?.rpe || session.value?.intensity?.rpe?.[0] || 0,
)
const warmupAllDone = computed(() => {
  const total = session.value?.warmup?.length || 0
  return total > 0 && ((!canEditPrep.value && isCompleted.value) || warmupDone.value.length === total)
})
const cooldownAllDone = computed(() => {
  const total = session.value?.cooldown?.length || 0
  return total > 0 && ((!canEditPrep.value && isCompleted.value) || cooldownDone.value.length === total)
})

watch(
  () => `${route.name}:${session.value?.id || ''}`,
  () => {
    const checklist = run.prepChecklist[session.value?.id] || {}
    warmupDone.value = [...(checklist.warmup || [])]
    cooldownDone.value = [...(checklist.cooldown || [])]
    const key = session.value?.type === 'easy' ? 'easy' : session.value?.type
    const options = COACH_DIALOGUES[key] || COACH_DIALOGUES[session.value?.intensity?.level] || []
    coachQuoteIndex.value = options.length ? Math.floor(Math.random() * options.length) : 0
  },
  { immediate: true },
)

function persistPrepChecklist() {
  if (!session.value) return
  run.prepChecklist[session.value.id] = {
    warmup: [...warmupDone.value],
    cooldown: [...cooldownDone.value],
  }
}

function toggle(list, index) {
  if (!canEditPrep.value) return
  const i = list.value.indexOf(index)
  if (i >= 0) list.value.splice(i, 1)
  else list.value.push(index)
  persistPrepChecklist()
}

function completeWarmup() {
  if (!canEditPrep.value) return
  warmupDone.value = (session.value?.warmup || []).map((_, index) => index)
  persistPrepChecklist()
  ui.toast('练前动态激活动作已全部完成', 'success')
}

function completeCooldown() {
  if (!canEditPrep.value) return
  cooldownDone.value = (session.value?.cooldown || []).map((_, index) => index)
  persistPrepChecklist()
  ui.toast('练后静态拉伸动作已全部完成', 'success')
}

function startRun() {
  if (!session.value) return
  if (isStrength.value) {
    ui.toast('力量课为线下完成，勾选热身与拉伸后可直接标记完成', 'info')
    return
  }
  router.push({ name: 'run-live', query: { session: session.value.id } })
}

function completeTodayTraining() {
  if (!session.value || completing.value) return
  completing.value = true

  if (run.feedback) {
    completing.value = false
    router.push('/summary')
    return
  }

  if (!run.record || run.record.sessionId !== session.value.id) {
    const pace = session.value.intensity?.paceLow || 360
    run.session = session.value
    run.record = {
      id: `rec_demo_${Date.now().toString(36)}`,
      sessionId: session.value.id,
      sessionTitle: session.value.title,
      week: session.value.week,
      date: new Date().toISOString().slice(0, 10),
      type: session.value.type,
      actualDistanceKm: session.value.distanceKm || 0,
      actualDurationSec: (session.value.durationMin || 0) * 60,
      avgPace: pace,
      bestPace: pace,
      pauseCount: 0,
      zoneSeconds: {},
    }
  }
  completing.value = false
  router.push({ name: 'feedback', query: { record: run.record.id } })
}

</script>

<template>
  <main class="min-h-screen bg-surface">
    <AppHeader
      v-if="!isTodayTraining"
      :title="isTodayTraining ? '今日训练' : '课次详情'"
      :subtitle="isTodayTraining ? '' : (session ? `第${session.week}周·${session.dayLabel}` : '')"
      :back="!isTodayTraining"
      :fixed="false"
      :show-avatar="false"
    />

    <div v-if="!session" class="px-gutter pt-20 text-center">
      <p class="text-on-surface-variant">未找到该课次。</p>
      <AppButton class="mt-4" variant="secondary" @click="router.push('/plan')">返回计划总览</AppButton>
    </div>

    <!-- 固定顶部栏高度为 64px，内容从栏下方开始，避免首张状态卡被遮挡。 -->
    <div v-else class="pb-28">
      <div class="px-gutter space-y-space-md">
        <!-- 标题 + 状态 -->
        <div class="flex items-center justify-between">
          <StatusTag tone="brand" pulse>{{ session.weekPlan.typeName }} · {{ session.weekPlan.focus }}</StatusTag>
          <StatusTag v-if="session.status === 'done'" tone="good" icon="check_circle">已完成</StatusTag>
          <StatusTag v-else-if="isReadOnly" tone="muted" icon="schedule">未开始</StatusTag>
        </div>
        <div>
          <h2 class="font-headline-lg text-headline-lg tracking-tight text-on-surface">{{ displayTitle }}</h2>
          <p v-if="!isTodayTraining" class="font-body-md text-body-md text-on-surface-variant mt-0.5">{{ session.description }}</p>
          <CoachBanner
            v-if="isTodayTraining"
            class="mt-3"
            title="智程教练 · 跑前心法"
            :text="coachAdvice"
            icon="record_voice_over"
            :tag="session.intensity.hrZone !== '—' ? session.intensity.hrZone : ''"
          />
        </div>

        <!-- 四项指标 -->
        <div class="session-metrics grid grid-cols-4 gap-space-xs bg-surface-container-lowest rounded-xl p-3 shadow-card">
          <div class="session-metric flex flex-col items-center text-center">
            <span class="session-metric-label font-label-caps text-label-caps text-on-surface-variant">{{ isCompleted ? '已记录距离' : '目标距离' }}</span>
            <div class="session-metric-value flex items-baseline gap-0.5">
              <span class="font-metric-huge-mobile text-metric-huge-mobile text-on-surface tracking-tight">
                {{ recordedDistance ? recordedDistance.toFixed(1) : '—' }}
              </span>
              <span class="font-label-data text-label-data text-on-surface-variant">公里</span>
            </div>
          </div>
          <div class="session-metric flex flex-col items-center text-center">
            <span class="session-metric-label font-label-caps text-label-caps text-on-surface-variant">{{ isCompleted ? '已记录用时' : '预估耗时' }}</span>
            <div class="session-metric-value flex items-baseline gap-0.5">
              <span class="font-metric-huge-mobile text-metric-huge-mobile text-on-surface tracking-tight">{{ recordedDuration }}</span>
              <span class="font-label-data text-label-data text-on-surface-variant">分钟</span>
            </div>
          </div>
          <div class="session-metric flex flex-col items-center text-center">
            <span class="session-metric-label font-label-caps text-label-caps text-on-surface-variant">{{ isCompleted ? '平均配速' : '目标配速' }}</span>
            <div class="session-metric-value flex items-baseline">
              <span class="session-pace-value font-headline-sm text-headline-sm text-on-surface">
                {{ recordedPace ? formatPace(recordedPace) : '—' }}
              </span>
            </div>
            <span v-if="!isCompleted" class="session-metric-note font-body-sm text-body-sm text-on-surface-variant">
              {{ session.intensity.paceHigh ? `~${formatPace(session.intensity.paceHigh)}` : '主观强度' }}
            </span>
            <span v-else class="session-metric-note font-body-sm text-body-sm text-success">已记录</span>
          </div>
          <div class="session-metric flex flex-col items-center text-center">
            <span class="session-metric-label font-label-caps text-label-caps text-on-surface-variant">{{ isCompleted ? '记录强度' : '体感强度' }}</span>
            <div class="session-metric-value flex items-baseline">
              <span class="session-intensity-value font-headline-sm text-headline-sm text-primary-container">强度 {{ recordedRpe }}</span>
            </div>
            <span class="session-metric-note font-body-sm text-body-sm" :class="isCompleted ? 'text-success' : 'text-on-surface-variant'">
              {{ isCompleted ? '已记录' : session.intensity.effort }}
            </span>
          </div>
        </div>

        <!-- 主体跑步训练：计划要求与实际完成 -->
        <section v-if="!isStrength" class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
          <div class="session-section-header flex items-center justify-between mb-2">
            <span class="flex items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface font-bold">
              <span class="section-bar" />主体跑步训练
            </span>
            <span class="font-label-data text-label-data text-on-surface-variant">
              {{ actualRecord ? '已记录' : '待记录' }}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-surface-container-low rounded-lg p-3">
              <p class="text-[11px] text-on-surface-variant mb-1">原定训练要求</p>
              <p class="text-body-sm text-on-surface leading-relaxed">
                {{ session.distanceKm ? `${session.distanceKm}公里` : '按课次完成' }} · {{ session.durationMin || '—' }}分钟
              </p>
              <p v-if="session.intensity.paceHigh" class="text-[11px] text-on-surface-variant mt-1">
                配速 {{ formatPace(session.intensity.paceLow) }}–{{ formatPace(session.intensity.paceHigh) }}/公里
              </p>
            </div>
            <div class="bg-surface-container-low rounded-lg p-3">
              <p class="text-[11px] text-on-surface-variant mb-1">实际完成情况</p>
              <p v-if="actualRecord" class="text-body-sm text-on-surface leading-relaxed">
                {{ Number(actualRecord.actualDistanceKm || 0).toFixed(1) }}公里 · {{ Math.round((actualRecord.actualDurationSec || 0) / 60) }}分钟
              </p>
              <p v-if="actualRecord?.avgPace" class="text-[11px] text-on-surface-variant mt-1">
                平均配速 {{ formatPace(actualRecord.avgPace) }}/公里
              </p>
              <p v-else class="text-body-sm text-on-surface-variant leading-relaxed">完成跑步后记录</p>
            </div>
          </div>
        </section>

        <AppButton
          v-if="isTodayTraining && !isStrength && !isCompleted"
          class="w-full"
          variant="primary"
          icon="directions_run"
          @click="startRun"
        >
          开始跑步
        </AppButton>

        <!-- 训练说明（可展开） -->
        <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
          <button
            class="session-section-header w-full flex items-center justify-between"
            type="button"
            @click="showStructure = !showStructure"
          >
            <span class="flex items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface font-bold">
              <span class="section-bar" />训练说明与结构
            </span>
            <span class="ml-auto flex items-center gap-1 font-body-sm text-body-sm text-primary">
              {{ showStructure ? '收起详情' : '展开详情' }}
              <Icon :name="showStructure ? 'expand_less' : 'expand_more'" :size="18" class="text-primary" />
            </span>
          </button>
          <div v-if="showStructure" class="pt-3 space-y-2">
            <div class="bg-surface-container-low rounded-lg p-3">
              <p class="font-body-sm text-body-sm text-on-surface leading-relaxed">
                {{ session.description }}
              </p>
              <p v-if="session.structure" class="font-body-sm text-body-sm text-primary mt-1">
                结构：{{ session.structure.pattern }}
              </p>
              <p v-if="session.structure" class="font-body-sm text-body-sm text-on-surface-variant mt-1">
                热身{{ session.structure.warmupKm }}公里（轻松）→主体{{ session.structure.mainKm }}公里（{{
                  session.structure.mainLevel === 'tempo' ? '节奏' : session.structure.mainLevel === 'interval' ? '间歇' : '目标配速'
                }}档）→放松{{ session.structure.cooldownKm }}公里（轻松）
              </p>
            </div>
            <div class="bg-surface-container-low rounded-lg p-3">
              <p class="font-label-caps text-label-caps text-on-surface-variant">强度锚点（三轨任选其一）</p>
              <div class="pt-1 space-y-1">
                <p class="text-body-sm"><span class="text-on-surface-variant">主观用力：</span>{{ session.intensity.effort }}（强度 {{ session.intensity.rpe?.[0] }}–{{ session.intensity.rpe?.[1] }}）</p>
                <p class="text-body-sm"><span class="text-on-surface-variant">心率区间：</span>{{ session.intensity.hrZone }}</p>
                <p v-if="session.intensity.paceHigh" class="text-body-sm">
                  <span class="text-on-surface-variant">配速偏移：</span>{{ formatPace(session.intensity.paceLow) }}–{{ formatPace(session.intensity.paceHigh) }}/公里
                </p>
              </div>
            </div>
            <div v-if="session.adaptationNote" class="bg-primary-fixed/60 rounded-lg p-3 flex gap-2">
              <Icon name="lightbulb" :size="16" class="text-primary shrink-0 mt-0.5" />
              <p class="text-body-sm text-on-surface leading-relaxed">适配说明：{{ session.adaptationNote }}</p>
            </div>
          </div>
        </section>

        <!-- 力量课：动作清单 -->
        <section v-if="isStrength" class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
          <div class="session-section-header flex items-center justify-between mb-2">
            <span class="flex items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface font-bold">
              <span class="w-2 h-4 rounded-full bg-secondary-container inline-block" />力量动作清单
            </span>
            <span class="font-label-data text-label-data text-secondary">{{ session.exercises?.length || 0 }} 个动作</span>
          </div>
          <div class="space-y-1.5">
            <div
              v-for="(e, i) in session.exercises || []"
              :key="i"
              class="flex items-center justify-between bg-surface-container-low rounded-lg px-3 py-2"
            >
              <span class="text-body-sm text-on-surface">{{ i + 1 }}. {{ e.name }}</span>
              <span class="font-label-data text-label-data text-on-surface-variant">{{ e.dose }}</span>
            </div>
          </div>
        </section>

        <!-- 练前动态热身 -->
        <section v-if="!isStrength" class="pt-space-sm">
          <div class="session-section-header flex items-center justify-between mb-space-xs">
            <h3 class="session-section-title-offset font-headline-sm text-headline-sm text-on-surface">
              练前动态激活
            </h3>
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-label-data text-label-data" :class="isCompleted ? 'text-success' : 'text-secondary'">
                {{ isCompleted ? '全部已记录' : `${session.preRunWarmup?.exercises?.length || session.warmup?.length || 0} 个动作 · ${session.preRunWarmup?.duration || 5} 分钟` }}
              </span>
              <button
                v-if="isTodayTraining"
                class="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
                :class="warmupAllDone ? 'bg-success-container text-on-success-container' : 'bg-primary-fixed text-primary'"
                type="button"
                :disabled="warmupAllDone"
                @click="completeWarmup"
              >
                {{ warmupAllDone ? '已完成' : '一键完成' }}
              </button>
            </div>
          </div>

          <div class="relative w-full h-32 rounded-xl overflow-hidden shadow-sm flex items-end p-3 mb-space-xs bg-inverse-surface">
            <div class="absolute inset-0 bg-gradient-to-br from-primary-container/30 via-surface-container to-inverse-surface" />
            <div class="relative z-10 w-full flex items-center justify-between">
              <div class="flex flex-col text-on-primary">
                <span class="font-body-lg text-body-lg font-bold">跑者下肢激活跟练</span>
                <span class="font-body-sm text-body-sm text-on-primary/80">避免跟腱硬拉，提升髋部活动度</span>
              </div>
              <button
                aria-label="播放跟练视频"
                class="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-lg active:scale-95"
                :class="isReadOnly ? 'opacity-50 cursor-default active:scale-100' : ''"
                type="button"
                :disabled="isReadOnly"
                @click="ui.toast('当前为演示内容，教学视频暂未接入', 'info')"
              >
                <Icon name="play_arrow" :size="24" filled />
              </button>
            </div>
          </div>

          <div class="bg-surface-container-lowest rounded-xl p-3 shadow-card flex flex-col gap-1">
            <label
              v-for="(w, i) in session.preRunWarmup?.exercises || session.warmup || []"
              :key="w.id"
              class="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer select-none"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <input
                  type="checkbox"
                  class="w-4 h-4 rounded accent-primary-container cursor-pointer shrink-0"
                  :checked="(!canEditPrep && isCompleted) || warmupDone.includes(i)"
                  :disabled="!canEditPrep"
                  @change="toggle(warmupDone, i)"
                />
                <div class="min-w-0">
                  <span class="font-body-md text-body-md text-on-surface block truncate">{{ w.name }}</span>
                  <span class="text-[10px] text-outline block truncate">{{ w.instruction || w.points }}</span>
                </div>
              </div>
              <span class="font-label-data text-label-data text-on-surface-variant shrink-0">{{ w.dose }}</span>
            </label>
            <p class="text-[11px] text-outline pt-1 leading-relaxed">
              跳过整个热身开始质量课时会弹出风险提示；疼痛、头晕、胸闷或动作导致锐痛不属于正常热身反应。
            </p>
          </div>
        </section>

        <!-- 练后静态拉伸 -->
        <section v-if="!isStrength" class="pt-space-sm">
          <div class="session-section-header flex items-center justify-between mb-space-xs">
            <h3 class="session-section-title-offset font-headline-sm text-headline-sm text-on-surface">练后静态拉伸</h3>
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-label-data text-label-data" :class="isCompleted ? 'text-success' : 'text-on-surface-variant'">
                {{ isCompleted ? '全部已记录' : `${session.postRunStretch?.exercises?.length || session.cooldown?.length || 0} 个动作 · ${session.postRunStretch?.duration || 5} 分钟` }}
              </span>
              <button
                v-if="isTodayTraining"
                class="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
                :class="cooldownAllDone ? 'bg-success-container text-on-success-container' : 'bg-primary-fixed text-primary'"
                type="button"
                :disabled="cooldownAllDone"
                @click="completeCooldown"
              >
                {{ cooldownAllDone ? '已完成' : '一键完成' }}
              </button>
            </div>
          </div>

          <div class="relative w-full h-32 rounded-xl overflow-hidden shadow-sm flex items-end p-3 mb-space-xs bg-inverse-surface">
            <div class="absolute inset-0 bg-gradient-to-br from-secondary-container/40 via-surface-container to-inverse-surface" />
            <div class="relative z-10 w-full flex items-center justify-between">
              <div class="flex flex-col text-on-primary">
                <span class="font-body-lg text-body-lg font-bold">跑后全身静态拉伸</span>
                <span class="font-body-sm text-body-sm text-on-primary/80">放松腿部肌群，帮助身体平稳恢复</span>
              </div>
              <button
                aria-label="播放拉伸教学视频"
                class="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-lg active:scale-95"
                :class="isReadOnly ? 'opacity-50 cursor-default active:scale-100' : ''"
                type="button"
                :disabled="isReadOnly"
                @click="ui.toast('当前为演示内容，教学视频暂未接入', 'info')"
              >
                <Icon name="play_arrow" :size="24" filled />
              </button>
            </div>
          </div>

          <div class="bg-surface-container-lowest rounded-xl p-3 shadow-card flex flex-col gap-1">
            <label
              v-for="(c, i) in session.postRunStretch?.exercises || session.cooldown || []"
              :key="c.id"
              class="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer select-none"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <input
                  type="checkbox"
                  class="w-4 h-4 rounded accent-primary-container cursor-pointer shrink-0"
                  :checked="(!canEditPrep && isCompleted) || cooldownDone.includes(i)"
                  :disabled="!canEditPrep"
                  :aria-label="`完成${c.name}`"
                  @change="toggle(cooldownDone, i)"
                />
                <div class="min-w-0">
                  <span class="font-body-md text-body-md text-on-surface block truncate">{{ c.name }}</span>
                  <span class="text-[10px] text-outline truncate block">{{ c.points }}</span>
                </div>
              </div>
              <span class="font-label-data text-label-data text-on-surface-variant shrink-0">{{ c.dose }}</span>
            </label>
          </div>
        </section>

        <!-- 安全提示：训练中止标准（PRD §5.5.2） -->
        <section class="pt-space-xs">
          <div class="bg-error-container/70 rounded-xl p-3 shadow-sm">
            <div class="flex items-start gap-space-sm">
              <div class="w-7 h-7 rounded-full bg-error flex-shrink-0 flex items-center justify-center text-on-error shadow-sm mt-0.5">
                <Icon name="warning" :size="16" />
              </div>
              <div class="flex-1 min-w-0">
                <span class="font-label-caps text-label-caps text-on-error-container uppercase tracking-wider">安全第一防线</span>
                <p class="font-body-sm text-body-sm text-on-error-container mt-0.5 leading-snug">
                  若奔跑中出现以下任一信号，请立即转为慢走并终止训练。
                </p>
                <ul class="mt-1.5 space-y-1">
                  <li
                    v-for="signal in STOP_SIGNALS"
                    :key="signal"
                    class="flex items-start gap-1.5 font-body-sm text-body-sm text-on-error-container leading-snug"
                  >
                    <Icon name="stop_circle" :size="13" class="shrink-0 mt-0.5" />
                    <span>{{ signal }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <AppButton
          v-if="isTodayTraining"
          class="w-full"
          variant="secondary"
          icon="task_alt"
          :disabled="completing"
          @click="completeTodayTraining"
        >
          {{ completing ? '正在生成训练总结…' : '完成当日训练' }}
        </AppButton>
      </div>

    </div>
  </main>
</template>

<style scoped>
.session-metrics {
  align-items: stretch;
}

.session-metric {
  min-width: 0;
}

.session-section-header {
  min-height: 28px;
}

.session-section-title-offset {
  padding-left: 14px;
}

.session-section-header > :last-child {
  white-space: nowrap;
  text-align: right;
}

.session-metric-label {
  height: 20px;
  line-height: 20px;
  white-space: nowrap;
}

.session-metric-value {
  height: 44px;
  align-items: center;
  white-space: nowrap;
}

.session-metric-value > .font-metric-huge-mobile {
  font-size: 30px;
  line-height: 34px;
  letter-spacing: -0.02em;
}

.session-metric-value > .font-label-data {
  font-size: 13px;
  line-height: 18px;
  letter-spacing: 0;
}

.session-metric-note {
  height: 24px;
  line-height: 24px;
  white-space: nowrap;
}

.session-pace-value {
  font-size: 22px;
  line-height: 28px;
  font-weight: 700;
}

.session-intensity-value {
  font-size: 20px;
  line-height: 26px;
  white-space: nowrap;
}

@media (max-width: 380px) {
  .session-metrics {
    padding-inline: 8px;
  }

  .session-metric-label {
    font-size: 9px;
  }

  .session-pace-value {
    font-size: 19px;
  }

  .session-intensity-value {
    font-size: 18px;
  }
}
</style>
