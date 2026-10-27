import { defineStore } from 'pinia'
import { DEMO_ACCOUNT, DEMO_PROFILES } from '../data/demoSeed.js'
import { load, save } from '../services/storage.js'

/** 登录态 + 演示模式开关 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: load('user', null),
    demoMode: load('demoMode', true),
    demoProfileKey: load('demoProfileKey', 'demo'),
  }),
  getters: {
    isLoggedIn: (s) => Boolean(s.user),
    demoProfiles: () => DEMO_PROFILES,
    currentDemoProfile() {
      return DEMO_PROFILES.find((p) => p.key === this.demoProfileKey) || DEMO_PROFILES[0]
    },
  },
  actions: {
    login(phone, password) {
      // Demo 阶段只开放项目内置演示账号，避免任意输入都被当作登录成功。
      const isDemo = phone === DEMO_ACCOUNT.phone && password === DEMO_ACCOUNT.password
      if (!isDemo) return null

      const user = {
        phone,
        nickname: DEMO_ACCOUNT.nickname,
        isDemo,
        loginAt: new Date().toISOString(),
      }
      this.user = user
      save('user', user)
      return user
    },
    loginAsDemo() {
      return this.login(DEMO_ACCOUNT.phone, DEMO_ACCOUNT.password)
    },
    logout() {
      this.user = null
      save('user', null)
    },
    setDemoMode(on) {
      this.demoMode = on
      save('demoMode', on)
    },
    setDemoProfile(key) {
      this.demoProfileKey = key
      save('demoProfileKey', key)
    },
  },
})
