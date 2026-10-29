import mysql from 'mysql2/promise'
import { config } from './config.js'

export const pool = mysql.createPool(config.mysql)

export async function ensureRuntimeTables() {
  await pool.execute(`CREATE TABLE IF NOT EXISTS ai_plan_task (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`)
}

export async function checkDatabase() {
  const connection = await pool.getConnection()
  try {
    await connection.query('SELECT 1')
  } finally {
    connection.release()
  }
}
