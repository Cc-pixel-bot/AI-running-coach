import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

/**
 * 路由表 —— PRD §7.2 接口清单对应的页面级路由。
 * 使用 hash 模式：静态托管（GitHub Pages / 简历附件）可直接打开，无需服务端 rewrite。
 *
 * 路由 meta 说明：
 *  - requiresAuth：需要登录
 *  - tab：底部导航归属
 *  - title：页面标题
 */
const routes = [
  { path: '/', redirect: '/login' },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/auth/LoginView.vue'),
    meta: { title: '登录', tab: null },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/profile/ProfileChatView.vue'),
    meta: { title: 'AI 建档', requiresAuth: true, tab: null },
  },
  {
    path: '/profile/confirm',
    name: 'profile-confirm',
    component: () => import('../views/profile/ProfileConfirmView.vue'),
    meta: { title: '档案确认', requiresAuth: true, tab: null },
  },
  {
    path: '/plan',
    name: 'plan',
    component: () => import('../views/plan/PlanOverviewView.vue'),
    meta: { title: '训练计划', requiresAuth: true, tab: 'plan' },
  },
  {
    path: '/plan/session/:id',
    name: 'session-detail',
    component: () => import('../views/plan/SessionDetailView.vue'),
    meta: { title: '课次详情', requiresAuth: true, tab: 'plan' },
  },
  {
    path: '/plan/adjust',
    name: 'plan-adjust',
    component: () => import('../views/plan/PlanAdjustView.vue'),
    meta: { title: '计划调整', requiresAuth: true, tab: 'plan' },
  },
  {
    path: '/run/prep',
    name: 'run-prep',
    // 今日训练直接复用课次详情，避免维护两套内容结构。
    component: () => import('../views/plan/SessionDetailView.vue'),
    meta: { title: '今日训练', requiresAuth: true, tab: 'training' },
  },
  {
    path: '/run/live',
    name: 'run-live',
    component: () => import('../views/run/RunExecuteView.vue'),
    meta: { title: '训练执行', requiresAuth: true, tab: null },
  },
  {
    path: '/feedback',
    name: 'feedback',
    component: () => import('../views/summary/FeedbackView.vue'),
    meta: { title: '训练反馈', requiresAuth: true, tab: null },
  },
  {
    path: '/summary',
    name: 'summary',
    component: () => import('../views/summary/SessionSummaryView.vue'),
    meta: { title: '训练总结', requiresAuth: true, tab: null },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../views/history/HistoryView.vue'),
    meta: { title: '训练记录', requiresAuth: true, tab: 'history' },
  },
  {
    path: '/trends',
    name: 'trends',
    component: () => import('../views/history/TrendsView.vue'),
    meta: { title: '数据趋势', requiresAuth: true, tab: 'trends' },
  },
  {
    path: '/me',
    name: 'me',
    component: () => import('../views/profile/MyProfileView.vue'),
    meta: { title: '我的', requiresAuth: true, tab: 'me' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/login' },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
