<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { useProfileStore } from '../../stores/profile.js'
import { usePlanStore } from '../../stores/plan.js'
import { useHistoryStore } from '../../stores/history.js'
import { useUiStore } from '../../stores/ui.js'
import { clearAll } from '../../services/storage.js'
import Icon from '../../components/ui/Icon.vue'
import StatusTag from '../../components/ui/StatusTag.vue'
import AppButton from '../../components/ui/AppButton.vue'
import { formatPace } from '../../domain/utils/pace.js'

const router = useRouter()
const auth = useAuthStore()
const profile = useProfileStore()
const planStore = usePlanStore()
const history = useHistoryStore()
const ui = useUiStore()


function logout() {
  auth.logout()
  ui.toast('已退出登录', 'info')
  router.push('/login')
}

function clearEverything() {
  clearAll()
  ui.toast('已清除全部本地数据（含位置数据与档案）', 'success')
  router.push('/login')
}

function resetAll() {
  profile.reset()
  planStore.reset()
  history.reset()
  auth.logout()
  ui.toast('已重置本地演示数据', 'success')
  router.replace('/login')
}

function requestDeleteAccount() {
  ui.openModal({
    icon: 'delete_forever',
    title: '注销账号',
    body: '注销后将删除该账号及其跑者档案、训练计划、训练记录和反馈数据，且无法恢复。确定继续吗？',
    cancelText: '取消',
    confirmText: '确认注销',
    onConfirm: deleteAccount,
  })
}

async function deleteAccount() {
  try {
    await auth.deleteAccount()
    clearAll()
    ui.toast('账号已注销，相关数据已删除', 'success')
    router.replace('/login')
  } catch (error) {
    ui.toast(error.message || '注销失败，请稍后重试', 'error')
  }
}
</script>

<template>
  <main class="min-h-screen bg-surface">
    <div class="pt-4 pb-24 px-gutter space-y-space-md">
      <!-- 用户卡 -->
      <section class="bg-gradient-to-br from-[#FFF3E8] to-[#FFF9F3] rounded-2xl border border-primary-container/20 p-4 shadow-card">
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 rounded-2xl bg-primary-container/15 flex items-center justify-center shrink-0">
            <Icon name="smart_toy" :size="28" class="text-primary-container" filled />
          </div>
          <div class="min-w-0">
            <p class="font-headline-sm text-headline-sm text-on-surface font-bold">{{ auth.user?.nickname || '跑者' }}</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">
              {{ profile.draft.gender === 'male' ? '男' : profile.draft.gender === 'female' ? '女' : '—' }} ·
              {{ profile.age ?? '—' }}岁 · {{ profile.draft.heightCm ?? '—' }}cm / {{ profile.draft.weightKg ?? '—' }}kg
            </p>
          </div>
        </div>
      </section>

      <!-- 当前计划 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5 mb-2">
          <span class="section-bar" />当前计划
        </h2>
        <div v-if="planStore.plan" class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="font-body-sm text-body-sm text-on-surface-variant">模板</span>
            <span class="font-body-sm text-body-sm text-on-surface font-semibold">{{ planStore.plan.templateName }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="font-body-sm text-body-sm text-on-surface-variant">目标配速</span>
            <span class="font-body-sm text-body-sm text-primary font-semibold">
              {{ formatPace(planStore.plan.goalPace) }}/公里
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="font-body-sm text-body-sm text-on-surface-variant">周期</span>
            <span class="font-body-sm text-body-sm text-on-surface font-semibold">
              第 {{ planStore.plan.currentWeek }} / {{ planStore.plan.totalWeeks }} 周
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="font-body-sm text-body-sm text-on-surface-variant">状态</span>
            <StatusTag :tone="planStore.confirmed ? 'good' : 'warn'">
              {{ planStore.confirmed ? '执行中' : '待确认' }}
            </StatusTag>
          </div>
        </div>
        <p v-else class="text-body-sm text-on-surface-variant">尚未生成训练计划。</p>
        <div class="flex gap-2 pt-3">
          <AppButton variant="secondary" size="sm" @click="router.push('/plan')">查看计划</AppButton>
          <AppButton variant="secondary" size="sm" @click="router.push('/plan/adjust')">调整记录</AppButton>
        </div>
      </section>

      <!-- 演示设置 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5 mb-2">
          <span class="w-1.5 h-4 bg-secondary-container rounded-full" />演示设置
        </h2>

        <label class="flex items-center justify-between py-2 border-b border-surface-container">
          <div>
            <p class="font-body-md text-body-md text-on-surface">演示模式</p>
            <p class="font-body-sm text-body-sm text-on-surface-variant">固定智能输出，保证演示结果可复现</p>
          </div>
          <input
            type="checkbox"
            class="w-5 h-5 accent-primary-container"
            :checked="auth.demoMode"
            @change="auth.setDemoMode($event.target.checked)"
          />
        </label>

        <div class="py-2 border-b border-surface-container">
          <p class="font-body-md text-body-md text-on-surface">演示档案</p>
          <p class="font-body-sm text-body-sm text-on-surface-variant">切换预置档案，应对现场问询</p>
          <div class="flex flex-col gap-1.5 pt-2">
            <button
              v-for="p in auth.demoProfiles"
              :key="p.key"
              class="text-left px-2.5 py-2 rounded-lg text-body-sm transition-colors"
              :class="auth.demoProfileKey === p.key ? 'bg-primary-fixed text-primary font-semibold' : 'bg-surface-container-low text-on-surface'"
              type="button"
              @click="auth.setDemoProfile(p.key)"
            >
              {{ p.name }}
            </button>
          </div>
        </div>

        <div class="flex gap-2 mt-3">
          <button
            class="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-headline-sm text-[14px] active:scale-[0.99] transition-transform"
            type="button"
            @click="resetAll"
          >
            重置演示数据
          </button>
          <button
            class="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-headline-sm text-[14px] active:scale-[0.99] transition-transform"
            type="button"
            @click="clearEverything"
          >
            清除全部本地数据
          </button>
        </div>
      </section>

      <!-- 隐私与合规 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5 mb-2">
          <span class="w-1.5 h-4 bg-error rounded-full" />隐私与合规
        </h2>
        <div class="space-y-1.5 text-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          <p class="flex items-start gap-1.5">
            <Icon name="my_location" :size="14" class="text-outline mt-0.5 shrink-0" />
            位置数据只用于本次训练，默认保存 30 天，可在训练页面清除。
          </p>
          <p class="flex items-start gap-1.5">
            <Icon name="medical_services" :size="14" class="text-outline mt-0.5 shrink-0" />
            本产品仅提供运动训练信息，不构成医疗诊断、用药或康复治疗建议。
          </p>
        </div>
      </section>

      <AppButton variant="secondary" icon="logout" @click="logout">退出登录</AppButton>

      <button
        class="w-full py-3 rounded-xl border border-error/30 text-error font-headline-sm text-[14px] hover:bg-error-container/40 active:scale-[0.99] transition-transform"
        type="button"
        @click="requestDeleteAccount"
      >
        注销账号
      </button>
    </div>
  </main>
</template>
