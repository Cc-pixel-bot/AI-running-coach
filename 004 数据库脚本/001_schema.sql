-- 智程 · AI 跑步教练 MySQL 数据库主表脚本
-- 适配：MySQL 8.0+ / 当前 Docker mysql:9.7.4
-- 覆盖：登录 → 建档 → 计划确认 → GPS 训练 → 反馈 → AI 总结/调整

CREATE DATABASE IF NOT EXISTS ai_running_coach
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE ai_running_coach;

CREATE TABLE IF NOT EXISTS app_user (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  nickname VARCHAR(50) NOT NULL DEFAULT '跑者',
  status ENUM('active', 'disabled', 'deleted') NOT NULL DEFAULT 'active',
  last_login_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_app_user_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户账号与登录信息';

CREATE TABLE IF NOT EXISTS user_consent (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  consent_type ENUM('service', 'privacy', 'location', 'health_data') NOT NULL,
  version VARCHAR(30) NOT NULL,
  granted TINYINT(1) NOT NULL,
  granted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_consent_version (user_id, consent_type, version),
  CONSTRAINT fk_consent_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS runner_profile (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  gender ENUM('male', 'female', 'other') NULL,
  birth_year SMALLINT UNSIGNED NULL,
  height_cm DECIMAL(5,1) NULL,
  weight_kg DECIMAL(5,1) NULL,
  running_years_bucket VARCHAR(20) NULL,
  runs_per_week TINYINT UNSIGNED NULL,
  weekly_km DECIMAL(5,1) NULL,
  longest_run_km DECIMAL(5,1) NULL,
  best_5k_pace_sec INT UNSIGNED NULL,
  best_10k_pace_sec INT UNSIGNED NULL,
  best_hm_pace_sec INT UNSIGNED NULL,
  best_marathon_pace_sec INT UNSIGNED NULL,
  easy_pace_sec INT UNSIGNED NULL,
  target_distance ENUM('5K', '10K', 'HM', 'MARATHON') NULL,
  target_type ENUM('improve_5k', 'improve_10k', 'hm_finish', 'mar_finish', 'experience') NULL,
  target_time_sec INT UNSIGNED NULL,
  target_date DATE NULL,
  target_pace_sec INT UNSIGNED NULL,
  has_race TINYINT(1) NULL,
  race_history JSON NOT NULL,
  injury_flags JSON NOT NULL,
  screening_result JSON NOT NULL,
  available_days TINYINT UNSIGNED NULL,
  available_min SMALLINT UNSIGNED NULL,
  terrain JSON NOT NULL,
  equipment JSON NOT NULL,
  ai_inferred_fields JSON NOT NULL,
  confirmed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_runner_profile_user (user_id),
  CONSTRAINT fk_runner_profile_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
  CONSTRAINT chk_birth_year CHECK (birth_year IS NULL OR birth_year BETWEEN 1970 AND 2010),
  CONSTRAINT chk_height_cm CHECK (height_cm IS NULL OR height_cm BETWEEN 120 AND 230),
  CONSTRAINT chk_weight_kg CHECK (weight_kg IS NULL OR weight_kg BETWEEN 40 AND 100),
  CONSTRAINT chk_runs_per_week CHECK (runs_per_week IS NULL OR runs_per_week BETWEEN 1 AND 7),
  CONSTRAINT chk_longest_run_km CHECK (longest_run_km IS NULL OR longest_run_km BETWEEN 0 AND 30),
  CONSTRAINT chk_available_days CHECK (available_days IS NULL OR available_days BETWEEN 1 AND 7),
  CONSTRAINT chk_available_min CHECK (available_min IS NULL OR available_min BETWEEN 15 AND 300)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='跑者档案、训练目标和风险筛查';

CREATE TABLE IF NOT EXISTS profile_qa_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  turn_no INT UNSIGNED NOT NULL,
  ai_question TEXT NOT NULL,
  ai_options JSON NOT NULL,
  user_answer TEXT NULL,
  field_key VARCHAR(50) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_profile_qa_user_created (user_id, created_at),
  CONSTRAINT fk_profile_qa_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS training_template (
  id VARCHAR(50) NOT NULL,
  name VARCHAR(120) NOT NULL,
  target_distance ENUM('5K', '10K', 'HM', 'MARATHON') NOT NULL,
  duration_weeks SMALLINT UNSIGNED NOT NULL,
  sessions_per_week SMALLINT UNSIGNED NOT NULL,
  version VARCHAR(40) NOT NULL,
  content JSON NOT NULL,
  source_refs JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='官方训练模板及来源追溯';

CREATE TABLE IF NOT EXISTS training_plan (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  template_id VARCHAR(50) NOT NULL,
  goal_pace_sec INT UNSIGNED NULL,
  target_time_sec INT UNSIGNED NULL,
  status ENUM('draft', 'pending_confirm', 'active', 'paused', 'finished', 'cancelled') NOT NULL DEFAULT 'draft',
  start_date DATE NULL,
  current_week SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  total_weeks SMALLINT UNSIGNED NOT NULL,
  weekly_sessions SMALLINT UNSIGNED NULL,
  total_target_km DECIMAL(7,2) NULL,
  adaptation_summary TEXT NULL,
  generated_by ENUM('rule_engine', 'ai', 'manual') NOT NULL DEFAULT 'rule_engine',
  confirmed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_plan_user_status (user_id, status),
  CONSTRAINT fk_plan_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_template FOREIGN KEY (template_id) REFERENCES training_template(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户训练计划';

CREATE TABLE IF NOT EXISTS plan_week (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_id BIGINT UNSIGNED NOT NULL,
  week_no SMALLINT UNSIGNED NOT NULL,
  phase VARCHAR(30) NOT NULL,
  phase_name VARCHAR(50) NOT NULL,
  focus TEXT NULL,
  target_km DECIMAL(6,2) NULL,
  intensity_distribution JSON NOT NULL,
  is_step_back TINYINT(1) NOT NULL DEFAULT 0,
  is_taper TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('locked', 'unlocked', 'in_progress', 'completed') NOT NULL DEFAULT 'locked',
  PRIMARY KEY (id),
  UNIQUE KEY uk_plan_week_no (plan_id, week_no),
  KEY idx_plan_week_status (plan_id, status, week_no),
  CONSTRAINT fk_plan_week_plan FOREIGN KEY (plan_id) REFERENCES training_plan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='训练计划的周阶段';

CREATE TABLE IF NOT EXISTS plan_session (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_id BIGINT UNSIGNED NOT NULL,
  week_id BIGINT UNSIGNED NOT NULL,
  week_no SMALLINT UNSIGNED NOT NULL,
  day_offset SMALLINT UNSIGNED NOT NULL,
  seq SMALLINT UNSIGNED NOT NULL,
  type ENUM('easy', 'long', 'tempo', 'interval', 'race', 'strength', 'rest') NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT NULL,
  structure JSON NOT NULL,
  target_distance_km DECIMAL(6,2) NULL,
  target_duration_min SMALLINT UNSIGNED NULL,
  pace_low_sec INT UNSIGNED NULL,
  pace_high_sec INT UNSIGNED NULL,
  rpe_low TINYINT UNSIGNED NULL,
  rpe_high TINYINT UNSIGNED NULL,
  warmup JSON NOT NULL,
  cooldown JSON NOT NULL,
  exercises JSON NOT NULL,
  adaptation_note TEXT NULL,
  status ENUM('pending', 'done', 'skipped', 'replaced') NOT NULL DEFAULT 'pending',
  PRIMARY KEY (id),
  UNIQUE KEY uk_plan_session_seq (plan_id, week_no, seq),
  KEY idx_session_plan_status (plan_id, status, week_no, seq),
  CONSTRAINT fk_plan_session_plan FOREIGN KEY (plan_id) REFERENCES training_plan(id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_session_week FOREIGN KEY (week_id) REFERENCES plan_week(id) ON DELETE CASCADE,
  CONSTRAINT chk_session_rpe CHECK (rpe_low IS NULL OR (rpe_low BETWEEN 1 AND 10 AND (rpe_high IS NULL OR rpe_high BETWEEN rpe_low AND 10)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='每日训练课次';

CREATE TABLE IF NOT EXISTS plan_unlock_state (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_id BIGINT UNSIGNED NOT NULL,
  week_no SMALLINT UNSIGNED NOT NULL,
  unlocked_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  unlock_condition ENUM('previous_week_complete', 'manual', 'safety_override') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_unlock_week (plan_id, week_no),
  CONSTRAINT fk_unlock_plan FOREIGN KEY (plan_id) REFERENCES training_plan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS session_record (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  session_id BIGINT UNSIGNED NOT NULL,
  started_at DATETIME(3) NULL,
  ended_at DATETIME(3) NULL,
  duration_sec INT UNSIGNED NULL,
  distance_km DECIMAL(7,2) NULL,
  avg_pace_sec INT UNSIGNED NULL,
  best_pace_sec INT UNSIGNED NULL,
  pause_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  zone_seconds JSON NOT NULL,
  prep_checklist JSON NOT NULL,
  status ENUM('running', 'paused', 'completed', 'aborted') NOT NULL DEFAULT 'completed',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_record_user_started (user_id, started_at),
  KEY idx_record_session (session_id),
  CONSTRAINT fk_record_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_record_plan FOREIGN KEY (plan_id) REFERENCES training_plan(id) ON DELETE CASCADE,
  CONSTRAINT fk_record_session FOREIGN KEY (session_id) REFERENCES plan_session(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='GPS训练实际记录';

CREATE TABLE IF NOT EXISTS gps_track (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  record_id BIGINT UNSIGNED NOT NULL,
  started_at DATETIME(3) NULL,
  ended_at DATETIME(3) NULL,
  sample_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_gps_track_record (record_id),
  CONSTRAINT fk_gps_track_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_gps_track_record FOREIGN KEY (record_id) REFERENCES session_record(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='一次训练的GPS轨迹';

CREATE TABLE IF NOT EXISTS gps_point (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  track_id BIGINT UNSIGNED NOT NULL,
  recorded_at DATETIME(3) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  accuracy_m DECIMAL(7,2) NULL,
  speed_mps DECIMAL(7,3) NULL,
  is_valid TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_gps_point_track_time (track_id, recorded_at),
  CONSTRAINT fk_gps_point_track FOREIGN KEY (track_id) REFERENCES gps_track(id) ON DELETE CASCADE,
  CONSTRAINT chk_gps_lat CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_gps_lng CHECK (longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='GPS轨迹点';

CREATE TABLE IF NOT EXISTS training_feedback (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_id BIGINT UNSIGNED NOT NULL,
  completion ENUM('full', 'mostly', 'partial', 'none') NOT NULL,
  actual_distance_km DECIMAL(7,2) NULL,
  actual_duration_min SMALLINT UNSIGNED NULL,
  rpe TINYINT UNSIGNED NULL,
  feel ENUM('easy', 'normal', 'fatigued', 'very_hard') NULL,
  pain_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  pain_parts JSON NOT NULL,
  note TEXT NULL,
  llm_signals JSON NOT NULL,
  submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_feedback_record (record_id),
  KEY idx_feedback_pain (pain_score, submitted_at),
  CONSTRAINT fk_feedback_record FOREIGN KEY (record_id) REFERENCES session_record(id) ON DELETE CASCADE,
  CONSTRAINT chk_feedback_rpe CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
  CONSTRAINT chk_feedback_pain CHECK (pain_score BETWEEN 0 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='训练完成后的结构化反馈';

CREATE TABLE IF NOT EXISTS weekly_summary (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  week_no SMALLINT UNSIGNED NOT NULL,
  week_start DATE NOT NULL,
  target_km DECIMAL(7,2) NOT NULL DEFAULT 0,
  actual_km DECIMAL(7,2) NOT NULL DEFAULT 0,
  longest_session_km DECIMAL(7,2) NOT NULL DEFAULT 0,
  longest_30d_km DECIMAL(7,2) NOT NULL DEFAULT 0,
  completed_sessions SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  planned_sessions SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  avg_rpe DECIMAL(4,1) NULL,
  has_pain TINYINT(1) NOT NULL DEFAULT 0,
  calculated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_weekly_summary (plan_id, week_no),
  CONSTRAINT fk_weekly_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_weekly_plan FOREIGN KEY (plan_id) REFERENCES training_plan(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='周训练量聚合结果';

CREATE TABLE IF NOT EXISTS ai_summary (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  content TEXT NOT NULL,
  facts_snapshot JSON NOT NULL,
  model_name VARCHAR(80) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_ai_summary_record (record_id),
  CONSTRAINT fk_ai_summary_record FOREIGN KEY (record_id) REFERENCES session_record(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_summary_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI训练总结';

CREATE TABLE IF NOT EXISTS ai_plan_task (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  profile JSON NOT NULL,
  status ENUM('queued', 'running', 'succeeded', 'failed') NOT NULL DEFAULT 'queued',
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  result JSON NULL,
  error_message VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  finished_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_ai_plan_task_user_created (user_id, created_at),
  CONSTRAINT fk_ai_plan_task_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='异步 AI 训练计划生成任务';

CREATE TABLE IF NOT EXISTS adjustment_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  record_id BIGINT UNSIGNED NULL,
  before_state JSON NOT NULL,
  after_state JSON NOT NULL,
  adjustment_set JSON NOT NULL,
  reason_codes JSON NOT NULL,
  user_decision ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  decided_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_adjustment_plan_created (plan_id, created_at),
  CONSTRAINT fk_adjustment_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_adjustment_plan FOREIGN KEY (plan_id) REFERENCES training_plan(id) ON DELETE CASCADE,
  CONSTRAINT fk_adjustment_record FOREIGN KEY (record_id) REFERENCES session_record(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI计划调整前后对比与用户决策';

CREATE TABLE IF NOT EXISTS ai_chat_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  record_id BIGINT UNSIGNED NULL,
  role ENUM('user', 'assistant', 'system', 'tool') NOT NULL,
  content TEXT NOT NULL,
  tool_calls JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_chat_user_created (user_id, created_at),
  CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_record FOREIGN KEY (record_id) REFERENCES session_record(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI对话日志';

COMMIT;
