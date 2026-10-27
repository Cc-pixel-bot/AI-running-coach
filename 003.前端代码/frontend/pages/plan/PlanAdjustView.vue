<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlanStore } from '../../stores/plan.js'
import { useUiStore } from '../../stores/ui.js'
import AppHeader from '../../components/layout/AppHeader.vue'
import Icon from '../../components/ui/Icon.vue'
import StatusTag from '../../components/ui/StatusTag.vue'
import AdjustmentDiff from '../../components/plan/AdjustmentDiff.vue'
import AppButton from '../../components/ui/AppButton.vue'

const router = useRouter()
const planStore = usePlanStore()
const ui = useUiStore()

const logs = computed(() => planStore.adjustmentLogs)
const isSafetyAdjustment = computed(() => Boolean(planStore.pendingSafetyNotice))

function accept() {
  planStore.decideAdjustments('accepted')
  ui.toast('调整成功，训练计划已同步', 'success')
  router.push('/plan')
}

function reject() {
  planStore.decideAdjustments('rejected')
  ui.toast('已保持原计划，决策已留痕', 'info')
  router.push('/plan')
}
</script>

<template>
  <main class="min-h-screen bg-surface">
    <AppHeader title="AI训练计划调整" subtitle="根据本次训练反馈生成" back />

    <div class="pt-14 pb-10 px-gutter space-y-space-md">
      <section class="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
            <Icon name="auto_awesome" :size="20" filled />
          </div>
          <div>
            <h2 class="font-headline-sm text-headline-sm text-on-surface">智程识别到训练变化</h2>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">请确认下一次训练是否采用新的安排。</p>
          </div>
        </div>
      </section>

      <template v-if="planStore.pendingAdjustments.length">
        <section class="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-headline-sm text-headline-sm text-on-surface">训练问题</h2>
            <StatusTag :tone="isSafetyAdjustment ? 'danger' : 'brand'">
              {{ isSafetyAdjustment ? '安全优先' : `${planStore.pendingAdjustments.length} 处调整` }}
            </StatusTag>
          </div>
          <div class="space-y-2">
            <div v-for="item in planStore.pendingAdjustments" :key="item.reasonCode" class="rounded-xl bg-surface-container-low p-3">
              <p class="font-body-md text-body-md text-on-surface font-semibold">{{ item.target.label }}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">{{ item.reasonText }}</p>
            </div>
          </div>
        </section>

        <section class="bg-surface-container-lowest rounded-2xl p-4 shadow-card">
          <h2 class="font-headline-sm text-headline-sm text-on-surface mb-3">调整前后对比</h2>
          <AdjustmentDiff
            :items="planStore.pendingAdjustments.map((a) => ({
              label: a.target.label,
              beforeText: a.type === 'MODIFY_WEEK' ? `${a.before.targetKm}公里/周` : `${a.before?.distanceKm ?? 0}公里`,
              afterText: a.type === 'MODIFY_WEEK' ? `${a.after.targetKm}公里/周` : `${a.after?.distanceKm ?? 0}公里`,
              reasonText: a.reasonText,
              reasonCode: a.reasonCode,
            }))"
          />
        </section>

        <section class="space-y-2">
          <AppButton variant="primary" icon="check_circle" @click="accept">采纳调整</AppButton>
          <AppButton v-if="!isSafetyAdjustment" variant="secondary" @click="reject">保持原计划</AppButton>
        </section>
        <p v-if="isSafetyAdjustment" class="text-body-sm text-on-error-container bg-error-container rounded-xl p-3 leading-relaxed">
          检测到疼痛或安全风险，本次调整不可跳过，请先按保守方案训练。
        </p>
      </template>

      <section v-else class="bg-success-container/70 rounded-2xl p-5 text-center">
        <Icon name="check_circle" :size="28" class="text-on-success-container mx-auto" />
        <h2 class="font-headline-sm text-headline-sm text-on-success-container mt-2">当前没有待确认的调整</h2>
        <p class="font-body-sm text-body-sm text-on-success-container mt-1">训练计划保持不变，可以继续下一次训练。</p>
      </section>

      <AppButton variant="ghost" @click="router.push('/plan')">返回训练计划</AppButton>
    </div>
  </main>
</template>
