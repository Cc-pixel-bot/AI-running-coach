import { pool } from './db.js'
import { hashPassword } from './security.js'

const [rows] = await pool.execute('SELECT id FROM app_user WHERE phone = ? LIMIT 1', ['123'])
if (!rows.length) {
  await pool.execute(
    'INSERT INTO app_user (phone, password_hash, nickname) VALUES (?, ?, ?)',
    ['123', hashPassword('123456'), '跑者 #8042'],
  )
  console.log('已创建演示账号：123 / 123456')
} else {
  console.log('演示账号已存在')
}
await pool.end()
