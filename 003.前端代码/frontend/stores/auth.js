import { defineStore } from 'pinia'
import { DEMO_ACCOUNT, DEMO_PROFILES } from '../data/demoSeed.js'
import { load, save, remove, clearUserData } from '../services/storage.js'
import { loginApi, registerApi, deleteAccountApi } from '../services/authApi.js'
import { useProfileStore } from './profile.js'
import { usePlanStore } from './plan.js'
import { useHistoryStore } from './history.js'

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
    resetBusinessStores() {
      useProfileStore().reset()
      usePlanStore().reset()
      useHistoryStore().reset()
    },
    prepareUserData(phone) {
      const previousOwner = load('dataOwnerPhone', null)
      // 本地演示数据原来没有账号归属标记，首次接入账号体系时也要清掉，避免串号。
      if (previousOwner !== phone) {
        clearUserData()
        this.resetBusinessStores()
      }
      save('dataOwnerPhone', phone)
    },
    async login(phone, password) {
      const result = await loginApi(phone, password)
      this.prepareUserData(phone)
      const user = { ...result.user, isDemo: phone === DEMO_ACCOUNT.phone, loginAt: new Date().toISOString() }
      this.user = user
      this.token = result.token
      save('user', user)
      save('authToken', result.token)
      return user
    },
    async register(phone, password, nickname) {
      const result = await registerApi(phone, password, nickname)
      this.prepareUserData(phone)
      const user = { ...result.user, isDemo: false, loginAt: new Date().toISOString() }
      this.user = user
      this.token = result.token
      save('user', user)
      save('authToken', result.token)
      return user
    },
    async deleteAccount() {
      if (!this.token) throw new Error('登录已失效，请重新登录')
      await deleteAccountApi(this.token)
      this.resetBusinessStores()
      clearUserData()
      remove('dataOwnerPhone')
      this.user = null
      this.token = null
      save('user', null)
      save('authToken', null)
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
