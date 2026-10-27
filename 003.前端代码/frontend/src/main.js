import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import { useProfileStore } from './stores/profile.js'
import { save } from './services/storage.js'
import './styles/tokens.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 档案草稿的任何变更（含表单 v-model 直接改写）都持久化到本地
useProfileStore(pinia).$subscribe(
  (_mutation, state) => {
    save('profileDraft', state.draft)
  },
  { detached: true },
)

app.mount('#app')
