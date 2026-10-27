# 智程 · AI 跑步教练（Web Demo）

> 给业余公路跑者的 AI 私人跑步教练：一份只为你生成的专业跑步训练计划。
> 本目录是 **Demo 阶段** 的网站版实现，依据 `001.产品PRD（产品经理）/AI跑步教练-Demo-PRD-v1.2.md`，
> 视觉与交互基于 `002.产品UI原型/1比1原型图/` 的 Stitch 原型稿重构。

---

## 1. 快速开始

```bash
cd 003.前端代码/frontend
npm install
npm run dev              # 开发模式 → http://localhost:5173
npm run build            # 生产构建 → dist/
npm run preview          # 预览构建产物
npm test                 # 引擎与闭环测试（36 个用例）
npm run sync:prototypes  # 构建并同步 002 原型目录（见 §9）
```

**演示账号**：`123` / `123456`。登录和注册由 `../backend` 提供 API，启动前端前请先启动后端并执行一次 `node src/seed.js`。
也可以在「我的 → 演示设置 → 演示档案」切换到「基础 · 10km 保守」「有伤病 · 10km 保守」两个预置档案。

## 2. Demo 脚本（对应 PRD §9.2，8 分钟版）

| 时间 | 动作 | 讲解要点 |
| --- | --- | --- |
| 0:00–0:30 | 登录 → AI 建档 | 强调 **ACSM 训练前风险筛查**（不可跳过） |
| 1:30–2:30 | 计划总览 | 周期对齐官方（10km = 8 周）、强度分布、**适配依据全部引用档案数值** |
| 2:30–3:00 | 课次详情 → 训练准备 → GPS 执行 | 语音陪跑 + 实时轨迹 + 配速区间条（**演示倍速 30×** 可 1 分钟跑完全程） |
| 3:00–4:00 | 填写反馈 | 用「演示场景一键填充 → 疼痛 5 分（小腿）」构造场景 |
| 4:00–5:30 | AI 总结 + **变更 diff** | 高光时刻：质量课被替换、力量课追加离心提踵、原因逐条可解释 |
| 5:30–6:30 | 计划总览（对比变化） | 采纳后计划真的变了；也可选择「保持原计划」（同样留痕） |
| 6:30–7:30 | 记录 / 数据趋势 | 周跑量、配速、完成率、强度区间分布 |

## 3. 目录结构

