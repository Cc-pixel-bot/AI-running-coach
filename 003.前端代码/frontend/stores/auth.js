import { defineStore } from 'pinia'
import { load, save, remove, clearUserData } from '../services/storage.js'
import { loginApi, registerApi, deleteAccountApi, updateNicknameApi } from '../services/authApi.js'
import { useProfileStore } from './profile.js'
import { usePlanStore } from './plan.js'
import { useHistoryStore } from './history.js'

/** 登录态与账号信息 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: load('user', null),
    token: load('authToken', null),
  }),
  getters: {
    isLoggedIn: (s) => Boolean(s.user),
  },
  actions: {
    resetBusinessStores() {
      useProfileStore().reset()
      usePlanStore().reset()
      useHistoryStore().reset()
    },
    prepareUserData(phone) {
      const previousOwner = load('dataOwnerPhone', null)
      if (previousOwner !== phone) {
        clearUserData()
        this.resetBusinessStores()
      }
      save('dataOwnerPhone', phone)
    },
    async login(phone, password) {
      const result = await loginApi(phone, password)
      this.prepareUserData(phone)
      const user = { ...result.user, loginAt: new Date().toISOString() }
      this.user = user
      this.token = result.token
      save('user', user)
      save('authToken', result.token)
      const profile = useProfileStore()
      const plan = usePlanStore()
      await profile.loadFromServer(result.token)
      await plan.hydrateFromServer(result.token, profile.toEngineProfile())
      return user
    },
    async register(phone, password, nickname) {
      const result = await registerApi(phone, password, nickname)
      this.prepareUserData(phone)
      const user = { ...result.user, loginAt: new Date().toISOString() }
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
    async updateNickname(nickname) {
      if (!this.token) throw new Error('登录已失效，请重新登录')
      const result = await updateNicknameApi(this.token, nickname)
      this.user = { ...this.user, ...result.user }
      save('user', this.user)
      return this.user
    },
    logout() {
      this.user = null
      this.token = null
      save('user', null)
      save('authToken', null)
    },
  },
})
