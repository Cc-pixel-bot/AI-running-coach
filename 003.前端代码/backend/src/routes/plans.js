import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { matchTrainingTemplate } from '../domain/templateMatcher.js'

const router = Router()

function isMedicalRisk(profile) {
  return profile?.riskLevel === 'medical_confirm' || profile?.screening?.riskLevel === 'medical_confirm'
}

router.post('/match-template', requireAuth, async (req, res) => {
  const profile = req.body?.profile || {}
  if (profile.targetDistance !== '10K' && profile.targetDistance !== '10km') {
    return res.status(400).json({ message: '当前 Demo 仅支持 10 公里目标' })
  }
  if (isMedicalRisk(profile)) {
    return res.status(409).json({ blocked: true, message: '当前风险筛查需要医疗确认，暂不能生成正常训练计划' })
  }

  const template = matchTrainingTemplate(profile)
  return res.json({
    blocked: false,
    template: {
      ...template,
      sourceRefs: template.sourceRefs.map((source) => ({ ...source })),
      blueprint: template.blueprint.map((week) => ({ ...week, qualityPlan: { ...week.qualityPlan } })),
    },
    ruleType: '产品 Demo 规则',
  })
})

router.post('/confirm', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.execute(
      `UPDATE training_plan
       SET status = 'active', confirmed_at = CURRENT_TIMESTAMP(3)
       WHERE user_id = ? AND status = 'pending_confirm'
       ORDER BY id DESC LIMIT 1`,
      [req.auth.sub],
    )
    if (!result.affectedRows) return res.status(404).json({ message: '没有待确认的训练计划' })
    return res.json({ confirmed: true })
  } catch (error) {
    return next(error)
  }
})

export default router
