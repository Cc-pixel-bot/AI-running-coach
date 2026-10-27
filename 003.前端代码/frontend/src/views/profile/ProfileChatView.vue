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
import { formatPace, formatClock, parseDuration } from '../../domain/utils/pace.js'

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
  '5K': [
    { label: '进取 25:00', sec: 25 * 60 },
    { label: '推荐 27:30', sec: 27.5 * 60 },
    { label: '稳妥 30:00', sec: 30 * 60 },
  ],
  '10K': [
    { label: '进取 50分钟', sec: 50 * 60 },
    { label: '推荐 55分钟', sec: 55 * 60 },
    { label: '稳妥 60分钟', sec: 60 * 60 },
  ],
  HM: [
    { label: '进取 1:45:00', sec: 105 * 60 },
    { label: '推荐 1:55:00', sec: 115 * 60 },
    { label: '稳妥 2:05:00', sec: 125 * 60 },
  ],
  MARATHON: [
    { label: '进取 3:50:00', sec: 230 * 60 },
    { label: '推荐 4:20:00', sec: 260 * 60 },
    { label: '稳妥 4:45:00', sec: 285 * 60 },
  ],
}

const d = computed(() => profile.draft)
const targetDistance = computed(() => profile.targetTypeMeta?.distance || '10K')
const targetPresets = computed(() => TARGET_PRESETS[targetDistance.value] || [])
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

function onTargetTimeInput(e) {
  const text = e.target.value.trim()
  const seconds = /^\d+(?:\.\d+)?$/.test(text) ? Number(text) * 60 : parseDuration(text)
  profile.patch({ targetTime: seconds, targetTimeInput: text })
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
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-container text-white font-label-data text-xs font-bold">
              智能
            </span>
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
          <span class="text-[11px] font-label-caps text-on-surface-variant">BMI 自动计算</span>
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
            <input v-model.number="d.birthYear" class="field-input" type="number" min="1950" max="2015" />
          </div>
          <div>
            <label class="field-label">身高 (cm)</label>
            <input v-model.number="d.heightCm" class="field-input" type="number" />
          </div>
          <div>
            <label class="field-label">体重 (kg)</label>
            <input v-model.number="d.weightKg" class="field-input" type="number" />
          </div>
        </div>

        <div class="bg-surface-container-high/60 p-2.5 rounded-xl flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="monitor_weight" :size="18" class="text-primary" />
            <span class="text-xs text-on-surface font-medium">身体质量指数 (BMI)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="font-headline-sm text-sm text-on-surface-variant font-label-data">{{ profile.bmi ?? '--' }}</span>
            <span
              v-if="profile.bmi"
              class="text-[11px] px-2 py-0.5 rounded font-semibold"
              :class="{
                'bg-emerald-100 text-emerald-700': profile.bmiLevel.tone === 'good',
                'bg-amber-100 text-amber-700': profile.bmiLevel.tone === 'warn',
                'bg-error-container text-on-error-container': profile.bmiLevel.tone === 'danger',
                'bg-info-container text-info': profile.bmiLevel.tone === 'info',
              }"
            >
              {{ profile.bmiLevel.label }}
            </span>
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
          <span class="text-[11px] font-label-data text-primary font-semibold">四选一</span>
        </header>

        <div class="grid grid-cols-2 gap-2.5">
          <button
            v-for="t in Object.values(TARGET_TYPES)"
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
                {{ t.weeks }} 周周期
              </span>
            </div>
            <div>
              <span class="text-xs font-bold text-on-surface block">{{ t.label }}</span>
              <span class="text-[11px] text-on-surface-variant">
                {{ { '5K': '速度爆发·心肺跃升', '10K': '耐力与节奏巡航突破', HM: '有氧耐力与能量代谢', MARATHON: '长距离与极限耐受' }[t.distance] }}
              </span>
            </div>
          </button>
        </div>

        <div class="bg-surface-container-low p-3.5 rounded-xl space-y-2 border border-surface-container">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-on-surface">目标完成成绩</span>
            <span class="text-[11px] font-label-data text-primary font-bold">
              智程推荐：{{ targetPresets[1]?.label.replace('推荐 ', '') || '--' }}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-white p-2.5 rounded-lg border border-surface-container flex items-center justify-between">
              <span class="text-xs text-on-surface-variant">目标用时</span>
              <span class="text-sm font-bold text-primary font-label-data">
                {{ profile.targetTotalSec ? formatClock(profile.targetTotalSec) : '--' }}
              </span>
            </div>
            <div class="bg-white p-2.5 rounded-lg border border-surface-container flex items-center justify-between">
              <span class="text-xs text-on-surface-variant">换算配速</span>
              <span class="text-sm font-bold text-primary font-label-data">
                {{ profile.targetPace ? `${formatPace(profile.targetPace)}/公里` : '--' }}
              </span>
            </div>
          </div>
          <input
            class="field-input"
            type="text"
            :value="d.targetTimeInput || ''"
            @input="onTargetTimeInput"
          />
          <div class="flex items-center gap-1.5 pt-1 flex-wrap">
            <button
              v-for="p in targetPresets"
              :key="p.label"
              class="text-[11px] px-2 py-1 rounded bg-surface hover:bg-surface-container text-on-surface font-label-data border border-surface-container-highest"
              :class="profile.targetTotalSec === p.sec && 'bg-primary-fixed text-primary font-bold border-primary-container/40'"
              type="button"
              @click="profile.patch({ targetTime: p.sec, targetTimeInput: formatClock(p.sec) })"
            >
              {{ p.label }}
            </button>
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
            <input v-model.number="d.runsPerWeek" class="field-input w-16 shrink-0 text-center" type="number" min="1" max="7" />
          </div>
          <div class="flex items-center gap-2">
            <label class="field-label flex-1 !mb-0 leading-tight">最近最长一次连续跑（公里）</label>
            <input v-model.number="d.longestRunKm" class="field-input w-16 shrink-0 text-center" type="number" />
          </div>
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="field-label !mb-0">最近最好的一次成绩</label>
            <button
              class="text-[11px] font-label-data text-on-surface-variant hover:text-primary flex items-center gap-1"
              type="button"
              @click="profile.patch({ best5kTimeMin: null, best10kTimeMin: null, best5kPace: null, best10kPace: null, bestHmPace: null, bestMarPace: null })"
            >
              <Icon name="help_outline" :size="14" />暂无最好成绩记录
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <div class="flex items-center gap-2">
              <label class="field-label flex-1 !mb-0 leading-tight">5公里最好成绩（分钟）</label>
              <input
                class="field-input w-16 shrink-0 text-center"
                type="number"
                min="1"
                step="1"
                :value="best5kTimeMinutes"
                @input="onBestTimeInput($event, 'best5kTimeMin', 'best5kPace', 5)"
              />
            </div>
            <div class="flex items-center gap-2">
              <label class="field-label flex-1 !mb-0 leading-tight">10公里最好成绩（分钟）</label>
              <input
                class="field-input w-16 shrink-0 text-center"
                type="number"
                min="1"
                step="1"
                :value="best10kTimeMinutes"
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
        <p class="text-xs text-on-surface-variant leading-relaxed">
          以下三问来自运动测试与处方指南的预参与筛查。
          <span class="font-semibold text-error">命中任一症状将不生成训练计划。</span>
        </p>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="field-label !mb-0">近期伤病与不适排查（可多选）</label>
            <span class="text-[11px] text-on-surface-variant">动态触发防伤方案</span>
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
