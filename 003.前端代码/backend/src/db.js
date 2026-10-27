import mysql from 'mysql2/promise'
import { config } from './config.js'

export const pool = mysql.createPool(config.mysql)

export async function checkDatabase() {
  const connection = await pool.getConnection()
  try {
    await connection.query('SELECT 1')
  } finally {
    connection.release()
  }
}
