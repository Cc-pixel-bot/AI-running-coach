import { config } from '../../config.js'

function parseJson(text) {
  const normalized = String(text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  return JSON.parse(normalized)
}

async function callCompatibleModel({ system, user }) {
  if (!config.ai.baseUrl || !config.ai.apiKey || !config.ai.model) {
    const error = new Error('AI 服务尚未配置')
    error.code = 'AI_NOT_CONFIGURED'
    throw error
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs)
  const enableThinking = config.ai.reasoningEffort !== 'none'
  try {
    const response = await fetch(`${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        temperature: 0.2,
        enable_thinking: enableThinking,
        ...(enableThinking ? { reasoning_effort: config.ai.reasoningEffort } : {}),
        max_tokens: 12000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[AI] provider request failed', {
        baseUrl: config.ai.baseUrl,
        model: config.ai.model,
        status: response.status,
        detail: detail.slice(0, 500),
      })
      const error = new Error(`AI 服务返回 ${response.status}`)
      error.code = 'AI_PROVIDER_HTTP'
      error.status = response.status
      error.detail = detail.slice(0, 500)
      throw error
    }
    const payload = await response.json()
    try {
      return parseJson(payload.choices?.[0]?.message?.content)
    } catch {
      const error = new Error('AI 返回内容不是有效 JSON')
      error.code = 'AI_OUTPUT_PARSE'
      throw error
    }
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 20) {
      const timeoutError = new Error('AI 计划生成超时')
      timeoutError.code = 'AI_TIMEOUT'
      throw timeoutError
    }
    if (error.code) throw error
    console.error('[AI] provider unavailable', {
      baseUrl: config.ai.baseUrl,
      model: config.ai.model,
      message: error.message,
    })
    const unavailableError = new Error('无法连接 AI 服务')
    unavailableError.code = 'AI_PROVIDER_UNAVAILABLE'
    unavailableError.cause = error
    throw unavailableError
  } finally {
    clearTimeout(timer)
  }
}

export async function generateWithProvider({ system, user, fallback }) {
  if (config.ai.provider === 'mock') return fallback()
  return callCompatibleModel({ system, user })
}
