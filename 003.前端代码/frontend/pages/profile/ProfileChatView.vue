<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProfileStore } from '../../stores/profile.js'
import { useAuthStore } from '../../stores/auth.js'
import { useUiStore } from '../../stores/ui.js'
import Icon from '../../components/ui/Icon.vue'
import coachAvatar from '../../assets/coach-avatar.png'
import AppButton from '../../components/ui/AppButton.vue'
import StatusTag from '../../components/ui/StatusTag.vue'
import { SCREENING_QUESTIONS } from '../../domain/constants/screening.js'
import { TARGET_TYPES } from '../../domain/templates/trainingTemplates.js'
import { formatPace, formatClock } from '../../domain/utils/pace.js'

const router = useRouter()
const profile = useProfileStore()
const auth = useAuthStore()
const ui = useUiStore()

const SECTIONS = [
  { key: 'basis', label: '基础体征', icon: 'person' },
  { key: 'target', label: '训练目标', icon: 'flag' },
  { key: 'base', label: '跑力基础', icon: 'directions_run' },
  { key: 'screening', label: '风险筛查', icon: 'shield' },
]
const activeSection = ref('basis')

const WEEKLY_KM_OPTIONS = [10, 15, 20, 25, 30, 40, 50]
const EASY_PACE_OPTIONS = [300, 330, 360, 390, 420, 450]
const INJURY_OPTIONS = ['膝盖', '脚踝', '小腿', '足部', '髂胫束']
const TERRAIN_OPTIONS = ['田径跑道', '公路', '健身房']
const TARGET_PRESETS = {
  '10K': [
    { label: '进取 50分钟', sec: 50 * 60 },
    { label: '推荐 55分钟', sec: 55 * 60 },
    { label: '稳妥 60分钟', sec: 60 * 60 },
  ],
}
const TARGET_TIME_OPTIONS = Array.from({ length: 6 }, (_, index) => {
  const minutes = 45 + index * 5
  return { label: `${minutes}分钟`, sec: minutes * 60 }
})
const TARGET_OPTIONS = [
  { key: 'improve_5k', label: '提升5公里', distance: '5K', weeks: '—', icon: 'directions_run' },
  ...Object.values(TARGET_TYPES),
  { key: 'improve_hm', label: '半程马拉松', distance: 'HM', weeks: '—', icon: 'route' },
  { key: 'improve_marathon', label: '全程马拉松', distance: 'MARATHON', weeks: '—', icon: 'emoji_events' },
]

const d = computed(() => profile.draft)
const targetDistance = computed(() => '10K')
const targetPresets = computed(() => TARGET_PRESETS[targetDistance.value] || [])
const NUMERIC_RULES = {
  birthYear: { label: '出生年份', min: 1970, max: 2010, integer: true },
  heightCm: { label: '身高', min: 120, max: 230, integer: true },
  weightKg: { label: '体重', min: 40, max: 100 },
  runsPerWeek: { label: '最近每周跑步次数', min: 1, max: 7, integer: true },
  longestRunKm: { label: '最近最长一次连续跑', min: 1, max: 30 },
  best10kTimeMin: { label: '10公里最好成绩', min: 30, max: 90, integer: true },
}
const screening = computed(() => profile.screeningResult)
const screeningDone = computed(
  () => Boolean(d.value.screening?.q1) && Array.isArray(d.value.screening?.q2) && Boolean(d.value.screening?.q3),
)

