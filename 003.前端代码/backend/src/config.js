import 'dotenv/config'

export const config = {
  port: Number(process.env.PORT || 3001),
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'ai_running_coach',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
  },
  authSecret: process.env.AUTH_SECRET || 'local-demo-secret-change-me',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  ai: {
    provider: process.env.AI_PROVIDER || 'mock',
    baseUrl: process.env.AI_BASE_URL || '',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || '',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 300000),
    reasoningEffort: process.env.AI_REASONING_EFFORT || 'none',
  },
}
