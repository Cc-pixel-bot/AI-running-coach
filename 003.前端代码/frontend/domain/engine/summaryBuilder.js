/**
 * 训练总结展示数据。正式总结和计划调整由后端 AI 返回；这里保留基础数据展示，
 * 用于 AI 服务异常时让训练记录仍然可查看。
 */
import { formatPace, formatDuration, formatDurationCn } from '../utils/pace.js'

const completionLabels = {
  full: '完全完成',
  mostly: '基本完成',
  partial: '部分完成',
  none: '未完成',
}

/**
 * @param {object} params
 * @param {object} params.session 课次
 * @param {object} params.record 训练记录 {actualDistanceKm, actualDurationSec, avgPace, bestPace, pauseCount, zoneSeconds}
 * @param {object} params.feedback 反馈
 * @param {Array} params.adjustments AI 返回的调整集合
 */
export function buildSummary({ session, record, feedback, adjustments = [] }) {
  const planned = session?.distanceKm || 0
  const actual = record?.actualDistanceKm ?? 0
  const durationSec = record?.actualDurationSec ?? 0
  const avgPace = record?.avgPace ?? 0
  const bestPace = record?.bestPace ?? 0
  const completion = feedback?.completion || 'full'
  const painScore = feedback?.painScore ?? 0
  const rpe = feedback?.rpe ?? 0
  const targetRpe = session?.intensity?.rpe?.[1] ?? null
  const paceLow = session?.intensity?.paceLow ?? 0
  const paceHigh = session?.intensity?.paceHigh ?? 0

  // —— ① 数据回放 ——
  const completionRatio = planned > 0 ? actual / planned : 1
  const dataReplay = []
  dataReplay.push(`本次 ${session?.title?.split('·')[0]?.trim() || '训练'} 完成 ${actual.toFixed(2)}km，用时 ${formatDuration(
    durationSec,
  )}，平均配速 ${formatPace(avgPace)}。`)
  if (planned > 0) {
    const delta = avgPace - ((paceLow + paceHigh) / 2)
    const within = avgPace >= paceLow && avgPace <= paceHigh
    dataReplay.push(
      `计划目标 ${planned.toFixed(1)}km（${formatPace(paceLow)}–${formatPace(paceHigh)}/km），实际完成率 ${Math.round(
        completionRatio * 100,
      )}%，平均配速${within ? '落在' : '偏离'}目标区间${within ? '' : ` ${Math.abs(Math.round(delta))} 秒/公里`}。`,
    )
  }
  if (bestPace) dataReplay.push(`最佳单公里配速 ${formatPace(bestPace)}。`)
  if (record?.pauseCount) dataReplay.push(`中途暂停 ${record.pauseCount} 次（自动暂停按计步器式处理，不计入用时）。`)

  // —— ② 做得好的地方 ——
  const positives = []
  if (completion === 'full') positives.push('完整完成了计划课次，训练连续性保持得很好')
  else if (completion === 'mostly') positives.push('基本完成了计划课次，说明当前负荷与你的恢复能力基本匹配')
  if (targetRpe && rpe > 0 && rpe <= targetRpe) positives.push(`主观强度 RPE ${rpe}，没有超过本课目标 RPE ${targetRpe}，强度控制准确`)
  if (painScore <= 2) positives.push('全程没有明显不适，关节与肌肉的反馈良好')
  if (record?.zoneSeconds && Object.keys(record.zoneSeconds).length) {
    const easySec = Object.entries(record.zoneSeconds)
      .filter(([z]) => ['easy', 'long', 'recovery'].includes(z))
      .reduce((acc, [, v]) => acc + v, 0)
    const totalSec = Object.values(record.zoneSeconds).reduce((a, b) => a + b, 0)
    if (totalSec && easySec / totalSec >= 0.7) {
      positives.push(`低强度区间占训练时间 ${Math.round((easySec / totalSec) * 100)}%，符合 80/20 的强度分布原则`)
    }
  }
  if (!positives.length) positives.push('本次数据已完整记录，可作为后续调整的基准')

  // —— ③ 需要注意 ——
  const watch = []
  if (painScore >= 4) watch.push(`疼痛评分 ${painScore} 分（部位：${(feedback?.painParts || []).join('、') || '未标注'}），需要重点处理`)
  else if (painScore >= 2) watch.push(`有轻微不适（疼痛评分 ${painScore} 分），下一课次注意强度控制`)
  if (targetRpe && rpe >= targetRpe + 2) watch.push(`RPE ${rpe} 明显高于本课目标 ${targetRpe}，提示累计疲劳偏高`)
  if (completion === 'none' || completion === 'partial') watch.push(`完成度为「${completionLabels[completion] || completion}」，负荷与恢复的匹配度需要下调`)
  if (record?.pauseCount >= 2) watch.push(`本次暂停 ${record.pauseCount} 次，提示配速或恢复存在问题`)
  if (feedback?.feel === 'very_hard') watch.push('自评「明显吃力」，下一次建议下调质量课强度')
  if (!watch.length) watch.push('没有需要特别处理的信号，保持当前节奏即可')

  // —— ④ 下一步（展示 AI 返回的调整结果）——
  const nextSteps = adjustments.length
    ? adjustments.map((a) => a.reasonText)
    : ['本次训练状态与当前计划匹配，继续执行原计划。']

  return {
    structure: [
      {
        key: 'replay',
        icon: 'analytics',
        title: '数据回放',
        paragraphs: dataReplay,
      },
      {
        key: 'positive',
        icon: 'thumb_up',
        title: '做得好的地方',
        paragraphs: positives,
      },
      {
        key: 'watch',
        icon: 'notifications_active',
        title: '需要注意的问题',
        paragraphs: watch,
      },
      {
        key: 'next',
        icon: 'event_upcoming',
        title: '下一步',
        paragraphs: nextSteps,
      },
    ],
    factsSnapshot: {
      plannedKm: planned,
      actualKm: actual,
      durationSec,
      avgPace,
      bestPace,
      completion,
      rpe,
      targetRpe,
      painScore,
      zoneSeconds: record?.zoneSeconds || {},
    },
  }
}

/** 兜底：纯模板一句话总结（PRD §7.3 模板兜底文案） */
export function fallbackSummary({ record, feedback }) {
  return `本次训练 ${record?.actualDistanceKm?.toFixed(2) || '0.00'}km，用时 ${formatDurationCn(
    record?.actualDurationSec || 0,
  )}，平均配速 ${formatPace(record?.avgPace || 0)}，完成度「${completionLabels[feedback?.completion] || feedback?.completion || '--'}」，RPE ${
    feedback?.rpe ?? '--'
  }，疼痛 ${feedback?.painScore ?? 0} 分。`
}