onMounted(() => {
  const current = Array.isArray(d.value.terrain) ? d.value.terrain : d.value.terrain ? [d.value.terrain] : []
  const normalized = current
    .filter((item) => item !== '操场')
    .map((item) => (item === '跑步机' ? '健身房' : item))
  if (JSON.stringify(current) !== JSON.stringify(normalized)) profile.patch({ terrain: normalized })
})
const best5kTimeMinutes = computed(() => d.value.best5kTimeMin ?? (d.value.best5kPace ? Math.round((d.value.best5kPace * 5) / 60) : ''))
const best10kTimeMinutes = computed(() => d.value.best10kTimeMin ?? (d.value.best10kPace ? Math.round((d.value.best10kPace * 10) / 60) : ''))
function inputError(key) {
  const rule = NUMERIC_RULES[key]
  const value = d.value[key]
  if (value === undefined || value === null || value === '') return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return `请输入正确的${rule.label}`
  if (rule.integer && !Number.isInteger(number)) return `请输入正确的${rule.label}`
  if (number < rule.min || number > rule.max) return `请输入正确的${rule.label}`
  return ''
}
const sectionComplete = computed(() => {
  const has = (key) => {
    const value = d.value[key]
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== ''
  }
  return {
    basis: ['gender', 'birthYear', 'heightCm', 'weightKg'].every(has),
    target: ['targetType', 'targetTime'].every(has),
    base: ['weeklyKm', 'runsPerWeek', 'longestRunKm', 'easyPace', 'availableDays', 'availableMin', 'terrain'].every(has),
    screening: screeningDone.value,
  }
})

function set(key, value) {
  profile.patch({ [key]: value })
}

function selectTarget(typeKey) {
  if (typeKey !== 'improve_10k') {
    ui.toast('该训练目标正在准备中，敬请期待', 'info')
    return
  }
  const meta = TARGET_TYPES[typeKey]
  profile.patch({
    targetType: typeKey,
    targetDistance: meta.distance,
    targetPace: null,
    targetTime: null,
  })
}

function toggleInjury(part) {
  const list = d.value.injuries || []
  const exists = list.some((i) => i.part === part)
  profile.patch({
    injuries: exists ? list.filter((i) => i.part !== part) : [...list, { part, active: true }],
  })
}

function toggleTerrain(terrain) {
  const current = Array.isArray(d.value.terrain) ? d.value.terrain : d.value.terrain ? [d.value.terrain] : []
  set('terrain', current.includes(terrain) ? current.filter((item) => item !== terrain) : [...current, terrain])
}

function toggleQ2(value) {
  const list = d.value.screening?.q2 || []
  if (value === 'none') {
    profile.setScreening('q2', ['none'])
    return
  }
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list.filter((v) => v !== 'none'), value]
  profile.setScreening('q2', next)
}

function onTargetTimeSelect(e) {
  const seconds = Number(e.target.value)
  if (!seconds) return
  profile.patch({ targetTime: seconds, targetTimeInput: formatClock(seconds) })
}

function onBestTimeInput(e, timeKey, paceKey, distanceKm) {
  const minutes = Math.round(Number(e.target.value))
  const valid = Number.isFinite(minutes) && minutes > 0
  profile.patch({
    [timeKey]: valid ? minutes : null,
    [paceKey]: valid ? Math.round((minutes * 60) / distanceKm) : null,
  })
}

