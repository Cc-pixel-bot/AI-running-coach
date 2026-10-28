import { defineStore } from 'pinia'

/** 全局 UI 状态：Toast / 弹窗 */
export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [],
    modal: null,
  }),
  actions: {
    toast(text, type = 'info', duration = 2600) {
      const id = Date.now() + Math.random()
      this.toasts.push({ id, text, type })
      setTimeout(() => this.dismiss(id), duration)
    },
    dismiss(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },
    clearToasts() {
      this.toasts = []
    },
    openModal(payload) {
      this.modal = { id: Date.now(), ...payload }
    },
    closeModal() {
      this.modal = null
    },
  },
})
