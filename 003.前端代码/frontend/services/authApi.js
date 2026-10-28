// Vite 开发服务使用代理；Live Server（默认 5500）和直接打开静态文件则直连本地 API。
import { requestApi } from './requestApi.js'

export function loginApi(phone, password) {
  return requestApi('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) })
}

export function registerApi(phone, password, nickname) {
  return requestApi('/auth/register', { method: 'POST', body: JSON.stringify({ phone, password, nickname }) })
}

export function meApi(token) {
  return requestApi('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
}

export function deleteAccountApi(token) {
  return requestApi('/auth/account', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function generateAiPlanApi(token, profile) {
  return requestApi('/ai/plans/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ profile }),
  })
}

export function checkGoalRecommendationApi(token, profile) {
  return requestApi('/ai/plans/goal-recommendation', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ profile }),
  })
}

export function confirmPlanApi(token) {
  return requestApi('/plans/confirm', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}
