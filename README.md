# 智程 · AI 跑步教练

面向普通跑者的 AI 训练计划与 GPS 训练闭环项目。

## 目录

```text
001.产品PRD（产品经理）/   产品需求、AI 调整机制与评审文档
002.产品UI原型/            与前端同步的 10 个页面静态原型
003.前端代码/
  ├─ frontend/             Vue 3 + Vite 前端页面、组件、状态和服务层
  │  ├─ pages/             按业务页面组织
  │  ├─ components/        按页面领域组织的可复用组件
  │  ├─ stores/             Pinia 状态与流程编排
  │  ├─ services/           API、GPS 与训练过程服务
  │  ├─ domain/             训练模板、强度、动作和安全校验
  │  ├─ tests/              前端流程与工具测试
  │  └─ docs/               前端架构和 GPS 测试样本
  └─ backend/               Express + MySQL API、AI 生成与校验
     └─ src/
        ├─ routes/           认证、档案、计划、训练与 AI 接口
        ├─ services/ai/      AI 提示词、模型调用和输出校验
        └─ domain/           后端动作库与训练模板
004 数据库脚本/             MySQL 表结构初始化脚本
```

## 启动顺序

```powershell
cd "D:\claude-ai跑步教练\003.前端代码\backend"
npm install
npm run dev

cd "D:\claude-ai跑步教练\003.前端代码\frontend"
npm install
npm run dev
```

前端默认访问 `http://localhost:5173`，后端默认访问 `http://localhost:3001`。通过 Live Server 验证时使用前端构建产物，并确保后端端口 3001 已启动。

## 数据与 AI

档案、训练计划、GPS 训练记录、训练反馈和 AI 调整结果均由后端 API 写入 MySQL。前端 localStorage 仅保存登录态和页面缓存，不作为业务数据源。AI 从动作库选择动作 ID，后端完成结构、安全和数据一致性校验后保存。

## 验证

```powershell
cd "D:\claude-ai跑步教练\003.前端代码\frontend"
npm test
npm run build
npm run sync:prototypes
```
