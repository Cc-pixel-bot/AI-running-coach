# 智程后端 API

登录与注册服务，使用 Node.js、Express 和 MySQL。账号对应数据库 `app_user.phone`，密码使用 Node.js `scrypt` 加盐哈希保存。

## 启动

```powershell
cd 003.前端代码/backend
Copy-Item .env.example .env
# 在 .env 中填写 Docker MySQL 密码
npm install
node src/seed.js       # 首次启动时创建演示账号 123 / 123456
npm run dev             # http://localhost:3001
```

前端开发服务 `http://localhost:5173` 已配置 `/api` 代理到 `http://localhost:3001`。如果前端不是通过 Vite 开发服务访问，可设置 `VITE_API_BASE_URL=http://localhost:3001/api`。

## 接口

- `GET /api/health`：检查 API 与 MySQL
- `POST /api/auth/register`：注册，参数 `{ phone, password, nickname? }`
- `POST /api/auth/login`：登录，参数 `{ phone, password }`
- `GET /api/auth/me`：使用 `Authorization: Bearer <token>` 获取当前账号

当前实现只负责账号认证。跑者档案、训练计划和 AI 闭环仍由前端演示状态驱动，后续可以按数据库表逐步迁移到 API。
