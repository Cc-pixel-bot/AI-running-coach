<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import { useProfileStore } from '../../stores/profile.js'
import { useUiStore } from '../../stores/ui.js'
import Icon from '../../components/ui/Icon.vue'
import AppButton from '../../components/ui/AppButton.vue'
import coachAvatar from '../../assets/coach-avatar.png'
import trackBackground from '../../assets/login-track-bg.png'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const profile = useProfileStore()
const ui = useUiStore()

/** 登录后：有档案走计划，没有档案先走建档 */
function nextRoute() {
  if (route.query.redirect) return route.query.redirect
  return profile.confirmed ? '/plan' : '/profile'
}

const account = ref('')
const password = ref('')
const passwordConfirm = ref('')
const isRegister = ref(false)
const showPwd = ref(false)
const loading = ref(false)

function go(target) {
  router.push(target)
}

async function handleLogin() {
  if (!account.value || !password.value) {
    ui.toast('请输入账号与密码', 'warn')
    return
  }
  if (isRegister.value && password.value !== passwordConfirm.value) {
    ui.toast('两次输入的密码不一致', 'warn')
    return
  }
  loading.value = true
  try {
    const user = isRegister.value
      ? await auth.register(account.value.trim(), password.value, account.value.trim())
      : await auth.login(account.value.trim(), password.value)
    ui.toast(isRegister.value ? '注册成功' : '登录成功', 'success')
    go(nextRoute())
  } catch (error) {
    ui.toast(error.message || '操作失败，请稍后重试', 'error')
  } finally {
    loading.value = false
  }
}

function toggleMode() {
  isRegister.value = !isRegister.value
  passwordConfirm.value = ''
  showPwd.value = false
}

function openTerms() {
  ui.openModal({
    icon: 'description',
    title: '服务协议',
    body:
      '智程提供的训练信息与建议不构成医疗建议。开始或修改运动计划前，请咨询有资质的医疗专业人员。\n\n用户应如实填写身体数据；若在训练中出现疼痛、头晕、胸闷等不适，应立即停止训练并就医。',
    confirmText: '已阅读并知悉',
  })
}

function openPrivacy() {
  ui.openModal({
    icon: 'lock',
    title: '隐私保护指引',
    body: `智程会使用你的账号信息、跑者档案、训练记录和反馈生成个性化训练计划，并将相关数据保存在服务端。

你可以在“我的”页面退出登录，或申请注销账号及删除关联数据。`,
    confirmText: '已阅读并知悉',
  })
}
</script>

