# 智程 · AI 跑步教练数据库脚本

## 文件说明

- `001_schema.sql`：MySQL 8.0+ 主表、约束和索引脚本，适配当前 Docker 中的 `mysql:9.7.4`。

## 设计依据

数据库设计基于：

- `001.产品PRD（产品经理）/AI跑步教练-当前版本PRD.md` 第 6 章“数据与接口”
- `003.前端代码/frontend` 当前的 Pinia 状态、GPS 服务、反馈与 AI 调整流程

## 核心关系

```text
app_user
  └── runner_profile
  ├── profile_qa_log
  ├── training_plan
  │     ├── plan_week
  │     │     └── plan_session
  │     ├── plan_unlock_state
  │     ├── weekly_summary
  │     └── adjustment_log
  ├── session_record
  │     ├── gps_track ── gps_point
  │     ├── training_feedback
  │     └── ai_summary
  └── ai_chat_log
```

## 关键设计说明

1. `runner_profile` 保存建档页采集的身体、跑步基础、目标、训练条件和风险筛查结果。
2. `training_plan` 保存一次完整计划；`plan_week` 和 `plan_session` 分别对应计划周与每日课次，支持 8 周计划及后续扩展。
3. `session_record` 保存 GPS 训练的客观结果；`training_feedback` 保存完成度、RPE、身体感受、疼痛和文字反馈。
4. `session_record.prep_checklist` 保存练前动态激活、练后静态拉伸的完成状态，支持反馈提交后继续修改。
5. `ai_summary` 保存结构化事实快照和面向用户的训练总结；`adjustment_log` 保存调整前后状态、原因码和用户是否采纳，保证计划调整可追溯。
6. `weekly_summary` 为训练量、近 30 天最长距离、完成率和疼痛信号提供聚合结果，服务于计划调整规则。
7. `gps_track` / `gps_point` 单独拆表，便于后续做轨迹清除、分级授权和数据保留策略。

## MySQL 执行方式

在 Navicat Premium 中新建 MySQL 连接：

```text
主机：127.0.0.1
端口：3306
```

打开并执行 `001_schema.sql`，脚本会自动创建并切换到 `ai_running_coach` 数据库。

也可以使用命令行：

```bash
mysql -h 127.0.0.1 -P 3306 -u <用户名> -p < "004 数据库脚本/001_schema.sql"
```

如果通过 Docker 执行，建议使用文件复制方式，避免 Windows PowerShell 管道改变中文编码：

```bash
docker cp "004 数据库脚本/001_schema.sql" mysql9:/tmp/001_schema.sql
docker exec mysql9 sh -c "mysql -uroot -p\"$MYSQL_ROOT_PASSWORD\" --default-character-set=utf8mb4 < /tmp/001_schema.sql"
docker exec mysql9 rm -f /tmp/001_schema.sql
```

脚本只负责结构初始化，不包含账号、密码或生产数据。生产环境应通过迁移工具执行，并为健康数据和定位数据配置访问控制、审计及删除策略。
