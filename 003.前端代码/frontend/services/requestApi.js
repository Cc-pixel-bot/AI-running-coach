const runtimeLocation = typeof window === 'undefined' ? { port: '5173', protocol: 'http:' } : window.location
const isLiveServer = runtimeLocation.port === '5500'
const isFilePage = runtimeLocation.protocol === 'file:'
const defaultApiBase = isLiveServer || isFilePage ? 'http://localhost:3001/api' : '/api'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultApiBase).replace(/\/$/, '')

export async function requestApi(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
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
