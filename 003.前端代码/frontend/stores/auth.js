import { defineStore } from 'pinia'
import { DEMO_ACCOUNT, DEMO_PROFILES } from '../data/demoSeed.js'
import { load, save } from '../services/storage.js'
import { loginApi, registerApi } from '../services/authApi.js'

/** 登录态 + 演示模式开关 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: load('user', null),
    demoMode: load('demoMode', true),
    demoProfileKey: load('demoProfileKey', 'demo'),
    token: load('authToken', null),
  }),
  getters: {
    isLoggedIn: (s) => Boolean(s.user),
    demoProfiles: () => DEMO_PROFILES,
    currentDemoProfile() {
      return DEMO_PROFILES.find((p) => p.key === this.demoProfileKey) || DEMO_PROFILES[0]
    },
  },
  actions: {
    async login(phone, password) {
      const result = await loginApi(phone, password)
      const user = { ...result.user, isDemo: phone === DEMO_ACCOUNT.phone, loginAt: new Date().toISOString() }
      this.user = user
      this.token = result.token
      save('user', user)
      save('authToken', result.token)
      return user
    },
    async register(phone, password, nickname) {
      const result = await registerApi(phone, password, nickname)
      const user = { ...result.user, isDemo: false, loginAt: new Date().toISOString() }
      this.user = user
      this.token = result.token
      save('user', user)
      save('authToken', result.token)
      return user
    },
    logout() {
      this.user = null
      this.token = null
      save('user', null)
      save('authToken', null)
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
