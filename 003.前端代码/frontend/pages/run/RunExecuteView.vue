<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlanStore } from '../../stores/plan.js'
import { useRunStore } from '../../stores/run.js'
import { useUiStore } from '../../stores/ui.js'
import AppHeader from '../../components/layout/AppHeader.vue'
import Icon from '../../components/ui/Icon.vue'
import StatTile from '../../components/ui/StatTile.vue'
import TrackMap from '../../components/run/TrackMap.vue'
import { formatDuration, formatPace } from '../../domain/utils/pace.js'

const route = useRoute()
const router = useRouter()
const planStore = usePlanStore()
const run = useRunStore()
const ui = useUiStore()

const showFinishModal = ref(false)
const holdTimer = ref(null)
const holding = ref(false)

const session = computed(() => {
  const id = route.query.session
  for (const w of planStore.plan?.weeks || []) {
    const hit = w.sessions.find((s) => s.id === id)
    if (hit) return { ...hit, weekPlan: w }
  }
  return null
})

const points = computed(() => run.trackPoints)
const zoneName = computed(() => {
  const map = { easy: '轻松区间', tempo: '节奏区间', interval: '间歇区间', recovery: '恢复区间' }
  return map[run.currentZone] || '轻松区间'
})
const zoneTone = computed(() => {
  const z = run.currentZone
  if (z === 'interval') return 'text-error'
  if (z === 'tempo') return 'text-primary'
  return 'text-success'
})

onMounted(() => {
  if (!session.value) {
    ui.toast('未找到课次', 'warn')
    router.replace('/plan')
    return
  }
  const factor = Number(route.query.factor) || 1
  run.startSession(session.value, { speedFactor: factor })
})

onBeforeUnmount(() => {
  run.stopTimer()
})

function togglePause() {
  run.togglePause()
}

function markLap() {
  run.markLap()
  ui.toast('已记录分段', 'success')
}

function startHold() {
  holding.value = true
  holdTimer.value = setTimeout(() => {
    showFinishModal.value = true
    holding.value = false
  }, 700)
}

function cancelHold() {
  if (holdTimer.value) clearTimeout(holdTimer.value)
  holdTimer.value = null
  holding.value = false
}

function confirmFinish() {
  showFinishModal.value = false
  const record = run.finish()
  router.replace({ name: 'feedback', query: { record: record?.id } })
}
</script>

