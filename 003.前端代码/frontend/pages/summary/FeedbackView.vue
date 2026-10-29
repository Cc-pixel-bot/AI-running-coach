<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRunStore } from '../../stores/run.js'
import { useUiStore } from '../../stores/ui.js'
import AppHeader from '../../components/layout/AppHeader.vue'
import AppButton from '../../components/ui/AppButton.vue'
import StatusTag from '../../components/ui/StatusTag.vue'
import { formatDuration } from '../../domain/utils/pace.js'

const router = useRouter()
const run = useRunStore()
const ui = useUiStore()

const FEELS = [
  { value: 'easy', label: '轻松' },
  { value: 'normal', label: '正常' },
  { value: 'fatigued', label: '疲劳' },
  { value: 'very_hard', label: '明显吃力' },
]
const PARTS = ['膝', '踝', '小腿', '足', '髂胫束', '大腿后侧', '腰', '胸闷', '头晕']

const form = ref({
  completion: 'full',
  actualDistanceKm: run.record?.actualDistanceKm ?? 0,
  actualDurationMin: Math.round((run.record?.actualDurationSec ?? 0) / 60),
  rpe: Math.max(1, Number(run.session?.intensity?.rpe?.[1] || 5)),
  feel: 'normal',
  painScore: 0,
  painParts: [],
  note: '',
})

const submitting = ref(false)

onMounted(() => {
  if (!run.record) {
    ui.toast('没有可反馈的训练记录', 'warn')
    router.replace('/plan')
  }
})

const targetRpe = computed(() => Math.max(1, Number(run.session?.intensity?.rpe?.[1] || 5)))
const needPainCare = computed(() => form.value.painScore >= 4)
const derivedCompletion = computed(() => {
  const targetDistance = Number(run.session?.distanceKm || 0)
  const targetDuration = Number(run.session?.durationMin || 0)
  const distance = Number(form.value.actualDistanceKm || 0)
  const duration = Number(form.value.actualDurationMin || 0)
  if (!targetDistance || distance <= 0) return 'none'
  const distanceRatio = distance / targetDistance
  const durationRatio = targetDuration > 0 ? duration / targetDuration : 1
  const targetPace = Number(run.session?.intensity?.paceLow || 0)
  const actualPace = distance > 0 && duration > 0 ? (duration * 60) / distance : 0
  const paceUsable = !targetPace || !actualPace || (actualPace >= targetPace * 0.75 && actualPace <= targetPace * 1.35)
  if (distanceRatio >= 0.95 && durationRatio >= 0.8 && paceUsable) return 'full'
  if (distanceRatio >= 0.75 && durationRatio >= 0.6) return 'mostly'
  if (distanceRatio >= 0.3 || durationRatio >= 0.3) return 'partial'
  return 'none'
})
const derivedCompletionLabel = computed(() => ({ full: '完成', mostly: '基本完成', partial: '部分完成', none: '未完成' }[derivedCompletion.value]))

function togglePart(part) {
  const list = form.value.painParts
  const i = list.indexOf(part)
  if (i >= 0) list.splice(i, 1)
  else list.push(part)
}

