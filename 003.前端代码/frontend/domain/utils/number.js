/** 数值工具 */

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function round(value, decimals = 1) {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

/** 深拷贝（对象结构简单，够用） */
export function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}