<template>
  <main class="min-h-screen bg-surface flex flex-col">
    <AppHeader title="实时训练" subtitle="训练进行中 · 智程" back />

    <div class="flex-1 flex flex-col pt-14 pb-2">
      <!-- 实时配速 -->
      <section class="px-gutter py-space-xs">
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-card relative overflow-hidden">
          <div class="absolute -right-8 -top-8 w-28 h-28 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
          <div class="flex items-center justify-between mb-space-xs">
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-3.5 bg-primary rounded-full" />
              <span class="font-label-caps text-label-caps text-on-surface-variant tracking-wider uppercase">实时平滑配速</span>
            </div>
            <span class="bg-primary/10 text-primary px-2 py-0.5 rounded font-label-caps text-label-caps font-bold">{{ zoneName }}</span>
          </div>
          <div class="flex items-baseline justify-between">
            <div class="flex items-baseline gap-1">
              <span class="font-display-hero-mobile text-display-hero-mobile tracking-tighter text-on-surface font-extrabold select-none">
                {{ run.currentPace ? formatPace(run.currentPace) : '--' }}
              </span>
              <span class="font-body-md text-body-md text-on-surface-variant">/公里</span>
            </div>
            <div class="flex flex-col items-end">
              <span class="font-label-caps text-label-caps font-bold flex items-center" :class="zoneTone">
                <Icon name="speed" :size="14" />
                {{ run.pauseCount ? `已暂停 ${run.pauseCount} 次` : '节奏稳定' }}
              </span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">最近 60 秒滑动窗口</span>
            </div>
          </div>

          <!-- 目标进度 -->
          <div class="pt-3">
            <div class="flex justify-between text-body-sm text-on-surface-variant mb-1">
              <span>目标进度</span>
              <span class="text-on-surface font-semibold">
                {{ run.distanceKm.toFixed(2) }} / {{ (session?.distanceKm || 0).toFixed(2) }} 公里
              </span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-primary-container to-secondary-container rounded-full transition-all duration-500"
                :style="{ width: `${(run.completionRatio * 100).toFixed(1)}%` }"
              />
            </div>
          </div>
        </div>
      </section>

      <section v-if="run.gpsError" class="px-gutter py-space-xs">
        <div class="rounded-xl bg-error-container p-4 text-on-error-container">
          <div class="flex items-start gap-2">
            <Icon name="warning" :size="20" class="shrink-0 mt-0.5" />
            <div>
              <p class="font-body-md text-body-md font-semibold">无法获取真实 GPS</p>
              <p class="font-body-sm text-body-sm mt-1 leading-relaxed">{{ run.gpsError }}</p>
              <p class="font-body-sm text-body-sm mt-2 leading-relaxed">请确认已允许浏览器定位权限，并使用 localhost 或 HTTPS 打开网站。</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 三项指标 -->
      <section class="px-gutter py-space-xs grid grid-cols-3 gap-2">
        <StatTile
              label="已跑距离（公里）"
          :value="run.distanceKm.toFixed(2)"
          hint-icon="flag"
          :hint="`目标 ${(session?.distanceKm || 0).toFixed(2)}`"
        />
        <StatTile
          label="运动用时 (MM:SS)"
          :value="formatDuration(run.elapsedSec)"
          hint-icon="timer"
          :hint="run.status === 'paused' ? '已暂停' : run.status === 'running' ? '运动中' : '待开始'"
        />
        <StatTile
              label="平均配速（分钟/公里）"
          :value="run.averagePace ? formatPace(run.averagePace) : '--'"
          tone="brand"
          hint-icon="bolt"
          :hint="run.lapCount ? `已计 ${run.lapCount} 圈` : '步频稳定'"
        />
      </section>

      <!-- 轨迹 -->
      <section class="px-gutter py-space-xs">
        <div class="bg-surface-container-lowest rounded-xl p-space-sm shadow-card">
          <div class="flex items-center justify-between mb-space-xs px-1">
            <div class="flex items-center gap-1.5">
              <Icon name="route" :size="16" class="text-primary" />
              <span class="font-headline-sm text-headline-sm text-on-surface font-bold">实时轨迹</span>
            </div>
            <span class="font-label-caps text-label-caps text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded">
              {{ points.length }} 个真实定位点
            </span>
          </div>
          <TrackMap :points="points" :status="run.status" />
        </div>
      </section>

      <!-- 操作区 -->
      <section class="px-gutter pt-space-sm pb-space-lg mt-auto">
        <div class="bg-surface-container-lowest p-space-md rounded-xl shadow-card-lg flex items-center justify-around relative">
          <div class="flex flex-col items-center gap-1">
            <button
              aria-label="长按结束"
              class="relative w-16 h-16 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              :class="holding && 'scale-90'"
              type="button"
              @mousedown="startHold"
              @mouseup="cancelHold"
              @mouseleave="cancelHold"
              @touchstart.prevent="startHold"
              @touchend="cancelHold"
            >
              <Icon name="stop" :size="24" />
            </button>
            <span class="font-label-caps text-label-caps text-on-surface-variant font-bold">长按结束</span>
          </div>

          <div class="flex flex-col items-center gap-1">
            <button
              aria-label="暂停跑步"
              class="w-20 h-20 rounded-full bg-gradient-to-br from-primary-container to-secondary-container text-on-primary flex items-center justify-center shadow-xl active:scale-95 transition-transform"
              type="button"
              @click="togglePause"
            >
              <Icon :name="run.status === 'paused' ? 'play_arrow' : 'pause'" :size="32" />
            </button>
            <span class="font-label-caps text-label-caps text-on-surface font-extrabold tracking-wider">
              {{ run.status === 'paused' ? '继续' : '暂停' }}
            </span>
          </div>

          <div class="flex flex-col items-center gap-1">
            <button
              aria-label="记录分段"
              class="w-12 h-12 rounded-full bg-surface-container text-on-surface flex items-center justify-center shadow-sm active:scale-95 transition-transform"
              type="button"
              @click="markLap"
            >
              <Icon name="flag" :size="22" />
            </button>
            <span class="font-label-caps text-label-caps text-on-surface-variant font-bold">计圈分段</span>
          </div>
        </div>
      </section>
    </div>

    <!-- 结束确认弹层 -->
    <div
      v-if="showFinishModal"
      class="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm flex items-center justify-center p-gutter animate-fade-in"
    >
      <div class="bg-surface-container-lowest w-full max-w-sm rounded-xl p-space-lg shadow-xl flex flex-col items-center text-center animate-pop-in">
        <div class="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-space-sm">
          <Icon name="check_circle" :size="32" />
        </div>
        <h3 class="font-headline-md text-headline-md font-bold text-on-surface mb-1">训练已完成！</h3>
        <p class="font-body-md text-body-md text-on-surface-variant mb-space-md">
          本次共跑步 <span class="font-bold text-primary">{{ run.distanceKm.toFixed(2) }}公里</span>，用时
          <span class="font-bold text-primary">{{ formatDuration(run.elapsedSec) }}</span>。<br />
          轨迹与训练数据已就绪，立即填写训练反馈。
        </p>
        <div class="flex items-center gap-space-sm w-full">
          <button
            class="flex-1 py-2 rounded-lg bg-surface-container text-on-surface font-semibold text-body-md"
            type="button"
            @click="showFinishModal = false"
          >
            继续跑步
          </button>
          <button
            class="flex-1 py-2 rounded-lg bg-primary text-on-primary font-semibold text-body-md shadow-md active:scale-95 flex items-center justify-center gap-1"
            type="button"
            @click="confirmFinish"
          >
            <span>填写反馈</span><Icon name="arrow_forward" :size="16" />
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
