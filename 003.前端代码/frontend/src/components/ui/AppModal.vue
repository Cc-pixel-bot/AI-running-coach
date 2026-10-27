<script setup>
import { useUiStore } from '../../stores/ui.js'
import Icon from './Icon.vue'

const ui = useUiStore()
</script>

<template>
  <div
    v-if="ui.modal"
    class="fixed inset-0 z-50 flex items-center justify-center px-gutter bg-on-surface/45 backdrop-blur-sm animate-fade-in"
    @click.self="ui.closeModal()"
  >
    <div class="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-card-lg p-5 flex flex-col gap-4 animate-pop-in">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-2">
          <span class="w-9 h-9 rounded-full bg-primary-fixed text-primary flex items-center justify-center shrink-0">
            <Icon :name="ui.modal.icon || 'info'" :size="20" />
          </span>
          <h3 class="font-headline-sm text-base text-on-surface font-bold leading-snug">
            {{ ui.modal.title }}
          </h3>
        </div>
        <button class="text-outline hover:text-on-surface p-1 -mr-1" type="button" @click="ui.closeModal()">
          <Icon name="close" :size="20" />
        </button>
      </div>

      <div class="text-body-sm text-on-surface-variant leading-relaxed space-y-2">
        <slot name="body">
          <p v-for="(line, i) in (ui.modal.body || []).split('\n')" :key="i">{{ line }}</p>
        </slot>
      </div>

      <div class="flex gap-2">
        <button
          v-if="ui.modal.cancelText"
          class="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-semibold text-body-sm"
          type="button"
          @click="ui.closeModal()"
        >
          {{ ui.modal.cancelText }}
        </button>
        <button
          class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary-container to-secondary-container text-on-primary font-semibold text-body-sm shadow-md"
          type="button"
          @click="ui.modal.onConfirm?.(); ui.closeModal()"
        >
          {{ ui.modal.confirmText || '我知道了' }}
        </button>
      </div>
    </div>
  </div>
</template>
