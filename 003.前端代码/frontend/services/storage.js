/** 本地持久化（Demo 阶段用 localStorage 模拟后端数据库） */
const PREFIX = 'zhicheng:'

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch (e) {
    console.warn('[storage] 读取失败', key, e)
    return fallback
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (e) {
    console.warn('[storage] 写入失败', key, e)
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch (e) {
    console.warn('[storage] 删除失败', key, e)
  }
}

export function clearAll() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k))
}
