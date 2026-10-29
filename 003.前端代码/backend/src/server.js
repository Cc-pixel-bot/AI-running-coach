import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { checkDatabase, ensureRuntimeTables } from './db.js'
import authRoutes from './routes/auth.js'
import profileRoutes from './routes/profile.js'
import planRoutes from './routes/plans.js'
import aiPlanRoutes from './routes/aiPlans.js'
import runRoutes from './routes/runs.js'
import aiAdjustmentRoutes from './routes/aiAdjustments.js'

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
app.use('/api/profile', profileRoutes)
app.use('/api/plans', planRoutes)
app.use('/api/ai/plans', aiPlanRoutes)
app.use('/api/runs', runRoutes)
app.use('/api/ai/plans', aiAdjustmentRoutes)

app.use((error, _req, res, _next) => {
  console.error('[api]', error)
  res.status(500).json({ message: '服务器暂时不可用，请稍后重试' })
})

ensureRuntimeTables()
  .then(() => app.listen(config.port, () => {
    console.log(`智程 API running at http://localhost:${config.port}`)
  }))
  .catch((error) => {
    console.error('[startup] database initialization failed', error)
    process.exitCode = 1
  })
