import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { checkDatabase } from './db.js'
import authRoutes from './routes/auth.js'

const app = express()

const allowedOrigins = new Set([
  config.frontendOrigin,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
])

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true)
    return callback(new Error('不允许的前端来源'))
  },
  credentials: false,
}))
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', async (_req, res) => {
  try {
    await checkDatabase()
    res.json({ ok: true, database: 'connected' })
  } catch {
    res.status(503).json({ ok: false, database: 'unavailable' })
  }
})

app.use('/api/auth', authRoutes)

app.use((error, _req, res, _next) => {
  console.error('[api]', error)
  res.status(500).json({ message: '服务器暂时不可用，请稍后重试' })
})

app.listen(config.port, () => {
  console.log(`智程 API running at http://localhost:${config.port}`)
})
