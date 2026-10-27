import { defineStore } from 'pinia'
import { load, save } from '../services/storage.js'
import { DEMO_HISTORY } from '../data/demoSeed.js'
import { round } from '../domain/utils/number.js'

/** 训练历史与趋势（PRD §E4） */
export const useHistoryStore = defineStore('history', {
  state: () => ({
    records: load('records', DEMO_HISTORY),
  }),

  getters: {
    /** 近 30 天单次最长距离（P6 规则的输入） */
    longest30dKm: (s) => {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      const recent = s.records.filter((r) => new Date(r.date) >= cutoff)
      const max = recent.reduce((acc, r) => Math.max(acc, r.actualDistanceKm || 0), 0)
      return max || 8
    },
    totalDistance: (s) => round(s.records.reduce((a, r) => a + (r.actualDistanceKm || 0), 0), 1),
    totalDuration: (s) => s.records.reduce((a, r) => a + (r.actualDurationSec || 0), 0),
    avgRpe() {
      const list = this.records.filter((r) => r.feedback?.rpe)
      if (!list.length) return 0
      return round(list.reduce((a, r) => a + r.feedback.rpe, 0) / list.length, 1)
    },
    /** 周维度趋势：最近 6 周的跑量 / 平均配速 / 完成率 */
    weeklyTrend(s) {
      const weeks = []
      const today = new Date()
      for (let i = 5; i >= 0; i -= 1) {
        const end = new Date(today)
        end.setDate(end.getDate() - i * 7)
        const start = new Date(end)
        start.setDate(start.getDate() - 6)
        const inRange = s.records.filter((r) => {
          const d = new Date(r.date)
          return d >= start && d <= end
        })
        const km = round(inRange.reduce((a, r) => a + (r.actualDistanceKm || 0), 0), 1)
        const running = inRange.filter((r) => r.actualDistanceKm > 0)
        const paceList = running.filter((r) => r.avgPace > 0).map((r) => r.avgPace)
        weeks.push({
          label: `${start.getMonth() + 1}/${start.getDate()}`,
          km,
          sessions: inRange.length,
          avgPace: paceList.length ? Math.round(paceList.reduce((a, b) => a + b, 0) / paceList.length) : 0,
          completionRate: inRange.length
            ? round(
                inRange.filter((r) => r.feedback?.completion === 'full').length / inRange.length,
                2,
              )
            : 0,
        })
      }
      return weeks
    },
    /** 强度区间累计（秒） */
    zoneTotals(s) {
      const totals = {}
      s.records.forEach((r) => {
        Object.entries(r.zoneSeconds || {}).forEach(([zone, sec]) => {
          totals[zone] = (totals[zone] || 0) + sec
        })
      })
      return totals
    },
    painAlerts(s) {
      return s.records.filter((r) => (r.feedback?.painScore || 0) >= 4)
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
      this.records = DEMO_HISTORY
      save('records', DEMO_HISTORY)
    },
  },
})
