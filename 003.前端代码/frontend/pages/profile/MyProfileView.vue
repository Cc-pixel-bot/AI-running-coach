<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { useProfileStore } from '../../stores/profile.js'
import { usePlanStore } from '../../stores/plan.js'
import { useUiStore } from '../../stores/ui.js'
import { clearAll, load, save } from '../../services/storage.js'
import Icon from '../../components/ui/Icon.vue'
import StatusTag from '../../components/ui/StatusTag.vue'
import AppButton from '../../components/ui/AppButton.vue'
import { formatPace } from '../../domain/utils/pace.js'
import coachAvatar from '../../assets/coach-avatar.png'

const router = useRouter()
const auth = useAuthStore()
const profile = useProfileStore()
const planStore = usePlanStore()
const ui = useUiStore()
const editingNickname = ref(false)
const editingPersonal = ref(false)
const nicknameDraft = ref(auth.user?.nickname || auth.user?.phone || '')
const avatarUrl = ref(load('profileAvatar', null))
const avatarInput = ref(null)


function logout() {
  auth.logout()
  ui.toast('已退出登录', 'info')
  router.push('/login')
}

async function saveNickname() {
  const value = nicknameDraft.value.trim()
  if (!value) return ui.toast('昵称不能为空', 'warn')
  try {
    await auth.updateNickname(value)
    editingNickname.value = false
    ui.toast('昵称已更新', 'success')
  } catch (error) {
    ui.toast(error.message || '昵称保存失败', 'error')
  }
}

function chooseAvatar() {
  if (!editingPersonal.value) return
  avatarInput.value?.click()
}

function changeAvatar(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    avatarUrl.value = String(reader.result)
    save('profileAvatar', avatarUrl.value)
    ui.toast('头像已更新', 'success')
  }
  reader.readAsDataURL(file)
}

function togglePersonalEdit() {
  if (editingPersonal.value) {
    editingPersonal.value = false
    editingNickname.value = false
    return
  }
  nicknameDraft.value = auth.user?.nickname || auth.user?.phone || ''
  editingPersonal.value = true
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
          <button class="w-14 h-14 rounded-2xl bg-primary-container/15 flex items-center justify-center shrink-0 overflow-hidden" :class="!editingPersonal && 'cursor-default'" type="button" aria-label="更换头像" :disabled="!editingPersonal" @click="chooseAvatar">
            <img :src="avatarUrl || coachAvatar" alt="头像" class="w-full h-full object-cover" />
          </button>
          <input ref="avatarInput" class="hidden" type="file" accept="image/*" @change="changeAvatar" />
          <div class="min-w-0">
            <div v-if="editingPersonal && editingNickname" class="flex items-center gap-1">
              <input v-model="nicknameDraft" class="field-input py-1 px-2 w-32" maxlength="50" @keyup.enter="saveNickname" />
              <button class="text-primary text-xs" type="button" @click="saveNickname">保存</button>
              <button class="text-outline text-xs" type="button" @click="editingNickname = false">完成</button>
            </div>
            <button v-else class="font-headline-sm text-headline-sm text-on-surface font-bold text-left" :class="!editingPersonal && 'cursor-default'" type="button" :disabled="!editingPersonal" @click="editingNickname = true">{{ auth.user?.nickname || auth.user?.phone || '跑者' }}</button>
            <p class="font-body-sm text-body-sm text-on-surface-variant">{{ profile.draft.gender === 'male' ? '男' : profile.draft.gender === 'female' ? '女' : '未填写' }} · 账号：{{ auth.user?.phone || '—' }}</p>
          </div>
          <button class="ml-auto w-10 h-10 rounded-full bg-white/70 text-primary flex items-center justify-center shrink-0" :aria-label="editingPersonal ? '完成编辑个人信息' : '编辑个人信息'" type="button" @click="togglePersonalEdit">
            <Icon :name="editingPersonal ? 'check' : 'edit'" :size="20" />
          </button>
        </div>
        <p class="mt-2 text-[11px] text-on-surface-variant">
          {{ editingPersonal ? '点击头像更换照片，点击昵称修改名称' : '点击右侧编辑按钮修改个人信息' }}
        </p>
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
        </div>
      </section>

      <!-- 隐私与合规 -->
      <section class="bg-surface-container-lowest rounded-xl p-space-md shadow-card">
        <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5 mb-2">
          <span class="w-1.5 h-4 bg-error rounded-full" />隐私与合规
        </h2>
        <div class="space-y-1.5 text-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          <p class="flex items-start gap-1.5">
            <span class="text-outline shrink-0">定位数据</span>
            <span>仅用于记录本次训练轨迹，并随训练记录保存。</span>
          </p>
          <p class="flex items-start gap-1.5">
            <span class="text-outline shrink-0">训练安全</span>
            <span>用于帮助智程评估训练安排，不替代专业医疗建议。</span>
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
