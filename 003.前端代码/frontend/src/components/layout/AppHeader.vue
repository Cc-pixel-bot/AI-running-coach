<script setup>
import { useRouter } from 'vue-router'
import Icon from '../ui/Icon.vue'
import coachAvatar from '../../assets/coach-avatar.png'

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  back: { type: Boolean, default: false },
  icon: { type: String, default: '' },
  fixed: { type: Boolean, default: true },
  showAvatar: { type: Boolean, default: true },
})
const router = useRouter()
</script>

<template>
  <header :class="['app-header inset-x-0 z-40 pt-safe', fixed ? 'fixed top-0' : 'relative']">
    <div class="app-header-inner h-16 px-gutter flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <button
          v-if="back"
          aria-label="返回"
          class="app-header-back w-10 h-10 -ml-space-xs rounded-2xl flex items-center justify-center text-on-surface hover:bg-surface-container active:scale-95 transition-all shrink-0"
          type="button"
          @click="router.back()"
        >
          <Icon name="arrow_back_ios_new" :size="20" />
        </button>
        <div v-else-if="icon" class="app-header-icon"><Icon :name="icon" :size="18" /></div>
        <div class="min-w-0">
          <h1 class="font-headline-sm text-headline-sm tracking-tight text-on-surface truncate">{{ title }}</h1>
          <p v-if="subtitle" class="font-body-sm text-body-sm text-on-surface-variant truncate">
            {{ subtitle }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <slot name="actions" />
        <router-link v-if="showAvatar" to="/me" class="app-header-avatar w-9 h-9 rounded-full overflow-hidden flex items-center justify-center">
          <img :src="coachAvatar" alt="我的" class="w-full h-full object-cover" />
        </router-link>
      </div>
    </div>
  </header>
</template>