```
frontend/
├── index.html                     # 入口（含 Material Symbols / 字体 CDN）
├── vite.config.js                 # Vite + @ 别名
├── vitest.config.js               # 测试配置
├── tailwind.config.js             # ★ Design Token 唯一来源（配色/字体/圆角/动效）
├── tests/                         # 引擎与闭环测试
│   ├── setup.js                   # localStorage polyfill
│   ├── pace.test.js               # 配速格式化与偏移缩放
│   ├── planEngine.test.js         # 训练量规则、安全闸门、适配依据
│   ├── adjustEngine.test.js       # 规则引擎 P0–P11
│   └── flow.test.js               # 主链路闭环集成测试
├── main.js                        # 应用装配 + 档案持久化订阅
├── App.vue                        # 布局壳：页面切换 / 底部导航 / Toast / 弹窗
├── router/index.js                # 13 条路由 + 登录守卫（hash 模式，静态托管可直接跑）
    │
├── domain/                        # ★ 纯逻辑层：无 Vue 依赖，可独立回归测试
    │   ├── constants/
    │   │   ├── intensity.js       # 7 档强度 + 三锚点 + 配速偏移缩放
    │   │   ├── screening.js       # ACSM 预参与筛查（PAR-Q+ 简化版）
    │   │   └── grades.js          # 田协等级线（精英级）
    │   ├── engine/
    │   │   ├── planEngine.js      # 计划生成（PRD §B2 八步）
    │   │   ├── reachability.js    # 可达性校验（PRD §1.3.3 五项）
    │   │   ├── adjustEngine.js    # 规则引擎（PRD §E2 P0–P11）
    │   │   └── summaryBuilder.js  # 四段式总结（PRD §E1）
    │   ├── templates/trainingTemplates.js # 6 个模板的「周蓝图」（周期长度对齐官方计划）
    │   └── utils/                 # 配速/时长格式化、数值工具
    │
├── services/                      # 可替换为真实 API 的服务层
│   ├── authApi.js                 # 登录/注册/当前用户 API
    │   ├── gpsSimulator.js        # GPS 记录模拟（1Hz、漂移过滤、自动暂停、滑动窗口配速）
    │   ├── voiceCoach.js          # 语音陪跑话术包（PRD §C3 五类触发）
    │   └── storage.js             # localStorage 持久化（模拟后端）
    │
├── stores/                        # Pinia 状态
    │   ├── auth.js                # 登录态 + 演示模式 + 预置档案切换
    │   ├── profile.js             # 建档草稿、BMI、可达性派生值
    │   ├── plan.js                # 计划生成/确认/按周解锁/调整采纳
    │   ├── run.js                 # 训练执行、反馈提交、闭环编排
    │   ├── history.js             # 历史记录与趋势（PRD §E4）
    │   └── ui.js                  # Toast / 弹窗
    │
├── data/
    │   ├── demoSeed.js            # 演示账号、3 个预置档案、3 周历史记录
    │   └── exercises.js           # 热身/拉伸/力量动作库（PRD §B5.1 / §B5.2 / §5.2）
    │
├── components/
    │   ├── layout/                # AppHeader、AppTabBar
    │   ├── ui/                    # AppButton、StatusTag、StatTile、AppModal、ToastHost、Icon
    │   ├── coach/                 # CoachBanner
    │   ├── plan/                  # WeekCalendar、SessionCard、ZoneBar、AdjustmentDiff
    │   └── run/                   # TrackMap
    │
├── pages/
    │   ├── auth/                  # 登录与身份入口
    │   │   └── LoginView.vue
    │   ├── profile/               # ProfileChatView（AI 建档）、ProfileConfirmView、MyProfileView
    │   ├── plan/                  # PlanOverviewView、SessionDetailView、PlanAdjustView
    │   ├── run/                   # RunExecuteView
    │   ├── summary/               # FeedbackView、SessionSummaryView
    │   └── history/               # HistoryView、TrendsView
    │
├── assets/                        # 页面图片与品牌素材
└── styles/tokens.css              # 全局样式入口：Tailwind 三件套 + CSS 变量 + 组件类
```

**分层约定**：`pages / components`（表现层）→ `stores`（状态与编排）→ `services`（可替换的外部能力）→ `domain`（纯函数领域逻辑）。
`domain` 不依赖 Vue 与浏览器 API，因此所有训练规则都可以直接用 `npm test` 回归。

## 4. 页面与路由

桌面导出包只保留 7 个核心页面：登录、AI 建档、档案确认、计划总览、今日训练、GPS 训练执行、我的。
源码中另外保留课次详情、训练反馈、训练总结、计划调整、训练记录、数据趋势等闭环辅助路由。

| 路由 | 页面 | PRD 对应 |
| --- | --- | --- |
| `/login` | 登录页 | §3.3.3 页面 1、G1 |
| `/profile` | AI 建档页（5 段 · 含 ACSM 筛查） | A1、H1 |
| `/profile/confirm` | 档案确认卡 | A2 |
| `/plan` | 训练计划总览 | B3、B4 |
| `/plan/session/:id` | 课次详情（热身/主体/拉伸） | B5、B5.1、B5.2 |
| `/plan/adjust` | 计划调整与变更留痕 | E3 |
| `/run/prep` | 训练准备（定位/信号/电量/天气占位） | C1 |
| `/run/live` | GPS 训练执行 + 语音陪跑 | C2、C3 |
| `/feedback` | 训练反馈表单（7 项） | D1、D2 |
| `/summary` | 训练总结（四段式 + 变更 diff） | E1、E2、E3 |
| `/history` | 训练历史 | E4 |
| `/trends` | 数据趋势 | E4 |
| `/me` | 我的（演示设置 / 隐私 / 退出） | G3 |

底部导航固定为「训练 / 计划 / 我的」。

更详细的目录职责与依赖方向见 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)。

## 5. 核心主张如何在代码里落地

### ① 档案驱动（不是标签匹配模板）

`planEngine.generatePlan()` 按 PRD §B2 的八步执行：
安全闸门 → 选模板 → 算目标配速 P → 可达性校验 → 起始跑量 → 排课 → 逐周推进 → 伤病适配 → 冲突检测。
计划结构由「模板的周蓝图 + 跑者档案」共同决定，`adaptationSummary` 中的每个数字都来自引擎计算结果。

