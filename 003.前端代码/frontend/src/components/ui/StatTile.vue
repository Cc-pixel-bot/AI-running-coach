<script setup>
import Icon from './Icon.vue'

/** 指标格（PRD §3.3.1：大号训练数据、粗体数字） */
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  unit: { type: String, default: '' },
  hint: { type: String, default: '' },
  hintIcon: { type: String, default: '' },
  tone: { type: String, default: 'default' }, // default | brand | good | danger
})
</script>

<template>
  <div class="bg-surface-container-lowest rounded-xl p-space-sm shadow-card flex flex-col justify-between gap-1">
    <span class="font-label-caps text-label-caps text-on-surface-variant uppercase flex items-center gap-1">
      <Icon v-if="hintIcon" :name="hintIcon" :size="14" />
      {{ label }}
    </span>
    <div class="my-1 flex items-baseline gap-1">
      <span
        class="font-metric-huge-mobile text-metric-huge-mobile tracking-tight"
        :class="{
          'text-on-surface': tone === 'default',
          'text-primary-container': tone === 'brand',
          'text-success': tone === 'good',
          'text-error': tone === 'danger',
        }"
        >{{ value }}</span
      >
      <span v-if="unit" class="font-label-data text-label-data text-on-surface-variant">{{ unit }}</span>
    </div>
    <span
      class="font-body-sm text-body-sm flex items-center gap-1"
      :class="{
        'text-on-surface-variant': tone === 'default',
        'text-primary-container': tone === 'brand',
        'text-success': tone === 'good',
        'text-error': tone === 'danger',
      }"
    >
      <Icon v-if="hintIcon" :name="hintIcon" :size="13" />
      {{ hint }}
    </span>
  </div>
</template>
