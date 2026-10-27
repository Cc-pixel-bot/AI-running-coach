import crypto from 'node:crypto'

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password, storedHash) {
  const [algorithm, salt, expected] = String(storedHash || '').split('$')
  if (algorithm !== 'scrypt' || !salt || !expected) return false
  const actual = crypto.scryptSync(password, salt, 64).toString('hex')
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export function createToken(user, secret) {
  const payload = encode({
    sub: user.id,
    phone: user.phone,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  })
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyToken(token, secret) {
  const [payload, signature] = String(token || '').split('.')
  if (!payload || !signature) return null
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return decoded.exp > Math.floor(Date.now() / 1000) ? decoded : null
  } catch {
    return null
  }
}

export function publicUser(row) {
  return {
    id: Number(row.id),
    phone: row.phone,
    nickname: row.nickname,
    status: row.status,
  }
}
