<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '../../stores/profile.js'
import { usePlanStore } from '../../stores/plan.js'
import { useUiStore } from '../../stores/ui.js'
import AppButton from '../../components/ui/AppButton.vue'
import Icon from '../../components/ui/Icon.vue'
import coachAvatar from '../../assets/coach-avatar.png'
import { formatClock, formatPace } from '../../domain/utils/pace.js'

const router = useRouter()
const profile = useProfileStore()
const plan = usePlanStore()
const ui = useUiStore()
const loading = ref(false)
const errorMessage = ref('')

const targetDistance = computed(() => '10K')
const targetDistanceLabel = computed(() => '10公里')
const targetTime = computed(() => profile.targetTotalSec ? formatClock(profile.targetTotalSec) : '—')
const targetPace = computed(() => profile.targetPace ? `${formatPace(profile.targetPace)}/公里` : '—')
const baseline = computed(() => {
  const pace = profile.draft.best10kPace
  return pace ? formatClock(pace * 10) : '暂无成绩'
})
const weeklySummary = computed(() => `${profile.draft.availableDays || 3}天训练 · ${profile.draft.weeklyKm || 0}公里起步`)

onMounted(() => {
  if (!profile.targetTotalSec) router.replace('/profile/confirm')
})

async function confirmPlan() {
  if (loading.value) return
  errorMessage.value = ''
  loading.value = true
  const result = await plan.generate(profile.toEngineProfile())
  if (result.blocked) {
    loading.value = false
    errorMessage.value = '当前风险筛查未通过，暂时无法生成训练计划。请返回档案确认页检查运动风险信息。'
    ui.toast('当前风险筛查未通过，暂不能生成训练计划', 'error')
    return
  }
  plan.confirmPlan()
  loading.value = false
  ui.toast('训练计划已确认，开始执行', 'success')
  router.push('/plan')
}
</script>

<template>
  <main class="min-h-screen bg-surface pb-8">
    <header class="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high/60">
      <div class="h-14 px-gutter flex items-center gap-2">
        <button
          aria-label="返回档案确认"
          class="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container active:scale-95"
          type="button"
          @click="router.push('/profile/confirm')"
        >
          <Icon name="arrow_back" :size="24" />
        </button>
        <h1 class="font-headline-sm text-headline-sm text-on-surface truncate">AI训练计划确认</h1>
      </div>
    </header>

    <div class="px-gutter pt-4 pb-8 space-y-4">
      <section class="rounded-2xl bg-gradient-to-br from-[#FFF3E8] to-white border border-primary-container/20 p-4 shadow-card">
        <div class="flex items-center gap-2 text-primary mb-2">
          <div class="w-9 h-9 rounded-full overflow-hidden border-2 border-primary-container/30 bg-white shrink-0">
            <img :src="coachAvatar" alt="智程头像" class="w-full h-full object-cover" />
          </div>
          <span class="font-label-data text-label-data">智程为你生成</span>
        </div>
        <h2 class="font-headline-lg text-headline-lg text-on-surface">{{ targetDistanceLabel }}专项训练计划</h2>
        <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">根据你的目标成绩、跑量基础和可训练时间生成。</p>
      </section>

      <section class="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-headline-sm text-headline-sm text-on-surface">核心训练指标</h2>
          <span class="font-label-data text-label-data text-primary bg-primary-fixed px-2 py-1 rounded-full">8周周期</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl bg-surface-container-low p-3">
            <span class="text-body-sm text-body-sm text-on-surface-variant">当前最好成绩</span>
            <p class="font-headline-md text-headline-md text-on-surface mt-1">{{ baseline }}</p>
          </div>
          <div class="rounded-xl bg-primary-fixed/60 p-3">
            <span class="text-body-sm text-body-sm text-on-surface-variant">计划目标成绩</span>
            <p class="font-headline-md text-headline-md text-primary mt-1">{{ targetTime }}</p>
          </div>
          <div class="rounded-xl bg-surface-container-low p-3">
            <span class="text-body-sm text-body-sm text-on-surface-variant">目标配速</span>
            <p class="font-headline-sm text-headline-sm text-on-surface mt-1">{{ targetPace }}</p>
          </div>
          <div class="rounded-xl bg-surface-container-low p-3">
            <span class="text-body-sm text-body-sm text-on-surface-variant">训练安排</span>
            <p class="font-headline-sm text-headline-sm text-on-surface mt-1">{{ weeklySummary }}</p>
          </div>
        </div>
      </section>

      <section v-if="errorMessage" class="rounded-2xl bg-error-container p-4 text-on-error-container">
        <div class="flex items-start gap-2">
          <Icon name="warning" :size="20" class="shrink-0 mt-0.5" />
          <p class="font-body-sm text-body-sm leading-relaxed">{{ errorMessage }}</p>
        </div>
      </section>

      <section class="bg-surface-container-lowest rounded-2xl p-4 shadow-card space-y-3">
        <h2 class="font-headline-sm text-headline-sm text-on-surface">计划怎么帮助你进步</h2>
        <div class="flex items-start gap-2">
          <Icon name="trending_up" :size="18" class="text-primary shrink-0 mt-0.5" />
          <p class="font-body-sm text-body-sm text-on-surface-variant">逐步增加有效跑量，让耐力和配速一起提升。</p>
        </div>
        <div class="flex items-start gap-2">
          <Icon name="shield" :size="18" class="text-secondary shrink-0 mt-0.5" />
          <p class="font-body-sm text-body-sm text-on-surface-variant">安排恢复与力量训练，控制训练负荷和运动风险。</p>
        </div>
      </section>

      <div class="space-y-2 pt-1">
        <AppButton variant="primary" :disabled="loading" icon="check_circle" @click="confirmPlan">
          {{ loading ? '智程正在生成计划…' : '确认计划' }}
        </AppButton>
        <AppButton variant="secondary" @click="router.push('/profile/confirm')">返回修改档案</AppButton>
      </div>
    </div>
  </main>
</template>
