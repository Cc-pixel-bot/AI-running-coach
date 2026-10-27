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

function accept() {
  planStore.decideAdjustments('accepted')
  ui.toast('调整已采纳', 'success')
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
    <AppHeader title="计划调整" subtitle="训练调整记录 · 智程" back />

    <div class="pt-14 pb-10 px-gutter space-y-space-md">
      <!-- 待确认调整 -->
      <section v-if="planStore.pendingAdjustments.length" class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
            <span class="section-bar" />待确认的变更
          </h2>
          <StatusTag tone="brand">{{ planStore.pendingAdjustments.length }} 处</StatusTag>
        </div>
        <AdjustmentDiff
          :items="planStore.pendingAdjustments.map((a) => ({
            label: a.target.label,
            beforeText:
              a.type === 'MODIFY_WEEK'
                ? `${a.before.targetKm}公里/周`
                : `${a.before?.distanceKm ?? 0}km`,
            afterText:
              a.type === 'MODIFY_WEEK'
                ? `${a.after.targetKm}公里/周`
                : `${a.after?.distanceKm ?? 0}km`,
            reasonText: a.reasonText,
            reasonCode: a.reasonCode,
          }))"
        />
        <div class="flex gap-2 pt-3">
          <AppButton variant="primary" @click="accept">采纳调整</AppButton>
          <AppButton variant="secondary" @click="reject">保持原计划</AppButton>
        </div>
      </section>

      <!-- 历史留痕 -->
      <section>
        <div class="flex items-center justify-between px-0.5 mb-2">
          <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
            <span class="w-1.5 h-4 bg-secondary-container rounded-full" />调整记录
          </h2>
          <span class="font-label-data text-label-data text-on-surface-variant">共 {{ logs.length }} 次</span>
        </div>

        <div v-if="!logs.length" class="bg-surface-container-lowest rounded-xl p-6 text-center">
          <Icon name="history" :size="24" class="text-outline mx-auto mb-1" />
          <p class="text-body-sm text-on-surface-variant">还没有调整记录，完成一次训练并提交反馈后会自动生成。</p>
        </div>

        <div
          v-for="log in logs"
          :key="log.id"
          class="bg-surface-container-lowest rounded-xl p-space-md shadow-card border border-outline-variant/20 space-y-2"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <StatusTag :tone="log.decision === 'accepted' ? 'good' : 'muted'" :icon="log.decision === 'accepted' ? 'check_circle' : 'undo'">
                {{ log.decision === 'accepted' ? '已采纳' : '已拒绝' }}
              </StatusTag>
              <span class="font-body-sm text-body-sm text-on-surface-variant">{{ log.date }}</span>
            </div>
            <span class="font-label-data text-label-data text-on-surface-variant">{{ log.count }} 处变更</span>
          </div>
          <AdjustmentDiff :items="log.items" />
        </div>
      </section>

      <p class="disclaimer">
        「保持原计划」也会保留记录（写入 adjustment_log，标注 user_rejected），供后续规则参考。
      </p>
    </div>
  </main>
</template>
