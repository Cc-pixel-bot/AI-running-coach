<script setup>
import { useRoute } from 'vue-router'
import Icon from '../ui/Icon.vue'

const route = useRoute()

const TABS = [
  { key: 'training', to: '/run/prep', icon: 'play_circle', label: '训练' },
  { key: 'plan', to: '/plan', icon: 'calendar_today', label: '计划' },
  { key: 'me', to: '/me', icon: 'smart_toy', label: '我的' },
]
</script>

<template>
  <nav class="app-tabbar fixed bottom-0 inset-x-0 z-40 pb-safe">
    <div class="app-tabbar-inner max-w-[440px] mx-auto flex justify-around items-center h-16 px-2">
      <router-link
        v-for="tab in TABS"
        :key="tab.key"
        :to="tab.to"
        class="app-tab flex flex-col items-center justify-center min-w-[72px] h-12 rounded-2xl transition-all"
        :class="route.meta.tab === tab.key ? 'app-tab-active' : 'text-on-surface-variant hover:text-on-surface'"
      >
        <Icon :name="tab.icon" :size="22" />
        <span class="font-label-caps text-label-caps mt-1">{{ tab.label }}</span>
      </router-link>
    </div>
  </nav>
</template>
