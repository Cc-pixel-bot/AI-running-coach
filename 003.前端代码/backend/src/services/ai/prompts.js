import { getActionCatalog } from '../../domain/exercises.js'

function compact(value) {
  return JSON.stringify(value, null, 2)
}

export function buildPlanPrompts({ profile, template }) {
  const system = `你是智程，负责为普通业余跑者制定 10 公里训练计划。
根据跑者档案和训练模板生成完整、可执行、个性化的 8 周计划，只用中文返回。
目标固定为 10K；训练类型只能用 easy、recovery、long、tempo、interval、race、strength。
遵守：循序渐进；每 3 到 4 周回撤；最后一周减量；单次时长不超过用户上限；长跑不超过近期最长跑安全范围；有风险时降低强度。
只返回一个 JSON 对象，不要 Markdown、解释或额外字段；描述简洁，避免重复。`

  const user = `生成训练计划。

动作库（只能选择其中的动作 ID；动作名称、剂量和执行要点由系统根据动作库自动补全）：
${compact(getActionCatalog())}

跑者档案：
${compact(profile)}

匹配模板：
${compact(template)}

返回结构（只输出以下必要字段，禁止额外字段，减少响应体）：
{
  "templateId": "模板编号",
  "targetDistance": "10K",
  "goalPace": "目标配速",
  "goalTotalSec": 0,
  "currentWeek": 1,
  "totalWeeks": 8,
  "weeks": [
    {
      "week": 1,
      "phase": "阶段名称",
      "focus": "本周重点",
      "totalKm": 0,
      "sessions": [
        {
          "id": "w1s1",
          "week": 1,
          "dayOffset": 0,
          "dayLabel": "第1天",
          "type": "easy",
          "title": "轻松跑",
          "distanceKm": 0,
          "durationMin": 0,
          "description": "一句话训练目的",
          "structure": "主体训练结构",
          "preRunWarmup": {
            "title": "练前动态激活",
            "duration": 5,
            "exercises": ["动作库中的 wu_… ID"]
          },
          "mainRun": { "type": "easy", "distanceKm": 0, "durationMin": 0, "pace": "配速范围", "structure": "主体训练结构" },
          "postRunStretch": {
            "title": "练后静态拉伸",
            "duration": 5,
            "exercises": ["动作库中的 cd_… ID"]
          },
          "adaptationNote": "一句话安排原因"
        }
      ]
    }
  ],
  "totalKm": 0,
  "adaptationSummary": "个性化调整说明"
}

每周包含与模板匹配的训练课次；所有数字使用数字类型；每条说明控制在一句话内。mainRun 的 type 必须等于课次 type，distanceKm 和 durationMin 必须复制课次同名字段，不要把热身或拉伸时长加到 durationMin。练前动作必须选择热身动作库中的 wu_ 编号，练后动作必须选择拉伸动作库中的 cd_ 编号。每节跑步课至少选择 1 个热身动作和 1 个拉伸动作；只输出动作编号数组，不要生成动作名称、剂量或执行要点，这些内容由系统统一补齐。` 
  return { system, user }
}
