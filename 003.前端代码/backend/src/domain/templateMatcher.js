import { TEMPLATES } from './trainingTemplates.js'

/**
 * 模板匹配规则均为产品 Demo 规则，不是官方分界值。
 */
export function matchTrainingTemplate(profile = {}) {
  const weeklyKm = Number(profile.weeklyKm) || 0
  const longestRunKm = Number(profile.longestRunKm) || 0
  const runsPerWeek = Number(profile.runsPerWeek ?? profile.availableDays) || 3
  const availableDays = Number(profile.availableDays) || 3
  const hasBest10k = Boolean(profile.best10kPace)

  if (runsPerWeek <= 2 || weeklyKm < 15 || longestRunKm < 6 || !hasBest10k) {
    if (runsPerWeek <= 2 || availableDays <= 2) return TEMPLATES['T10-ADAPT-2']
    if (weeklyKm >= 18 && availableDays >= 4) return TEMPLATES['T10-ADAPT-4']
    return TEMPLATES['T10-ADAPT-3']
  }

  if (runsPerWeek >= 4 && weeklyKm >= 30 && longestRunKm >= 10) return TEMPLATES['T10-ADV-4']
  if (runsPerWeek >= 3 && weeklyKm >= 26 && longestRunKm >= 9) return TEMPLATES['T10-ADV-3-PLUS']
  if (runsPerWeek >= 3 && weeklyKm >= 22 && longestRunKm >= 8) return TEMPLATES['T10-ADV-3']
  if (runsPerWeek >= 4) return TEMPLATES['T10-BASE-4']
  if (weeklyKm >= 20) return TEMPLATES['T10-BASE-3-PLUS']
  return TEMPLATES['T10-BASE-3']
}
