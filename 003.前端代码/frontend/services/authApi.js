// Vite 开发服务使用代理；Live Server（默认 5500）和直接打开静态文件则直连本地 API。
const isLiveServer = window.location.port === '5500'
const isFilePage = window.location.protocol === 'file:'
const defaultApiBase = isLiveServer || isFilePage ? 'http://localhost:3001/api' : '/api'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/$/, '')

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    })
  } catch {
    const error = new Error('无法连接登录服务，请先启动后端服务')
    error.code = 'API_UNAVAILABLE'
    throw error
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || '请求失败，请稍后重试')
    error.status = response.status
    throw error
  }
  return data
}

export function loginApi(phone, password) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) })
}

export function registerApi(phone, password, nickname) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify({ phone, password, nickname }) })
}

export function meApi(token) {
  return request('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
}
