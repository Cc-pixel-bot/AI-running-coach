/**
 * AI 语音陪跑话术 —— 当前版本的训练过程提示。
 *
 * 触发规则（Demo 简化为 5 类）：开跑 / 每公里 / 强度提醒 / 时间节点 / 收尾。
 * 实现要点（PRD 原文）：文案在训练开始前一次性预生成并按触发条件分桶，
 * 运行时由客户端取用 → 跑动中零延迟、零网络依赖。
 */
import { formatPace } from '../domain/utils/pace.js'

export const CUE_TRIGGERS = {
  start: { key: 'start', label: '开跑', icon: 'play_arrow' },
  km: { key: 'km', label: '每公里', icon: 'flag' },
  intensity: { key: 'intensity', label: '强度提醒', icon: 'record_voice_over' },
  time: { key: 'time', label: '时间节点', icon: 'timer' },
  finish: { key: 'finish', label: '收尾', icon: 'stop_circle' },
}

/**
 * 生成话术包。
 * @param {object} session 课次
 * @param {object} options { goalPaceSec, targetDistanceKm }
 * @returns {Array<{id:string, trigger:string, text:string, audioUrl?:string}>}
 */
export function buildCuePack(session, options = {}) {
  const level = session?.intensity?.level || 'easy'
  const paceLow = session?.intensity?.paceLow || 420
  const paceHigh = session?.intensity?.paceHigh || 450
  const rpe = session?.intensity?.rpe?.[1] ?? 4
  const distance = session?.distanceKm || 5
  const goal = options.goalPaceSec

  const pack = []

  pack.push({
    id: 'cue_start',
    trigger: 'start',
    text: `训练开始。今天是${session?.title?.split('·')[0]?.trim() || '轻松跑'}，保持呼吸和步频稳定，配速大约 ${formatPace(
      paceLow,
    )} 到 ${formatPace(paceHigh)}。前 3 分钟按轻松跑进入，别急着加速。`,
  })

  const kmCues = [
    (n) => `1 公里完成，用时 ${formatPace(paceLow + 8)}，平均配速 ${formatPace(paceLow + 8)}，比目标区间慢了 8 秒，很好。`,
    (n) => `${n} 公里完成，节奏保持住了。呼吸平稳、动作放松，说明强度控制得不错。`,
    (n) => `${n} 公里完成。检查呼吸和步频是否均匀，不要因为感觉轻松就提速。`,
    (n) => `${n} 公里完成，已经过了最容易放弃的阶段。剩下的按今天的配速走完。`,
  ]
  kmCues.forEach((fn, i) => {
    pack.push({ id: `cue_km_${i + 1}`, trigger: 'km', kmIndex: i + 1, text: fn(i + 1) })
  })

  pack.push({
    id: 'cue_intensity_1',
    trigger: 'intensity',
    text: '现在的强度偏快了，试着放松肩颈并缩短步幅，让呼吸逐渐稳定。',
  })
  pack.push({
    id: 'cue_intensity_2',
    trigger: 'intensity',
    text: '如果呼吸明显急促，把速度降一档，先让心率回到目标区间再继续。',
  })

  pack.push({
    id: 'cue_time_1',
    trigger: 'time',
    text: '已经跑了 15 分钟，配速稳定，继续保持。',
  })
  pack.push({
    id: 'cue_time_2',
    trigger: 'time',
    text: '已经跑了 30 分钟。检查一下肩膀和手指有没有紧，紧张会让配速变僵。',
  })
  pack.push({
    id: 'cue_time_3',
    trigger: 'time',
    text: '已经跑了 45 分钟。最后这段保持同样的呼吸，不要硬撑。',
  })

  pack.push({
    id: 'cue_finish_1',
    trigger: 'finish',
    text: '还有 2 分钟，准备进入拉伸。别加速，按当前配速跑完。',
  })
  pack.push({
    id: 'cue_finish_2',
    trigger: 'finish',
    text: '本次训练完成，接下来是静态拉伸，辛苦你了。',
  })

  if (goal) {
    pack.push({
      id: 'cue_goal',
      trigger: 'start',
      text: `今天的目标配速是 ${formatPace(goal)}/km，记住这个感觉，它就是你冲线时的节奏。`,
    })
  }

  return pack
}
