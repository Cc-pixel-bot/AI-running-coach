import { Router } from 'express'
import { pool } from '../db.js'
import { config } from '../config.js'
import { createToken, hashPassword, publicUser, verifyPassword, verifyToken } from '../security.js'
import { validateCredentials, validateRegistration } from '../validation.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function authResponse(user) {
  return { user: publicUser(user), token: createToken(user, config.authSecret) }
}

router.post('/register', async (req, res, next) => {
  try {
    const error = validateRegistration(req.body || {})
    if (error) return res.status(400).json({ message: error })

    const phone = String(req.body.phone).trim()
    const nickname = String(req.body.nickname || '跑者').trim() || '跑者'
    const [existing] = await pool.execute('SELECT id FROM app_user WHERE phone = ? LIMIT 1', [phone])
    if (existing.length) return res.status(409).json({ message: '该账号已注册，请直接登录' })

    const passwordHash = hashPassword(String(req.body.password))
    const [result] = await pool.execute(
      'INSERT INTO app_user (phone, password_hash, nickname) VALUES (?, ?, ?)',
      [phone, passwordHash, nickname],
    )
    const [rows] = await pool.execute('SELECT id, phone, nickname, status FROM app_user WHERE id = ?', [result.insertId])
    return res.status(201).json(authResponse(rows[0]))
  } catch (error) {
    return next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const error = validateCredentials(req.body || {})
    if (error) return res.status(400).json({ message: error })

    const phone = String(req.body.phone).trim()
    const [rows] = await pool.execute(
      'SELECT id, phone, password_hash, nickname, status FROM app_user WHERE phone = ? LIMIT 1',
      [phone],
    )
    const user = rows[0]
    if (!user || user.status !== 'active' || !verifyPassword(String(req.body.password), user.password_hash)) {
      return res.status(401).json({ message: '账号或密码错误' })
    }
    await pool.execute('UPDATE app_user SET last_login_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [user.id])
    return res.json(authResponse(user))
  } catch (error) {
    return next(error)
  }
})

router.delete('/account', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM app_user WHERE id = ?', [req.auth.sub])
    if (!result.affectedRows) return res.status(404).json({ message: '账号不存在或已注销' })
    return res.json({ deleted: true })
  } catch (error) {
    return next(error)
  }
})

router.get('/me', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    const payload = verifyToken(token, config.authSecret)
    if (!payload) return res.status(401).json({ message: '登录已失效，请重新登录' })
    const [rows] = await pool.execute('SELECT id, phone, nickname, status FROM app_user WHERE id = ? LIMIT 1', [payload.sub])
    if (!rows[0] || rows[0].status !== 'active') return res.status(401).json({ message: '账号不可用，请重新登录' })
    return res.json({ user: publicUser(rows[0]) })
  } catch (error) {
    return next(error)
  }
})

export default router
