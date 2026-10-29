<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlanStore } from '../../stores/plan.js'
import { useProfileStore } from '../../stores/profile.js'
import { useUiStore } from '../../stores/ui.js'
import Icon from '../../components/ui/Icon.vue'
import WeekCalendar from '../../components/plan/WeekCalendar.vue'
import ZoneBar from '../../components/plan/ZoneBar.vue'
import WeekIntensityLine from '../../components/plan/WeekIntensityLine.vue'
import SessionCard from '../../components/plan/SessionCard.vue'
import AppButton from '../../components/ui/AppButton.vue'
import planTrackHero from '../../assets/plan-track-hero.png'
import { formatClock } from '../../domain/utils/pace.js'

const router = useRouter()
const planStore = usePlanStore()
const profile = useProfileStore()
const ui = useUiStore()

const selectedWeek = ref(null)

const plan = computed(() => planStore.plan)
const defaultWeek = computed(() => planStore.upcomingSessions[0]?.week || plan.value?.currentWeek || 1)
const week = computed(() => plan.value?.weeks?.find((w) => w.week === (selectedWeek.value || defaultWeek.value)) || plan.value?.weeks?.[0])

/** 今日待练：当前周第一个未完成的课次 */
const todaySessionId = computed(() => {
  const currentWeek = plan.value?.weeks?.find((w) => w.week === plan.value.currentWeek)
  return currentWeek?.sessions?.find((s) => s.status === 'pending')?.id || null
})

const currentWeekDoneCount = computed(
  () => week.value?.sessions?.filter((session) => session.status === 'done').length || 0,
)
const currentWeekSessionCount = computed(() => week.value?.sessions?.length || 0)
const currentWeekRunCount = computed(
  () => week.value?.sessions?.filter((session) => session.type !== 'strength').length || 0,
)
const currentWeekAuxCount = computed(
  () => week.value?.sessions?.filter((session) => session.type === 'strength').length || 0,
)
const currentBestTotal = computed(() => {
  const pace = Number(profile.draft.best10kPace)
  const distance = plan.value?.targetDistance === '5K' ? 5 : plan.value?.targetDistance === 'HM' ? 21.0975 : plan.value?.targetDistance === 'MARATHON' ? 42.195 : 10
  return pace > 0 ? Math.round(pace * distance) : null
})
const targetTotal = computed(() => plan.value?.goalTotalSec || null)
const needsConfirmation = computed(() => plan.value?.status === 'pending_confirm')
const confirming = ref(false)
const aiAdjustmentNote = computed(() => planStore.latestAdjustmentSummary)
function formatSessionRefs(text) {
  return String(text || '').replace(/\bw(\d+)s(\d+)\b/gi, '第$1周第$2节')
}

function selectWeek(w) {
  selectedWeek.value = w
}

function openSession(session) {
  if (needsConfirmation.value) {
    ui.toast('请先确认训练计划，再开始训练', 'info')
    return
  }
  if (session.id === todaySessionId.value) {
    router.push('/run/prep')
    return
  }
  router.push({ name: 'session-detail', params: { id: session.id } })
}

async function confirmCurrentPlan() {
  if (confirming.value || !needsConfirmation.value) return
  confirming.value = true
  try {
    await planStore.confirmPlan()
    ui.toast('训练计划已确认，可以开始训练', 'success')
  } catch (error) {
    ui.toast(error.message || '计划确认失败，请稍后重试', 'error')
  } finally {
    confirming.value = false
  }
}
</script>

