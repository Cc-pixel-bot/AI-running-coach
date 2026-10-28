import { config } from '../config.js'
import { verifyToken } from '../security.js'

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  const payload = verifyToken(token, config.authSecret)
  if (!payload) return res.status(401).json({ message: '登录已失效，请重新登录' })
  req.auth = payload
  return next()
}
