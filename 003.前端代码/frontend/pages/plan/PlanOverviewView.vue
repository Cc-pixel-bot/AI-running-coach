<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlanStore } from '../../stores/plan.js'
import { useProfileStore } from '../../stores/profile.js'
import Icon from '../../components/ui/Icon.vue'
import WeekCalendar from '../../components/plan/WeekCalendar.vue'
import ZoneBar from '../../components/plan/ZoneBar.vue'
import SessionCard from '../../components/plan/SessionCard.vue'
import AppButton from '../../components/ui/AppButton.vue'
import { PLAN_TEMPLATE_REVISION } from '../../domain/engine/planEngine.js'
import { save } from '../../services/storage.js'
import planTrackHero from '../../assets/plan-track-hero.png'
import { formatClock } from '../../domain/utils/pace.js'

const router = useRouter()
const planStore = usePlanStore()
const profile = useProfileStore()

const selectedWeek = ref(1)
const showCycleDetails = ref(false)
const showAdaptationDetails = ref(false)
const showWeekPicker = ref(false)

const plan = computed(() => planStore.plan)
const week = computed(() => plan.value?.weeks?.find((w) => w.week === selectedWeek.value) || plan.value?.weeks?.[0])

/** 今日待练：当前周第一个未完成的课次 */
const todaySessionId = computed(() => {
  const currentWeek = plan.value?.weeks?.find((w) => w.week === plan.value.currentWeek)
  return currentWeek?.sessions?.find((s) => s.status === 'pending')?.id || null
})

const currentWeekDoneCount = computed(
  () => week.value?.sessions?.filter((session) => session.status === 'done').length || 0,
)
const currentWeekSessionCount = computed(() => week.value?.sessions?.length || 0)
const currentBestTotal = computed(() => {
  const pace = Number(profile.draft.best10kPace)
  const distance = plan.value?.targetDistance === '5K' ? 5 : plan.value?.targetDistance === 'HM' ? 21.0975 : plan.value?.targetDistance === 'MARATHON' ? 42.195 : 10
  return pace > 0 ? Math.round(pace * distance) : null
})
const targetTotal = computed(() => plan.value?.goalTotalSec || null)

// 旧版计划已缓存时，自动用当前模板重建，避免用户继续看到旧的重复课程。
onMounted(async () => {
  if (
    planStore.plan?.templateId !== 'T10-8W' ||
    planStore.plan?.templateRevision === PLAN_TEMPLATE_REVISION ||
    !Object.keys(profile.draft || {}).length
  ) return

  const previousPlan = planStore.plan
  const previousWeek = previousPlan.currentWeek || 1
  const previousStatus = previousPlan.status
  const previousConfirmed = planStore.confirmed
  const refreshed = await planStore.generate(profile.toEngineProfile(), { templateId: 'T10-8W' })

  if (!refreshed.blocked) {
    planStore.plan.currentWeek = Math.min(previousWeek, planStore.plan.totalWeeks)
    planStore.plan.status = previousStatus
    planStore.confirmed = previousConfirmed
    save('plan', planStore.plan)
    save('planConfirmed', previousConfirmed)
  }
})

function selectWeek(w) {
  selectedWeek.value = w
  showWeekPicker.value = false
}

function openSession(session) {
  if (session.id === todaySessionId.value) {
    router.push('/run/prep')
    return
  }
  router.push({ name: 'session-detail', params: { id: session.id } })
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
              <span>{{ plan.totalWeeks }}周 · 每周{{ currentWeekSessionCount }}课 · 第{{ plan.currentWeek }}周进行中</span>
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
            <button
              class="flex items-center gap-1 text-primary-container font-body-sm text-body-sm font-medium"
              type="button"
              @click="showCycleDetails = !showCycleDetails"
            >
              <Icon :name="showCycleDetails ? 'expand_less' : 'expand_more'" :size="16" />
              {{ showCycleDetails ? '收起具体信息' : '展开具体信息' }}
            </button>
          </div>
          <WeekCalendar :weeks="plan.weeks" :current-week="plan.currentWeek" />
          <div v-if="showCycleDetails" class="pt-3 grid grid-cols-2 gap-2">
            <button
              v-for="w in plan.weeks"
              :key="w.week"
              class="px-2 py-1.5 rounded-lg text-left font-label-data text-label-data transition-colors"
              :class="selectedWeek === w.week ? 'bg-primary-container text-on-primary' : 'bg-surface-container-low text-on-surface-variant'"
              type="button"
              @click="selectWeek(w.week)"
            >
                第{{ w.week }}周 · {{ w.targetKm }}公里
            </button>
          </div>
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
              <div class="relative shrink-0">
                <button
                  class="flex items-center gap-0.5 text-primary-container font-body-sm text-body-sm font-medium"
                  type="button"
                  aria-label="选择训练周"
                  @click="showWeekPicker = !showWeekPicker"
                >
                  第{{ week.week }}周
                  <Icon :name="showWeekPicker ? 'expand_less' : 'expand_more'" :size="17" />
                </button>
                <div
                  v-if="showWeekPicker"
                  class="absolute left-0 top-7 z-20 w-32 p-1.5 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-card-lg"
                >
                  <button
                    v-for="w in plan.weeks"
                    :key="w.week"
                    class="w-full px-2.5 py-2 rounded-lg text-left text-xs transition-colors"
                    :class="selectedWeek === w.week ? 'bg-primary-container text-on-primary font-bold' : 'text-on-surface hover:bg-surface-container'"
                    type="button"
                    @click="selectWeek(w.week)"
                  >
                    第{{ w.week }}周
                  </button>
                </div>
              </div>
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
          <div class="flex items-start justify-between gap-2">
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
            <button
              class="flex items-center gap-1 text-primary-container font-body-sm text-body-sm font-medium shrink-0"
              type="button"
              @click="showAdaptationDetails = !showAdaptationDetails"
            >
              <Icon :name="showAdaptationDetails ? 'expand_less' : 'expand_more'" :size="16" />
              {{ showAdaptationDetails ? '收起' : '展开具体信息' }}
            </button>
          </div>

          <div class="pt-space-sm space-y-2">
            <div
              v-for="item in showAdaptationDetails ? plan.adaptationSummary : plan.adaptationSummary.slice(0, 1)"
              :key="item.title"
              class="p-2.5 rounded-lg bg-surface-container-lowest/80 flex gap-2"
            >
              <Icon :name="item.icon" :size="16" class="text-primary shrink-0 mt-0.5" />
              <div class="min-w-0">
                <p class="plan-summary-text font-body-sm text-body-sm text-primary font-medium">{{ item.title }}</p>
                <p class="plan-explanation text-body-sm text-on-surface leading-relaxed mt-0.5">{{ item.text }}</p>
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
