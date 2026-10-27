<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppTabBar from './components/layout/AppTabBar.vue'
import ToastHost from './components/ui/ToastHost.vue'
import AppModal from './components/ui/AppModal.vue'

const route = useRoute()
const showTabBar = computed(() => Boolean(route.meta.tab))
</script>

<template>
  <div class="min-h-full bg-surface">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>

    <AppTabBar v-if="showTabBar" />
    <ToastHost />
    <AppModal />
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