async function submit() {
  if (needPainCare.value && form.value.painParts.length === 0) {
    ui.toast('疼痛评分 ≥4，请选择疼痛部位', 'warn')
    return
  }
  submitting.value = true
  try {
    await run.submitFeedback({ ...form.value, completion: derivedCompletion.value })
    router.push('/plan')
  } catch (error) {
    ui.toast(error.message || 'AI 暂时无法完成计划调整，请稍后重试', 'error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="min-h-screen bg-surface">
    <AppHeader title="填写训练反馈" back />

    <div class="pt-14 pb-32 px-gutter space-y-space-md">
      <!-- 本次数据 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
            <span class="section-bar" />本次训练数据
          </h3>
          <StatusTag tone="muted">{{ run.session?.title?.split('·')[0] }}</StatusTag>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-surface-container-low rounded-lg p-2 text-center">
            <span class="font-label-caps text-label-caps text-on-surface-variant block">距离</span>
            <span class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ run.record?.actualDistanceKm ?? 0 }}公里</span>
          </div>
          <div class="bg-surface-container-low rounded-lg p-2 text-center">
            <span class="font-label-caps text-label-caps text-on-surface-variant block">用时</span>
            <span class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ formatDuration(run.record?.actualDurationSec || 0) }}</span>
          </div>
          <div class="bg-surface-container-low rounded-lg p-2 text-center">
            <span class="font-label-caps text-label-caps text-on-surface-variant block">平均配速</span>
            <span class="font-headline-sm text-headline-sm text-primary-container font-bold">
              {{ run.record?.avgPace ? `${Math.floor(run.record.avgPace / 60)}'${String(run.record.avgPace % 60).padStart(2, '0')}"` : '--' }}
            </span>
          </div>
        </div>
      </section>

      <!-- 实际距离与时长，完成度由系统结合训练数据计算 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card space-y-3">
        <div class="flex items-center justify-between">
          <label class="field-label">系统判断的完成度</label>
          <span class="text-primary font-semibold">{{ derivedCompletionLabel }}</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">实际距离（公里）</label>
            <input v-model.number="form.actualDistanceKm" class="field-input" type="number" step="0.01" />
          </div>
          <div>
            <label class="field-label">实际时长 (分钟)</label>
            <input v-model.number="form.actualDurationMin" class="field-input" type="number" />
          </div>
        </div>
      </section>

      <!-- RPE -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <div class="flex items-center justify-between mb-2">
          <label class="font-headline-sm text-headline-sm text-on-surface">4 · 主观强度</label>
          <span class="font-headline-sm text-headline-sm text-primary font-bold">{{ form.rpe }} / 10</span>
        </div>
        <input v-model.number="form.rpe" type="range" min="1" max="10" step="1" class="w-full accent-primary-container" />
        <div class="flex justify-between text-[11px] text-on-surface-variant">
          <span>1 很轻松</span><span>目标 {{ targetRpe }}</span><span>10 极限</span>
        </div>
      </section>

      <!-- 身体感受 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <label class="font-headline-sm text-headline-sm text-on-surface block mb-2">5 · 身体感受</label>
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="f in FEELS"
            :key="f.value"
            class="option-btn"
            :class="form.feel === f.value && 'option-btn-active'"
            type="button"
            @click="form.feel = f.value"
          >
            {{ f.label }}
          </button>
        </div>
        <label class="field-label mt-3">不适部位（可多选）</label>
        <div class="grid grid-cols-5 gap-1.5">
          <button
            v-for="p in PARTS"
            :key="p"
            class="option-btn text-[11px]"
            :class="form.painParts.includes(p) && 'option-btn-active'"
            type="button"
            @click="togglePart(p)"
          >
            {{ p }}
          </button>
        </div>
      </section>

      <!-- 疼痛程度 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <div class="flex items-center justify-between mb-2">
          <label class="font-headline-sm text-headline-sm text-on-surface">6 · 疼痛程度</label>
          <span class="font-headline-sm text-headline-sm font-bold" :class="needPainCare ? 'text-error' : 'text-on-surface'">
            {{ form.painScore }} / 10
          </span>
        </div>
        <input v-model.number="form.painScore" type="range" min="0" max="10" step="1" class="w-full" :class="needPainCare ? 'accent-error' : 'accent-primary-container'" />
        <div class="flex justify-between text-[11px] text-on-surface-variant">
          <span>0 无痛</span><span>≥4 触发降级逻辑</span><span>≥7 强制停止</span>
        </div>
        <div v-if="needPainCare" class="mt-2 bg-error-container rounded-lg p-2.5 flex gap-2">
          <Icon name="health_and_safety" :size="16" class="text-error shrink-0 mt-0.5" />
          <p class="text-body-sm text-on-error-container leading-snug">
            如果疼痛持续或加重，建议休息并就医。系统将在下一步自动降级你的后续课次。
          </p>
        </div>
      </section>

      <!-- 备注 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <label class="font-headline-sm text-headline-sm text-on-surface block mb-2">7 · 备注（选填）</label>
        <textarea
          v-model="form.note"
          class="field-input h-24 resize-none"
          placeholder="例如：今天有点累，后半段需要放慢节奏"
        />
        <p class="text-[11px] text-outline mt-1">智程教练会结合备注、完成度、RPE、疲劳、疼痛、近期负荷和当前训练阶段判断是否需要调整后续计划。</p>
      </section>

      <p class="text-[11px] text-outline leading-relaxed px-1">
        智程教练会结合本次训练表现和你的反馈，生成训练总结并评估后续计划。
      </p>
    </div>

    <div class="action-bar">
      <div class="action-bar-inner">
        <AppButton variant="primary" :disabled="submitting" icon="auto_awesome" @click="submit">
          {{ submitting ? '智程正在为你评估…' : '提交反馈并评估计划' }}
        </AppButton>
      </div>
    </div>
  </main>
</template>
