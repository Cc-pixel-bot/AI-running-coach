<script setup>
import Icon from '../ui/Icon.vue'
import coachAvatar from '../../assets/coach-avatar.png'

/** 智程教练提示条 */
defineProps({
  title: { type: String, default: '智程教练' },
  text: { type: String, required: true },
  icon: { type: String, default: 'smart_toy' },
  tag: { type: String, default: '' },
})
</script>

<template>
  <div class="coach-banner rounded-2xl p-3.5 flex items-start gap-3 shadow-sm">
    <div class="w-9 h-9 rounded-xl overflow-hidden bg-white flex-shrink-0 shadow-sm">
      <img :src="coachAvatar" alt="智程头像" class="w-full h-full object-cover" />
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <span class="font-label-data text-label-data text-on-primary-fixed font-semibold">{{ title }}</span>
        <span v-if="tag" class="font-body-sm text-body-sm text-primary font-medium">{{ tag }}</span>
      </div>
      <p class="font-body-md text-body-md text-on-primary-fixed-variant mt-0.5 leading-snug">{{ text }}</p>
    </div>
  </div>
</template>
