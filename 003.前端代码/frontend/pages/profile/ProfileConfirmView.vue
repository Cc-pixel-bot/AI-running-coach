<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '../../stores/profile.js'
import { useUiStore } from '../../stores/ui.js'
import { useAuthStore } from '../../stores/auth.js'
import Icon from '../../components/ui/Icon.vue'
import coachAvatar from '../../assets/coach-avatar.png'
import AppButton from '../../components/ui/AppButton.vue'
import StatusTag from '../../components/ui/StatusTag.vue'
import { formatPace, formatClock } from '../../domain/utils/pace.js'

const router = useRouter()
const profile = useProfileStore()
const ui = useUiStore()
const auth = useAuthStore()

const d = computed(() => profile.draft)
const screening = computed(() => profile.screeningResult)

onMounted(async () => {
  try {
    const loaded = await profile.loadFromServer(auth.token)
    if (!loaded) {
      ui.toast('暂未找到跑者档案，请先完成建档', 'warn')
      router.replace('/profile')
    }
  } catch (error) {
    ui.toast(error.message || '档案加载失败，请稍后重试', 'error')
  }
})

const cards = computed(() => [
  {
    key: 'basis',
    icon: 'person',
    title: '基础体征',
    editTo: '/profile',
    groups: [
      {
        label: '性别 · 年龄',
        value: `${d.value.gender === 'male' ? '男' : d.value.gender === 'female' ? '女' : '—'} / ${profile.age ?? '—'}岁`,
      },
      { label: '身高 · 体重', value: `${d.value.heightCm ?? '—'}cm / ${d.value.weightKg ?? '—'}kg` },
      { label: 'BMI 指数', value: `${profile.bmi ?? '--'}`, tag: profile.bmiLevel.label, tone: profile.bmiLevel.tone },
    ],
  },
  {
    key: 'target',
    icon: 'flag',
    title: '核心训练目标',
    editTo: '/profile',
    rows: [
      {
        label: '目标周期项目',
        value: `${profile.targetTypeMeta?.label ?? '—'} · ${profile.targetTypeMeta?.weeks ?? '—'}周`,
      },
      {
        label: '目标完赛用时',
        value: profile.targetTotalSec ? formatClock(profile.targetTotalSec) : '—',
      },
      {
        label: '目标巡航配速',
        value: profile.targetPace ? `${formatPace(profile.targetPace)}/公里` : '—',
      },
    ],
  },
  {
    key: 'base',
    icon: 'directions_run',
    title: '跑步与跑量基础',
    editTo: '/profile',
    rows: [
      { label: '近3个月周跑量', value: `${d.value.weeklyKm ?? '—'}公里` },
      { label: '舒适慢跑配速', value: d.value.easyPace ? `${formatPace(d.value.easyPace)}/公里` : '系统推测' },
      { label: '最好成绩', value: d.value.best10kPace ? `10公里 / ${formatClock(d.value.best10kPace * 10)}` : '暂无记录' },
      { label: '最长单次', value: `${d.value.longestRunKm ?? '—'} 公里` },
    ],
  },
  {
    key: 'condition',
    icon: 'health_and_safety',
    title: '身体状况与伤病筛查',
    editTo: '/profile',
    rows: [
      {
        label: '伤病记录',
        value: (d.value.injuries || []).length ? (d.value.injuries || []).map((i) => i.part).join('、') : '无任何不适',
        danger: (d.value.injuries || []).length > 0,
      },
      {
        label: '风险筛查',
        value: { low: '筛查通过 · 正常生成', moderate: '训练基础待建立 · 前2周保守', medical_confirm: '需医疗确认' }[screening.value.riskLevel],
        danger: screening.value.riskLevel === 'medical_confirm',
        warn: screening.value.riskLevel === 'moderate',
      },
    ],
  },
  {
    key: 'training',
    icon: 'calendar_today',
    title: '训练条件与场地',
    editTo: '/profile',
    groups: [
      { label: '每周训练', value: `${d.value.availableDays ?? '—'} 天` },
      { label: '单次时长', value: `${d.value.availableMin ?? '—'} 分` },
      { label: '主要场地', value: Array.isArray(d.value.terrain) ? d.value.terrain.join('、') || '—' : d.value.terrain || '—' },
    ],
  },
])

function editCard(card) {
  router.push({ path: card.editTo, query: { focus: card.key } })
}

async function handleGeneratePlan() {
  if (screening.value.riskLevel === 'medical_confirm') {
    ui.openModal({
      icon: 'medical_services',
      title: '需要先就医确认',
      body: `${screening.value.summary}\n\n${screening.value.actions.join('\n')}`,
      confirmText: '我知道了',
    })
    return
  }
  try {
    await profile.confirmOnServer(auth.token)
    router.push('/profile/plan-confirm')
  } catch (error) {
    ui.toast(error.message || '档案确认失败，请稍后重试', 'error')
  }
}
</script>

