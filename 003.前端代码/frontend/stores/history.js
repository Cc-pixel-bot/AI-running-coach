import { defineStore } from 'pinia'
import { load, save } from '../services/storage.js'

/**
 * AI 调整上下文缓存。
 * 训练记录仍由后端持久化，但当前产品不提供历史列表和数据趋势页面。
 */
export const useHistoryStore = defineStore('history', {
  state: () => ({
    records: load('records', []),
  }),

  getters: {
    /** 近 30 天单次最长距离（P6 规则的输入） */
    longest30dKm: (s) => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      const recent = s.records.filter((r) => new Date(r.date) >= cutoff)
      const max = recent.reduce((acc, r) => Math.max(acc, r.actualDistanceKm || 0), 0)
      return max || 0
    },
  },

  actions: {
    add(record) {
      this.records = [record, ...this.records]
      save('records', this.records)
    },
    remove(id) {
      this.records = this.records.filter((r) => r.id !== id)
      save('records', this.records)
    },
    reset() {
      this.records = []
      save('records', [])
    },
  },
})
