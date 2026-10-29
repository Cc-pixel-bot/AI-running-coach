/** 仅保存登录态与页面缓存；业务数据以服务端数据库为准。 */
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

/** 清除当前账号的业务数据，保留登录状态。 */
export function clearUserData() {
  const userKeys = [
    'profileDraft',
    'profileConfirmed',
    'profileConfirmedAt',
    'plan',
    'planConfirmed',
    'adjustmentLogs',
    'records',
    'lastRecord',
    'latestAdjustmentSummary',
    'profileAvatar',
  ]
  userKeys.forEach((key) => remove(key))
}

export function clearAll() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k))
}