<template>
  <main class="relative w-full min-h-screen flex flex-col overflow-hidden">
    <div class="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <img :src="trackBackground" alt="" class="absolute inset-0 w-full h-full object-cover object-center" />
      <div class="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-slate-950/10 to-slate-950/65" />
    </div>

    <div class="flex flex-col w-full px-gutter pb-8 text-on-surface relative z-10 flex-1">
      <!-- 品牌区 -->
      <section class="flex flex-col items-center text-center mt-8 mb-8">
        <div class="w-20 h-20 rounded-full overflow-hidden bg-white shadow-lg shadow-orange-500/30 mb-3 ring-2 ring-white/70">
          <img :src="coachAvatar" alt="智程头像" class="w-full h-full object-cover" />
        </div>
        <h1 class="brand-name text-headline-lg text-primary-container drop-shadow-md">
          <span class="brand-char brand-char-first">智</span><span class="brand-char">程</span>
        </h1>
        <p class="font-body-md text-body-md text-white/90 font-medium drop-shadow-sm">你的专属跑步教练</p>
      </section>

      <!-- 表单卡 -->
      <section class="w-full bg-white/[0.76] backdrop-blur-sm rounded-2xl p-6 shadow-card-lg border border-white/50 mb-6">
        <div class="flex flex-col items-center justify-center mb-6 border-b border-surface-container/60 pb-3">
          <h2 class="font-headline-sm text-headline-sm text-primary font-bold tracking-tight">{{ isRegister ? '注册账号' : '账号登录' }}</h2>
          <span class="w-8 h-0.5 bg-primary rounded-full mt-2" />
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="handleLogin">
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="font-label-caps text-label-caps text-on-surface-variant font-semibold" for="account-input">
                账号
              </label>
            </div>
            <div
              class="flex h-12 items-center bg-surface-container-low/80 rounded-xl px-3.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/40 border border-transparent focus-within:border-primary/20 transition-all"
            >
              <input
                id="account-input"
                v-model="account"
                autocomplete="off"
                class="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline outline-none"
                placeholder="请输入账号"
                type="text"
              />
            </div>
          </div>

          <div v-if="isRegister" class="flex flex-col gap-1.5">
            <label class="font-label-caps text-label-caps text-on-surface-variant font-semibold" for="pwd-confirm-input">确认密码</label>
            <div
              class="flex h-12 items-center bg-surface-container-low/80 rounded-xl px-3.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/40 border border-transparent focus-within:border-primary/20 transition-all"
            >
              <input
                id="pwd-confirm-input"
                v-model="passwordConfirm"
                autocomplete="new-password"
                class="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline outline-none"
                placeholder="请再次输入密码"
                :type="showPwd ? 'text' : 'password'"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="font-label-caps text-label-caps text-on-surface-variant font-semibold" for="pwd-input">密码</label>
              <a v-if="!isRegister" class="font-body-sm text-body-sm text-primary hover:underline cursor-pointer" @click="ui.toast('请联系管理员重置密码', 'info')">
                忘记密码？
              </a>
            </div>
            <div
              class="flex h-12 items-center bg-surface-container-low/80 rounded-xl px-3.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/40 border border-transparent focus-within:border-primary/20 transition-all"
            >
              <input
                id="pwd-input"
                v-model="password"
                autocomplete="off"
                class="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline outline-none"
                placeholder="请输入密码"
                :type="showPwd ? 'text' : 'password'"
              />
              <button class="text-outline hover:text-on-surface p-1" type="button" @click="showPwd = !showPwd">
                <Icon :name="showPwd ? 'visibility' : 'visibility_off'" :size="20" />
              </button>
            </div>
          </div>

          <AppButton variant="primary" :disabled="loading" icon="arrow_forward" @click="handleLogin">
            {{ loading ? (isRegister ? '注册中…' : '登录中…') : (isRegister ? '注册' : '登录') }}
          </AppButton>

          <div class="text-center mt-1">
            <span class="font-body-sm text-body-sm text-outline">{{ isRegister ? '已有账号？' : '没有账号？' }}</span>
            <button
              class="font-body-sm text-body-sm text-primary font-semibold underline underline-offset-2 ml-1 hover:text-primary-container"
              type="button"
              @click="toggleMode"
            >
              {{ isRegister ? '立即登录' : '立即注册' }}
            </button>
          </div>

        </form>
      </section>

      <footer class="mt-auto flex flex-col items-center text-center gap-2 pt-4">
        <p class="font-body-sm text-body-sm text-white/80 drop-shadow-sm">
          登录即代表同意
          <a class="text-primary-fixed font-medium underline underline-offset-2 hover:text-white cursor-pointer" @click="openTerms">服务协议</a>
          与
          <a class="text-primary-fixed font-medium underline underline-offset-2 hover:text-white cursor-pointer" @click="openPrivacy">隐私保护指引</a>
        </p>
      </footer>
    </div>
  </main>
</template>

<style scoped>
.brand-name {
  font-family: 'Space Grotesk', Arial, 'Microsoft YaHei', sans-serif;
  display: block;
  width: 100%;
  text-align: center;
  font-size: 2.15rem;
  line-height: 1.15;
  font-weight: 900;
  letter-spacing: 0.08em;
  padding-left: 0.08em;
  -webkit-text-stroke: 0.35px currentColor;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.28);
}

.brand-char {
  display: inline-block;
  vertical-align: bottom;
}

.brand-char-first {
  transform: scaleY(1.025);
  transform-origin: center bottom;
}
</style>
