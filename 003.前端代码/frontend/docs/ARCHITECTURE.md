# 项目结构与开发约定

## 目录职责

```text
frontend/
├─ assets/          页面图片与品牌素材
├─ pages/           路由页面，按产品模块分组
├─ components/      可复用 UI 与业务组件
│  │  ├─ layout/    顶部栏、底部导航等页面壳
│  │  ├─ ui/        按钮、弹窗、标签、进度条等基础组件
│  │  ├─ coach/     智程教练相关组件
│  │  ├─ plan/      计划与课次组件
│  │  └─ run/       训练执行组件
├─ data/            产品静态数据与动作库
├─ domain/          不依赖 Vue 的训练领域逻辑
│  │  ├─ constants/ 训练强度、筛查、等级常量
│  │  ├─ engine/    总结与可达性校验
│  │  ├─ templates/ 周期训练模板
│  │  └─ utils/     配速、时长、数值工具
├─ router/          路由与登录守卫
├─ services/        存储、GPS 模拟、语音等可替换服务
├─ stores/          Pinia 状态与业务编排
├─ styles/          Design Token 与全局样式
├─ App.vue          应用布局壳
├─ main.js          应用入口
├─ tests/           领域规则与主流程测试
├─ dist/            Vite 构建产物，不作为源码编辑目录
└─ 配置文件        Vite、Tailwind、Vitest、PostCSS
```

## 页面分组

当前对外展示的 7 个页面为：登录、AI 建档、档案确认、计划总览、今日训练、GPS 训练执行、我的。

训练反馈、训练总结、课次详情、计划调整等页面属于训练闭环的内部辅助路由，保留在源码中用于交互流程和测试，不放入桌面 7 页导出包。

## 依赖方向

```text
views / components
        ↓
      stores
        ↓
    services / domain
```

- `domain` 只放纯规则和格式化函数，不引用 Vue、Pinia 或浏览器 UI。
- `stores` 负责状态、服务端数据缓存和跨页面业务编排；服务端是计划、档案、训练记录与反馈的唯一业务数据源。
- `services` 封装可以替换为真实后端或设备 API 的能力。
- `components` 负责复用 UI，页面专属组合放在 `pages`。
- 新增页面时，按业务模块放入对应 `pages/<module>/`，并在 `router/index.js` 注册。
- 新增可复用控件时，优先放入 `components/ui/`，不要在多个页面复制模板。

## 常用命令

```bash
npm run dev
npm run build
npm test
```
