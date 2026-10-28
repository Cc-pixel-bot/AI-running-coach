import { defineStore } from 'pinia'
import { load, save, clearUserData } from '../services/storage.js'
import { evaluateScreening } from '../domain/constants/screening.js'
import { parseDuration } from '../domain/utils/pace.js'
import { TARGET_TYPES } from '../domain/templates/trainingTemplates.js'
import { DEMO_PROFILE, createRandomDemoProfile } from '../data/demoSeed.js'
import { getProfileApi, saveProfileApi, confirmProfileApi } from '../services/profileApi.js'

/** 跑者档案（建档草稿 + 筛查结果） */
export const useProfileStore = defineStore('profile', {
  state: () => ({
    draft: load('profileDraft', null) || {},
    confirmed: load('profileConfirmed', false),
    confirmedAt: load('profileConfirmedAt', null),
  }),

  getters: {
    age: (s) => (s.draft.birthYear ? new Date().getFullYear() - Number(s.draft.birthYear) : null),
    bmi: (s) => {
      const { heightCm, weightKg } = s.draft
      if (!heightCm || !weightKg) return null
      return Number((weightKg / (heightCm / 100) ** 2).toFixed(1))
    },
    bmiLevel() {
      const bmi = this.bmi
      if (!bmi) return { label: '--', tone: 'muted' }
      if (bmi < 18.5) return { label: '偏瘦', tone: 'info' }
      if (bmi < 24) return { label: '正常', tone: 'good' }
      if (bmi < 28) return { label: '超重', tone: 'warn' }
      return { label: '肥胖', tone: 'danger' }
    },
    targetTypeMeta: (s) => TARGET_TYPES[s.draft.targetType] || null,
    /** 目标配速（秒/km） */
    targetPace() {
      const t = this.draft.targetTime
      if (typeof t === 'number' && t > 0) {
        const distanceKm = { '5K': 5, '10K': 10, HM: 21.0975, MARATHON: 42.195 }[this.draft.targetDistance] || 10
        return Math.round(t / distanceKm)
      }
      return typeof this.draft.targetPace === 'number' && this.draft.targetPace > 0 ? this.draft.targetPace : null
    },
    targetTotalSec() {
      const t = this.draft.targetTime
      if (typeof t === 'number' && t > 0) return t
      const pace = this.draft.targetPace
      const distanceKm = { '5K': 5, '10K': 10, HM: 21.0975, MARATHON: 42.195 }[this.draft.targetDistance] || 10
      return typeof pace === 'number' && pace > 0 ? Math.round(pace * distanceKm) : null
    },
    screeningResult: (s) => evaluateScreening(s.draft.screening || {}),
    /** 建档完整度（用于「快捷预览」与提交校验） */
    completionRatio(s) {
      const required = [
        'gender', 'birthYear', 'heightCm', 'weightKg', 'runsPerWeek',
        'weeklyKm', 'longestRunKm', 'easyPace', 'targetType', 'targetTime',
        'availableDays', 'availableMin', 'terrain',
      ]
      const done = required.filter((k) => s.draft[k] !== undefined && s.draft[k] !== null && s.draft[k] !== '').length
      return Math.round((done / required.length) * 100)
    },
    isComplete(s) {
      return s.draft.screening?.q1 && s.draft.screening?.q2 && s.draft.screening?.q3 && this.completionRatio >= 80
    },
  },

  actions: {
    /** 任意字段变更（含表单 v-model 直接改写）都持久化到本地 */
    persist() {
      save('profileDraft', this.draft)
    },
    async loadFromServer(token) {
      if (!token) return null
      const result = await getProfileApi(token)
      if (!result.profile) {
        clearUserData()
        this.draft = {}
        this.confirmed = false
        this.confirmedAt = null
        save('profileDraft', {})
        save('profileConfirmed', false)
        save('profileConfirmedAt', null)
        return null
      }
      const { profile, profileConfirmed, confirmedAt, id, ...draft } = result.profile
      this.draft = draft
      this.confirmed = Boolean(profileConfirmed)
      this.confirmedAt = confirmedAt || null
      save('profileDraft', this.draft)
      save('profileConfirmed', this.confirmed)
      save('profileConfirmedAt', this.confirmedAt)
      return this.draft
    },
    async saveToServer(token) {
      if (!token) throw new Error('登录已失效，请重新登录')
      const result = await saveProfileApi(token, {
        ...this.draft,
        riskLevel: this.screeningResult.riskLevel,
      })
      const { profile, profileConfirmed, confirmedAt, id, ...draft } = result.profile
      this.draft = draft
      this.confirmed = Boolean(profileConfirmed)
      this.confirmedAt = confirmedAt || null
      save('profileDraft', this.draft)
      save('profileConfirmed', this.confirmed)
      save('profileConfirmedAt', this.confirmedAt)
      return this.draft
    },
    async confirmOnServer(token) {
      if (!token) throw new Error('登录已失效，请重新登录')
      const result = await confirmProfileApi(token)
      this.confirmed = Boolean(result.profile?.profileConfirmed)
      this.confirmedAt = result.profile?.confirmedAt || new Date().toISOString()
      save('profileConfirmed', this.confirmed)
      save('profileConfirmedAt', this.confirmedAt)
      return this.confirmed
    },
    patch(values) {
      this.draft = { ...this.draft, ...values }
      save('profileDraft', this.draft)
    },
    setTargetTimeInput(text) {
      const sec = parseDuration(text)
      this.patch({ targetTime: sec, targetTimeInput: text })
    },
    setScreening(key, value) {
      const screening = { ...(this.draft.screening || {}) }
      if (key === 'q2') {
        const list = Array.isArray(value) ? value : []
        if (list.includes('none')) screening.q2 = ['none']
        else screening.q2 = list
      } else {
        screening[key] = value
      }
      this.patch({ screening })
    },
    loadDemo(profile = DEMO_PROFILE) {
      this.patch({ ...profile })
      this.confirmed = false
      this.confirmedAt = null
      save('profileConfirmed', false)
      save('profileConfirmedAt', null)
    },
    loadRandomDemo() {
      this.loadDemo(createRandomDemoProfile())
    },
    confirm() {
      this.confirmed = true
      this.confirmedAt = new Date().toISOString()
      save('profileConfirmed', true)
      save('profileConfirmedAt', this.confirmedAt)
    },
    reset() {
      this.draft = {}
      this.confirmed = false
      save('profileDraft', {})
      save('profileConfirmed', false)
    },
    /** 供引擎消费的规范化档案 */
    toEngineProfile() {
      return {
        ...this.draft,
        age: this.age,
        bmi: this.bmi,
        targetPace: this.targetPace,
        targetTotalSec: this.targetTotalSec,
        best5kPace: this.draft.best5kPace || null,
        best10kPace: this.draft.best10kPace || null,
        bestHmPace: this.draft.bestHmPace || null,
        bestMarPace: this.draft.bestMarPace || null,
        targetDistance: this.draft.targetDistance || this.targetTypeMeta?.distance || '10K',
        injuries: this.draft.injuries || [],
        screening: this.draft.screening || {},
        weeklyKm: Number(this.draft.weeklyKm) || 0,
        availableDays: Number(this.draft.availableDays) || 3,
        availableMin: Number(this.draft.availableMin) || 60,
      }
    },
  },
})