### ② 计划可执行（带强度区间的每日课次）

7 档强度（恢复/轻松/有氧/长距离/节奏/间歇/比赛配速）采用**三锚点**：主观用力（主）+ 配速偏移（副）+ 心率区间（第三轨）。
每节课都带热身动作、主体结构、拉伸动作与「适配说明」。

### ③ 闭环可迭代（计划真的变了）

```
训练记录 → 反馈表单 → 规则引擎（adjustEngine）→ AdjustmentSet → 变更 diff → 用户采纳 → 写回计划
```

- 调整在**规则层**完成（可回归测试），文案层只负责把 `reason_code` 翻译成人话；
- 用户点「采纳调整」时，`pendingPlan` 会被**写回** `planStore.plan`（`decideAdjustments('accepted')`），
  计划总览与课次详情随即展示变化后的内容；
- 点「保持原计划」也会写入 `adjustment_log`（标注 `user_rejected`），供后续规则参考。

### 训练安全（本产品与通用健身 App 的本质差异）

- 建档中的运动风险筛查段强制 **ACSM 预参与筛查**（PAR-Q+ 简化版，3 问 30 秒）；
- Q2 命中任一症状 / Q3=是 → **不生成训练计划**，给出就医话术与保守替代方案；
- Q1=否 → 中风险，前 2 周只出轻松跑与长距离，质量课从第 3 周起解锁；
- 反馈中疼痛 ≥7 或出现胸闷/头晕 → **P0 安全中止**，下一课次替换为休息 + 拉伸，且**不提供拒绝按钮**；
- 课次详情页「安全第一防线」直接列出 PRD §5.5.2 的 5 条**训练中止标准**（胸痛/异常气促/头晕/心悸/突发剧痛），跑前即可看到；
- 「我的 → 演示设置」提供**清除全部本地数据**入口（PRD §G3：定位数据可清除）；
- 计划总览、训练总结固定位置展示免责声明（PRD §5.5.3）。

### 训练量与安全约束（PRD §5.1）

| 规则 | 实现位置 |
| --- | --- |
| 周跑量趋势线 ≤ +10%/周 | `computeWeeklyVolumes()` |
| 每 3–4 周回撤周（−18%，强度不减） | 同上（模板蓝图标记 `stepBack`） |
| 同周不同时推进强度与总量（WA 原则） | 同上（质量课变化的那周增幅折半） |
| 赛前减量：总量指数下降 41–60%，强度不减 | 同上（`taperFactors`） |
| 单次长距离 ≤ 近 30 天最长 × 1.1 | `planEngine` + `adjustEngine` P6 |
| 单次时长 ≤ 档案可用时长 | `planEngine`（R5） |
| 每周 ≥1 次髋/核心力量课 | `buildWeekSchedule()`（R8） |
| 连续 2 次同部位疼痛 ≥4 → 该部位强度永久降级 | `adjustEngine`（安全底线 1，规则以 `PAIN_REPLACE` + `adaptationNote` 落实） |

## 6. 与 PRD 的差异说明（均为显式决策，非疏漏）