<template>
  <main class="min-h-screen bg-surface pb-10">
    <header class="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high/60">
      <div class="h-14 px-gutter flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button
            aria-label="返回"
            class="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container active:scale-95"
            type="button"
            @click="router.push('/profile')"
          >
            <Icon name="arrow_back" :size="24" />
          </button>
          <h1 class="font-headline-sm text-headline-sm text-on-surface tracking-tight truncate">跑者档案确认卡</h1>
        </div>
        <div class="w-8 h-8 rounded-full bg-primary-container/15 flex items-center justify-center">
          <Icon name="verified" :size="18" class="text-primary-container" />
        </div>
      </div>
    </header>

    <div class="px-gutter pt-3 pb-6 space-y-3">
      <!-- AI 教练气泡，与建档页保持一致 -->
      <section class="bg-surface-container-lowest p-4 rounded-2xl shadow-card border border-outline-variant/30 flex items-start gap-3">
        <div class="w-12 h-12 rounded-full overflow-hidden bg-white shrink-0">
          <img :src="coachAvatar" alt="智程头像" class="w-full h-full object-cover" />
        </div>
        <div class="flex-1 space-y-1.5 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-headline-sm text-sm text-on-surface font-bold">智程</span>
              <span class="px-2 py-0.5 rounded-full bg-[#FFF3E8] text-[#FF7A00] font-bold text-[11px] flex items-center gap-1">
              <Icon name="smart_toy" :size="12" filled /> 专属跑步教练
            </span>
            <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60 font-medium text-[11px] flex items-center gap-1">
              <Icon name="verified_user" :size="12" /> 科学规避伤病
            </span>
          </div>
          <p class="font-body-md text-xs leading-relaxed text-on-surface/90">
            档案信息已经整理完成，请核对下方内容。确认后，我会根据你的训练目标、跑量基础和风险筛查结果生成专属训练计划。
          </p>
        </div>
      </section>

      <!-- 筛查闸门提示 -->
      <div
        class="rounded-xl p-3 flex items-start gap-2"
        :class="{
          'bg-success-container/60': screening.riskLevel === 'low',
          'bg-primary-fixed': screening.riskLevel === 'moderate',
          'bg-error-container': screening.riskLevel === 'medical_confirm',
        }"
      >
        <Icon
          :name="screening.riskLevel === 'low' ? 'verified_user' : screening.riskLevel === 'moderate' ? 'info' : 'warning'"
          :size="18"
          class="shrink-0 mt-0.5"
          :class="screening.riskLevel === 'medical_confirm' ? 'text-error' : 'text-primary'"
        />
        <div class="text-xs leading-snug">
          <p class="font-bold text-on-surface">运动前筛查：{{ screening.riskLevel === 'low' ? '筛查通过' : screening.riskLevel === 'moderate' ? '训练基础待建立' : '需医疗确认' }}</p>
          <p class="text-on-surface-variant mt-0.5">{{ screening.summary }}</p>
        </div>
      </div>

      <!-- 分组卡片 -->
      <div
        v-for="card in cards"
        :key="card.key"
        class="group cursor-pointer bg-surface-container-lowest rounded-2xl border border-surface-container-high hover:border-primary-container/60 active:scale-[0.99] transition-all p-3.5 shadow-card hover:shadow-card-lg"
        role="button"
        tabindex="0"
        @click="editCard(card)"
      >
        <div class="flex items-center justify-between pb-2 border-b border-surface-container-high/60">
          <div class="flex items-center gap-2">
            <div class="w-6.5 h-6.5 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary-container">
              <Icon :name="card.icon" :size="17" />
            </div>
            <h2 class="font-headline-sm text-[15px] text-on-surface font-bold">{{ card.title }}</h2>
          </div>
          <div class="flex items-center gap-0.5 text-primary-container font-body-sm text-[12px] font-semibold">
            <Icon name="edit" :size="14" />修改<Icon name="chevron_right" :size="15" />
          </div>
        </div>

        <div v-if="card.groups" class="pt-2.5 grid grid-cols-3 gap-2">
          <div v-for="g in card.groups" :key="g.label" class="bg-surface-container-low/60 rounded-xl p-2 text-center">
            <span class="font-label-caps text-label-caps text-outline block">{{ g.label }}</span>
            <p class="font-headline-sm text-[17px] text-on-surface mt-0.5 font-bold">{{ g.value }}</p>
            <span
              v-if="g.tag"
              class="inline-block mt-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold"
              :class="{
                'bg-emerald-100 text-emerald-700': g.tone === 'good',
                'bg-amber-100 text-amber-700': g.tone === 'warn',
                'bg-error-container text-on-error-container': g.tone === 'danger',
                'bg-info-container text-info': g.tone === 'info',
              }"
            >
              {{ g.tag }}
            </span>
          </div>
        </div>

        <div v-else class="pt-2.5 space-y-1.5">
          <div
            v-for="row in card.rows"
            :key="row.label"
            class="flex items-center justify-between bg-surface-container-low/60 rounded-xl px-3 py-1.5"
          >
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="row.danger ? 'bg-error' : row.warn ? 'bg-primary' : 'bg-outline'" aria-hidden="true" />
              <span class="font-body-sm text-body-sm text-on-surface-variant font-medium">{{ row.label }}</span>
            </div>
            <span
              class="font-headline-sm text-[14px] font-bold"
              :class="row.danger ? 'text-error' : row.warn ? 'text-primary' : 'text-on-surface'"
              >{{ row.value }}</span
            >
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="space-y-2 pt-2">
        <AppButton variant="primary" :disabled="loading" @click="handleGeneratePlan">
          查看训练计划
        </AppButton>
        <AppButton variant="secondary" icon="edit" @click="router.push('/profile')">返回修改信息</AppButton>
      </div>

      <p class="disclaimer pt-1">
        免责声明：本计划提供科学运动指导，不构成医疗诊断。若运动中出现身体不适请立即中止。
      </p>
    </div>
  </main>
</template>
