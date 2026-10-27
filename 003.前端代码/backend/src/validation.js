export function validateCredentials({ phone, password }) {
  const account = String(phone ?? '').trim()
  const secret = String(password ?? '')
  if (!/^\d{3,20}$/.test(account)) return '请输入正确的账号'
  if (secret.length < 6 || secret.length > 64) return '请输入6-64位密码'
  return null
}

export function validateRegistration(body) {
  const error = validateCredentials(body)
  if (error) return error
  const nickname = String(body.nickname ?? '').trim()
  if (nickname.length > 50) return '请输入不超过50个字的昵称'
  return null
}