function scrollToSection(key) {
  activeSection.value = key
  const el = document.getElementById(`section-${key}`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function loadDemoProfile() {
  profile.loadDemo(auth.currentDemoProfile.profile)
  ui.toast(`已载入「${auth.currentDemoProfile.name}」档案`, 'success')
}

async function handleGenerate() {
  const invalidKey = Object.keys(NUMERIC_RULES).find((key) => inputError(key))
  if (invalidKey) {
    ui.toast(inputError(invalidKey), 'error')
    scrollToSection('basis')
    return
  }
  if (!screeningDone.value) {
    ui.toast('请先完成运动风险筛查（安全必答）', 'error')
    scrollToSection('screening')
    return
  }
  if (profile.completionRatio < 80) {
    ui.toast(`还有必填项未完成（当前 ${profile.completionRatio}%）`, 'warn')
    return
  }
  profile.confirm()
  router.push('/profile/confirm')
}
</script>

<template>
  <main class="min-h-screen bg-surface pb-28">
    <header class="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl border-b border-surface-container">
      <div class="px-gutter pt-3 pb-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-headline-sm text-base text-on-surface font-bold tracking-tight">智能科学建档</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 bg-surface-container-high px-2.5 py-1 rounded-full">
              <span class="inline-block w-2 h-2 rounded-full bg-primary-container animate-pulse" />
              <span class="text-[11px] font-label-data text-primary font-bold">建档进行中</span>
            </div>
          </div>
        </div>

          <div class="relative mt-2 h-6 overflow-hidden rounded-full bg-primary-fixed/20" aria-hidden="true">
            <span class="absolute left-0 right-0 top-1 h-px bg-primary-container/45" />
            <span class="absolute left-0 right-8 top-3 h-px bg-primary-container/35" />
            <span class="absolute left-0 right-16 top-5 h-px bg-primary-container/25" />
            <Icon name="directions_run" :size="16" class="absolute right-2 top-1 text-primary" />
          </div>

        <!-- 分段节点导航 -->
        <div class="flex items-center gap-1 pt-2">
          <button
            v-for="(s, i) in SECTIONS"
            :key="s.key"
            class="flex-1 flex flex-col items-center gap-1"
            type="button"
            @click="scrollToSection(s.key)"
          >
            <span
              class="w-full h-1 rounded-full transition-colors"
              :class="sectionComplete[s.key] ? 'bg-emerald-500' : activeSection === s.key ? 'bg-primary-container' : 'bg-surface-container-high'"
            />
            <span
              class="font-label-caps text-label-caps"
              :class="sectionComplete[s.key] ? 'text-emerald-600' : activeSection === s.key ? 'text-primary' : 'text-outline'"
              >{{ sectionComplete[s.key] ? '✓ ' : `${i + 1}.` }}{{ s.label }}</span
            >
          </button>
        </div>
      </div>
    </header>

    <div class="px-gutter pt-3 pb-6 space-y-4">
      <!-- AI 教练气泡 -->
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
            你好！我是你的专属跑步教练<span class="font-semibold text-primary">智程</span>。为了能为你量身定制最合适的训练计划，我需要了解你的基础情况、训练目标与跑步习惯。
          </p>
        </div>
      </section>

      <!-- ① 基础体征 -->
      <section id="section-basis" class="bg-surface-container-lowest p-4 rounded-2xl shadow-card border border-outline-variant/20 space-y-3.5 scroll-mt-32">
        <header class="flex items-center justify-between border-b border-surface-container pb-2.5">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center text-xs font-bold font-label-data">1</span>
            <h2 class="font-headline-sm text-base text-on-surface font-bold">基础体征信息</h2>
          </div>
        </header>

        <div>
          <label class="field-label">生理性别</label>
          <div class="grid grid-cols-2 gap-2.5">
            <button
              v-for="g in [{ v: 'male', l: '男 (Male)', i: 'male' }, { v: 'female', l: '女 (Female)', i: 'female' }]"
              :key="g.v"
              class="option-btn flex items-center justify-center gap-2 py-2.5"
              :class="d.gender === g.v && 'option-btn-active'"
              type="button"
              @click="set('gender', g.v)"
            >
              <Icon :name="g.i" :size="18" />{{ g.l }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2.5">
          <div>
            <label class="field-label">出生年份</label>
            <input
              v-model.number="d.birthYear"
              class="field-input"
              :class="inputError('birthYear') && 'border-error focus:ring-error'"
              type="number"
              min="1970"
              max="2010"
              step="1"
              @blur="inputError('birthYear')"
            />
            <p v-if="inputError('birthYear')" class="mt-1 text-[10px] leading-tight text-error">{{ inputError('birthYear') }}</p>
          </div>
          <div>
            <label class="field-label">身高 (cm)</label>
            <input
              v-model.number="d.heightCm"
              class="field-input"
              :class="inputError('heightCm') && 'border-error focus:ring-error'"
              type="number"
              min="120"
              max="230"
              step="1"
            />
            <p v-if="inputError('heightCm')" class="mt-1 text-[10px] leading-tight text-error">{{ inputError('heightCm') }}</p>
          </div>
          <div>
            <label class="field-label">体重 (kg)</label>
            <input
              v-model.number="d.weightKg"
              class="field-input"
              :class="inputError('weightKg') && 'border-error focus:ring-error'"
              type="number"
              min="40"
              max="100"
              step="0.1"
            />
            <p v-if="inputError('weightKg')" class="mt-1 text-[10px] leading-tight text-error">{{ inputError('weightKg') }}</p>
          </div>
        </div>

      </section>

      <!-- ② 核心训练目标 -->
      <section id="section-target" class="bg-surface-container-lowest p-4 rounded-2xl shadow-card border border-outline-variant/20 space-y-3.5 scroll-mt-32">
        <header class="flex items-center justify-between border-b border-surface-container pb-2.5">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center text-xs font-bold font-label-data">2</span>
            <h2 class="font-headline-sm text-base text-on-surface font-bold">设定核心训练目标</h2>
          </div>
        </header>

        <div class="grid grid-cols-2 gap-2.5">
          <button
            v-for="t in TARGET_OPTIONS"
            :key="t.key"
            class="target-card p-3 rounded-xl border bg-surface text-left transition-all relative flex flex-col justify-between h-24 hover:border-primary-container"
            :class="d.targetType === t.key ? 'border-primary-container bg-primary-fixed/40' : 'border-surface-container-highest'"
            type="button"
            :aria-pressed="d.targetType === t.key"
            @click="selectTarget(t.key)"
          >
            <div class="flex items-start justify-between">
              <span
                class="flex items-center justify-center w-8 h-8 rounded-full transition-all"
                :class="d.targetType === t.key ? 'bg-primary-container text-on-primary shadow-sm ring-2 ring-primary-container/30' : 'bg-surface-container text-primary'"
              >
                <Icon :name="t.icon" :size="20" />
              </span>
              <span
                v-if="d.targetType === t.key"
                class="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-primary-container text-on-primary shadow-sm"
                aria-label="已选中"
              >
                <Icon name="check" :size="14" />
              </span>
              <span
                class="text-[10px] font-label-data bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded font-bold"
                :class="d.targetType === t.key ? 'mr-6' : ''"
              >
                {{ t.key === 'improve_10k' ? `${t.weeks} 周周期` : '敬请期待' }}
              </span>
            </div>
            <div>
              <span class="text-xs font-bold text-on-surface block">{{ t.label }}</span>
              <span class="text-[11px] text-on-surface-variant">
                {{ t.distance === '10K' ? '耐力与节奏巡航突破' : '暂未开放' }}
              </span>
            </div>
          </button>
        </div>

        <div class="bg-surface-container-low p-3.5 rounded-xl space-y-2 border border-surface-container">
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-white p-2.5 rounded-lg border border-surface-container flex items-center justify-between">
              <span class="text-xs text-on-surface-variant">目标用时</span>
              <div class="relative shrink-0">
                <select
                  class="!w-24 !h-8 !min-h-0 !py-0 !pl-1 !pr-6 text-right text-sm font-bold text-primary font-label-data bg-transparent appearance-none cursor-pointer"
                  :value="profile.targetTotalSec || ''"
                  aria-label="选择目标用时"
                  @change="onTargetTimeSelect"
                >
                  <option value="" disabled>选择目标</option>
                  <option v-for="option in TARGET_TIME_OPTIONS" :key="option.sec" :value="option.sec">
                    {{ option.label }}
                  </option>
                </select>
                <span
                  class="pointer-events-none absolute right-1 top-1/2 w-2 h-2 border-r-2 border-b-2 border-primary rotate-45 -translate-y-[70%]"
                  aria-hidden="true"
                />
              </div>
            </div>

            <div class="bg-white p-2.5 rounded-lg border border-surface-container flex items-center justify-between">
              <span class="text-xs text-on-surface-variant">换算配速</span>
              <span class="text-sm font-bold text-primary font-label-data">
                {{ profile.targetPace ? `${formatPace(profile.targetPace)}/公里` : '--' }}
              </span>
            </div>
          </div>
        </div>

      </section>

      <!-- ③ 跑力与跑量基础 -->
      <section id="section-base" class="bg-surface-container-lowest p-4 rounded-2xl shadow-card border border-outline-variant/20 space-y-4 scroll-mt-32">
        <header class="flex items-center justify-between border-b border-surface-container pb-2.5">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center text-xs font-bold font-label-data">3</span>
            <h2 class="font-headline-sm text-base text-on-surface font-bold">跑力与跑量基础</h2>
          </div>
          <span class="text-[11px] font-label-caps text-on-surface-variant">评估有氧储量</span>
        </header>

        <div>
          <label class="field-label">近3个月平均每周跑量</label>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="km in WEEKLY_KM_OPTIONS"
              :key="km"
              class="option-btn"
              :class="Number(d.weeklyKm) === km && 'option-btn-active'"
              type="button"
              @click="set('weeklyKm', km)"
            >
              {{ km }}公里
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div class="flex items-center gap-2">
            <label class="field-label flex-1 !mb-0 leading-tight">最近每周跑步次数</label>
            <input
              v-model.number="d.runsPerWeek"
              class="field-input w-16 shrink-0 text-center"
              :class="inputError('runsPerWeek') && 'border-error focus:ring-error'"
              type="number"
              min="1"
              max="7"
              step="1"
            />
          </div>
          <div class="flex items-center gap-2">
            <label class="field-label flex-1 !mb-0 leading-tight">最近最长一次连续跑（公里）</label>
            <input
              v-model.number="d.longestRunKm"
              class="field-input w-16 shrink-0 text-center"
              :class="inputError('longestRunKm') && 'border-error focus:ring-error'"
              type="number"
              min="1"
              max="30"
              step="0.1"
            />
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="field-label !mb-0">最近最好的一次成绩</label>
          </div>
          <div v-if="d.targetType === 'improve_10k'" class="grid grid-cols-1 gap-2.5">
            <div class="flex items-center gap-2">
              <label class="field-label flex-1 !mb-0 leading-tight">10公里最好成绩（分钟，选填）</label>
              <input
                class="field-input w-16 shrink-0 text-center appearance-none"
                type="number"
                min="30"
                max="90"
                step="1"
                :value="best10kTimeMinutes"
                :class="inputError('best10kTimeMin') && 'border-error focus:ring-error'"
                @input="onBestTimeInput($event, 'best10kTimeMin', 'best10kPace', 10)"
              />
            </div>
          </div>
        </div>

        <div>
          <label class="field-label">平时舒服慢跑配速</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="p in EASY_PACE_OPTIONS"
              :key="p"
              class="option-btn"
              :class="Number(d.easyPace) === p && 'option-btn-active'"
              type="button"
              @click="set('easyPace', p)"
            >
              {{ formatPace(p) }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div class="flex items-center gap-2">
            <label class="field-label flex-1 !mb-0 leading-tight">每周可训练天数</label>
            <select v-model.number="d.availableDays" class="field-input w-32 shrink-0 appearance-none font-normal whitespace-nowrap">
              <option :value="null" disabled>请选择</option>
              <option :value="2">2天（维持）</option>
              <option :value="3">3天（经典）</option>
              <option :value="4">4天（进阶）</option>
              <option :value="5">5天（高频）</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <label class="field-label flex-1 !mb-0 leading-tight">单次最大时长</label>
            <select v-model.number="d.availableMin" class="field-input w-32 shrink-0 appearance-none font-normal whitespace-nowrap">
              <option :value="null" disabled>请选择</option>
              <option :value="30">30 分钟</option>
              <option :value="45">45 分钟</option>
              <option :value="60">60 分钟</option>
              <option :value="75">75 分钟及以上</option>
            </select>
          </div>
        </div>

        <div>
          <label class="field-label">主要训练场地（可多选）</label>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="t in TERRAIN_OPTIONS"
              :key="t"
              class="option-btn"
              :class="(Array.isArray(d.terrain) ? d.terrain : [d.terrain]).includes(t) && 'option-btn-active'"
              type="button"
              @click="toggleTerrain(t)"
            >
              {{ t }}
            </button>
          </div>
        </div>
      </section>

      <!-- ④ 运动风险筛查（安全必答） -->
      <section id="section-screening" class="bg-surface-container-lowest p-4 rounded-2xl shadow-card border border-error/25 space-y-4 scroll-mt-32">
        <header class="flex items-center justify-between border-b border-surface-container pb-2.5">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-error text-on-error flex items-center justify-center text-xs font-bold font-label-data">4</span>
            <h2 class="font-headline-sm text-base text-on-surface font-bold">运动风险筛查</h2>
          </div>
          <StatusTag tone="danger" icon="shield">安全必答</StatusTag>
        </header>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="field-label !mb-0">近期伤病与不适排查（可多选）</label>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="part in INJURY_OPTIONS"
              :key="part"
              class="option-btn"
              :class="(d.injuries || []).some((i) => i.part === part) && 'option-btn-active'"
              type="button"
              @click="toggleInjury(part)"
            >
              {{ part }}
            </button>
            <button
              class="option-btn col-span-2"
              :class="!(d.injuries || []).length && 'option-btn-active'"
              type="button"
              @click="profile.patch({ injuries: [] })"
            >
              无任何不适
            </button>
          </div>
          <div
            v-if="(d.injuries || []).length"
            class="mt-2.5 p-2.5 rounded-xl bg-primary-fixed/50 border border-primary-fixed flex items-start gap-2"
          >
            <Icon name="health_and_safety" :size="18" class="text-primary shrink-0 mt-0.5" />
            <div class="text-xs text-on-surface leading-tight">
              <span class="font-bold text-primary">智程防伤干预：</span>
              <span>已为你自动追加针对性筋膜松解与拉伸训练，并下调相关强度。</span>
            </div>
          </div>
        </div>

        <div v-for="q in SCREENING_QUESTIONS" :key="q.key" class="space-y-2">
          <div>
            <p class="font-headline-sm text-[15px] text-on-surface font-bold">{{ q.title }}</p>
            <p class="text-xs text-on-surface-variant mt-0.5 leading-snug">{{ q.question }}</p>
          </div>
          <div :class="q.multiple ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-2 gap-2'">
            <button
              v-for="o in q.options"
              :key="o.value"
              class="option-btn"
              :class="
                (q.multiple
                  ? (d.screening?.q2 || []).includes(o.value)
                  : d.screening?.[q.key] === o.value) && 'option-btn-active'
              "
              type="button"
              @click="q.multiple ? toggleQ2(o.value) : profile.setScreening(q.key, o.value)"
            >
              {{ o.label }}
            </button>
          </div>
        </div>

        <div
          class="p-3 rounded-xl flex items-start gap-2"
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
            <p class="font-bold text-on-surface">{{ screening.summary }}</p>
            <ul class="mt-1 space-y-0.5 text-on-surface-variant">
              <li v-for="a in screening.actions" :key="a">· {{ a }}</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 底部 CTA -->
      <div class="sticky bottom-2 z-20 space-y-2">
        <AppButton variant="primary" icon="badge" @click="handleGenerate">
          生成跑者档案卡 →
        </AppButton>
        <div class="flex items-center justify-center gap-1.5 text-on-surface-variant px-2">
          <Icon name="verified_user" :size="14" class="text-emerald-600" />
          <span class="text-[11px]">科学模型运算保障 · 数据经由本地与智程智能系统加密协同</span>
        </div>
        <button class="w-full text-[11px] text-primary hover:underline font-medium" type="button" @click="loadDemoProfile">
          直达已建档案卡（载入演示档案）>
        </button>
      </div>
    </div>
  </main>
</template>