<template>
  <main class="plan-overview min-h-screen bg-surface">
    <div v-if="!plan" class="px-gutter pt-20 pb-10 text-center space-y-4">
      <div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto" aria-hidden="true">
        <span class="w-8 h-8 rounded-md border-2 border-outline flex items-end justify-center pb-0.5 text-[10px] font-semibold text-on-surface-variant">日程</span>
      </div>
      <p class="text-on-surface-variant">还没有训练计划，先完成档案建档吧。</p>
      <AppButton variant="primary" @click="router.push(profile.confirmed ? '/profile/confirm' : '/profile')">
        {{ profile.confirmed ? '去确认档案' : '开始科学建档' }}
      </AppButton>
    </div>

    <div v-else class="pb-24">
      <div class="px-gutter space-y-space-md">
        <section v-if="needsConfirmation" class="rounded-2xl bg-primary-fixed border border-primary-container/30 p-4 shadow-card">
          <div class="flex items-start gap-2">
            <Icon name="fact_check" :size="20" class="text-primary shrink-0 mt-0.5" />
            <div class="flex-1">
              <h2 class="font-headline-sm text-headline-sm text-on-surface">计划已生成，等待你的确认</h2>
              <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">确认后才会进入训练执行和 GPS 记录流程。</p>
              <AppButton class="mt-3" variant="primary" :disabled="confirming" @click="confirmCurrentPlan">
                {{ confirming ? '正在确认…' : '确认并开始执行' }}
              </AppButton>
            </div>
          </div>
        </section>
        <!-- 1. 训练效果卡：展示从当前基础到目标成绩的提升路径 -->
        <section
          class="keep-plan-card relative overflow-hidden rounded-2xl p-5 shadow-card-lg"
          :style="{ backgroundImage: `linear-gradient(90deg, rgba(91, 32, 0, .9) 0%, rgba(91, 32, 0, .68) 44%, rgba(91, 32, 0, .18) 100%), url(${planTrackHero})` }"
        >
          <div class="absolute -right-10 -top-10 w-40 h-40 rounded-full border-[16px] border-white/10" aria-hidden="true" />
          <div class="relative">
            <span class="inline-flex px-3 py-1 rounded-full bg-[#ffd28f] text-[#5d3000] font-label-caps text-label-caps font-bold">
              智程为你定制
            </span>
            <h1 class="mt-4 font-headline-lg text-headline-lg text-white leading-tight">
              {{ plan.targetDistance === '10K' ? '10公里专项提升计划' : `${plan.targetDistance}专项训练计划` }}
            </h1>
            <p class="mt-2 text-body-lg text-white/75 leading-relaxed">
              稳步提升耐力与配速，把每一次完成都变成更接近目标的一步。
            </p>
            <div class="mt-4 flex items-center gap-2 text-white/75 text-body-sm">
              <Icon name="event" :size="17" />
              <span>
                {{ plan.totalWeeks }}周 · 每周{{ currentWeekRunCount }}次跑步
                <template v-if="currentWeekAuxCount">· {{ currentWeekAuxCount }}次辅助训练</template>
                · 第{{ plan.currentWeek }}周进行中
              </span>
            </div>

            <div class="mt-5 rounded-xl bg-black/15 border border-white/10 p-4">
              <p class="font-headline-sm text-headline-sm text-white">全程训练效果</p>
              <div class="mt-3 flex items-end justify-between gap-3">
                <div>
                  <span class="block text-body-sm text-white/65">当前最好成绩</span>
                  <strong class="font-score-card block mt-1 font-headline-lg text-headline-lg text-white">
                    {{ currentBestTotal ? formatClock(currentBestTotal) : '暂无记录' }}
                  </strong>
                </div>
                <Icon name="trending_down" :size="22" class="mb-2 text-[#ffd28f]" />
                <div class="text-right">
                  <span class="block text-body-sm text-white/65">计划目标成绩</span>
                  <strong class="font-score-card block mt-1 font-headline-lg text-headline-lg text-[#ffd28f]">
                    {{ targetTotal ? formatClock(targetTotal) : '待设定' }}
                  </strong>
                </div>
              </div>
              <p class="mt-3 text-body-sm text-white/65 leading-relaxed">
                通过 {{ plan.totalWeeks }} 周循序训练，逐步提升耐力、配速与稳定完成能力。
              </p>
            </div>

            <router-link
              to="/run/prep"
              class="mt-5 w-full min-h-12 rounded-full bg-[#ffd28f] text-[#2d2118] font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform"
            >
              <Icon name="play_arrow" :size="22" />开始训练
            </router-link>
          </div>
        </section>

        <!-- 2. 周期周历 -->
        <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
          <div class="flex items-center justify-between mb-space-sm">
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-4 bg-primary-container rounded-full" />
              <h2 class="font-headline-sm text-headline-sm text-on-surface">阶段进阶全貌</h2>
            </div>
          </div>
          <WeekCalendar :weeks="plan.weeks" :current-week="plan.currentWeek" @select="selectWeek" />
        <!-- 3. 强度分布 -->
        <div class="mt-3 pt-3 border-t border-surface-container">
          <div class="flex items-center justify-between mb-space-sm">
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-4 bg-secondary-container rounded-full" />
              <h2 class="font-headline-sm text-headline-sm text-on-surface">强度分布</h2>
            </div>
            <span class="plan-summary-text font-label-data text-label-data text-on-surface-variant">全周期 {{ plan.totalKm }}公里</span>
          </div>
          <ZoneBar :zones="plan.zoneDistribution" />
          <WeekIntensityLine :weeks="plan.weeks" />
        </div>
        </section>

        <!-- 3. 第一周训练计划 -->
        <section class="space-y-space-xs">
          <div class="flex items-center justify-between px-0.5">
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-4 bg-primary-container rounded-full" />
              <h2 class="font-headline-sm text-headline-sm text-on-surface">
                {{ week.week === 1 ? '第一周训练计划' : `第${week.week}周训练计划` }}
              </h2>
            </div>
            <span class="plan-summary-text font-body-sm text-body-sm text-on-surface-variant">
              共{{ week.sessions.length }}课次 · 目标{{ week.targetKm }}公里
            </span>
          </div>

          <div
            v-for="s in week.sessions"
            :key="s.id"
            class="cursor-pointer"
            @click="openSession(s)"
          >
            <SessionCard :session="s" :week="week" :status="s.status" :today="s.id === todaySessionId" />
          </div>
        </section>

        <!-- 4. AI 适配说明 -->
        <section class="bg-surface-container-low rounded-xl p-space-md shadow-card relative overflow-hidden">
          <div class="flex items-start gap-2">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                <Icon name="psychology" :size="18" />
              </div>
              <div>
                <div class="flex items-center gap-1.5">
              <h3 class="font-headline-sm text-[16px] text-on-surface">智能动态调整说明</h3>
                </div>
              </div>
            </div>
          </div>

          <div class="pt-space-sm space-y-2">
            <div v-if="aiAdjustmentNote" class="p-2.5 rounded-lg bg-primary-fixed/60 flex gap-2">
              <Icon name="auto_awesome" :size="16" class="text-primary shrink-0 mt-0.5" />
              <div class="min-w-0">
                <p class="plan-summary-text font-body-sm text-body-sm text-primary font-medium">本次 AI 调整说明</p>
                <p class="plan-explanation text-body-sm text-on-surface leading-relaxed mt-0.5">{{ formatSessionRefs(aiAdjustmentNote.summary || '智程已结合本次反馈更新后续训练安排。') }}</p>
                <p v-if="aiAdjustmentNote.followUp?.holdCondition" class="text-body-sm text-on-surface-variant leading-relaxed mt-1">接下来关注：{{ formatSessionRefs(aiAdjustmentNote.followUp.holdCondition) }}</p>
              </div>
            </div>
            <div v-else class="p-2.5 rounded-lg bg-surface-container-lowest/80 flex gap-2">
              <Icon name="psychology" :size="16" class="text-primary shrink-0 mt-0.5" />
              <div class="min-w-0">
                <p class="plan-summary-text font-body-sm text-body-sm text-primary font-medium">当前计划说明</p>
                <p class="plan-explanation text-body-sm text-on-surface leading-relaxed mt-0.5">智程教练会根据你的身体数据，运动基础，伤病情况定制专属训练计划。</p>
              </div>
            </div>
          </div>

        </section>

        <p class="disclaimer pt-1">
          本产品提供训练信息与建议，不构成医疗建议。开始或修改运动计划前，请咨询有资质的医疗专业人员。
        </p>
      </div>
    </div>
  </main>
</template>