| # | 差异点 | PRD 原文 | 本实现 | 理由 |
| --- | --- | --- | --- | --- |
| 1 | 配速偏移按目标距离缩放 | §B1 偏移表为马拉松口径（轻松跑 = P + 75~105 秒/km） | 按距离等比缩放：5K ×0.55 / 10K ×0.70 / 半马 ×0.85 / 全马 ×1.00 | 该表源自 B.A.A. 马拉松配速图；直接套到 10km 会让「轻松跑」比跑者自然舒适配速还慢 40 秒/公里以上（10km 目标 5'51" 会算出 7'06"–7'36"，而该跑者舒适配速 6'45"），与「轻松跑 = 有氧基础」的产品意图矛盾。缩放系数在计划总览「强度档速查」中随计划展示，便于复核。 |
| 2 | P1 疼痛部位列表 | §E2 P1 写「膝/踝/足」 | 扩展为膝/踝/足/小腿/髂胫束，并按部位给不同补充动作 | §5.4 伤病适配表覆盖小腿（暂停间歇与冲刺 1 周 + 离心提踵）与髂胫束；§E2 的表述是简写。 |
| 3 | 起始周跑量 | §B2 输出示例写「15km → 18km（+20%）」；§B2 步骤 4 写「×0.9」 | 采用 ×0.9（有伤病 ×0.85，天数 <3 再 ×0.9） | 步骤 4 是硬规则，示例是示意；实现以规则为准，适配依据文案如实写出百分比。 |
| 4 | 模板实现方式 | §B1 给出完整模板结构；§10 风险预案写「模板按周参数化生成」 | 模板只声明**周蓝图**（阶段、质量课类型、回撤/减量标记），跑量与课次由引擎按档案计算 | 避免手写 8×4 条课次，同时保证不同档案得到不同计划。 |
| 5 | GPS 数据来源 | §C2 要求真 GPS | 确定性模拟（合成轨迹 + 1Hz 采样 + 漂移过滤 + 自动暂停 + 滑动窗口配速） | Demo 阶段室内可复现；模拟器已按 §C2 的阈值实现，替换为 `navigator.geolocation` 只需改 `services/gpsSimulator.js`。 |
| 6 | 演示倍速 | §10 预案「课次可配置为 15 分钟版用于演示」 | 训练准备页提供 1× / 10× / 30× / 60× 倍速 | 等价且更通用：现场 1 分钟即可跑完全部课次。 |

## 7. 视觉规范

- **Design Token 唯一来源**：`tailwind.config.js`（配色 / 字体 / 字号 / 圆角 / 间距 / 动效）+ `styles/tokens.css`（CSS 变量与组件类）。
- 配色对齐 PRD §3.3.2：品牌橙 `#FF7A00`（主按钮、进度、训练进行中）、活力橙 `#FF9F43`、品牌红 `#E53935`（风险/疼痛/停止）、深红 `#B71C1C`、浅橙背景 `#FFF3E8`、浅红背景 `#FFEBEE`、主文字 `#1F2937`、次文字 `#6B7280`、页面背景 `#F8F9FB`。
- 状态**不只用颜色**表达：状态标签同时带图标与文字（PRD §3.3.4）。
- 字体：Space Grotesk（数字与标题）+ Hanken Grotesk（正文），与原型稿一致。
- 响应式：375 / 390 / 414px 移动端优先，桌面端 480px 居中展示（PRD §3.3.5）。
- 无障碍：可点击区域 ≥ 44px，表单错误就近提示，危险操作二次确认。

## 8. 已知限制（Demo 边界）

- 后端为浏览器内模拟（localStorage），刷新页面数据仍在，清空后重新登录即可复位；
- 语音播报以文字流形式呈现，未接 TTS；
- 动作教学视频使用官方公开内容占位，未做播放与倍速控制；
- 半马 / 全马目标可生成完整周期计划，但课次内容与 10km 同构（Demo 只做 10km 完整闭环）；
- 未接手表数据、天气 API、地图 SDK。

## 9. 原型同步（002 目录）

`002.产品UI原型/1比1原型图/` 不是独立设计的静态稿，而是**实现的静态快照**：
每个入口页 = `dist/index.html` + 一个预设的 hash 路由跳转，共用同一份构建产物，
因此原型与实现始终视觉一致，不存在「原型改了代码没改」的漂移。

维护的 7 个页面：

| 文件 | 路由 |
| --- | --- |
| `01-登录页.html` | `#/login` |
| `02-AI建档页.html` | `#/profile` |
| `03-档案确认页.html` | `#/profile/confirm` |
| `04-计划总览页.html` | `#/plan` |
| `05-今日训练页.html` | `#/run/prep` |
| `06-GPS训练执行页.html` | `#/run/live` |
| `07-我的页.html` | `#/me` |

改动前端后执行 `npm run sync:prototypes` 即可一键重新生成（内部会先跑一次构建）。
其余实现页面（训练反馈、训练总结、计划调整、训练记录、数据趋势）不在原型目录单独出图，
可在应用内通过导航到达。

> **查看方式**：原型页同样是 `<script type="module">`，浏览器直接双击打开会被 CORS 拦截，
> 需用静态服务器访问，例如在仓库根目录执行
> `npx serve "002.产品UI原型/1比1原型图"`。
