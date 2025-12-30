import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './utils/logger.js';

// ========== 适配ES Module的路径解析（关键！） ==========
// ES Module中没有__dirname，需手动获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== 区分环境：本地/Docker数据库路径 ==========
// 1. 判断是否为生产环境（Docker部署）
const isProduction = process.env.NODE_ENV === 'production';

// 2. 数据库路径：本地用原路径 ./tasks.db，Docker用挂载路径
const dbPath = isProduction
  ? (process.env.DB_PATH || '/app/backend/db_mount/tasks.db')  // Docker挂载路径
  : path.join(__dirname, './tasks.db');                       // 本地路径（和你原有代码一致）

// ========== 创建数据库连接（复用你的核心逻辑） ==========
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('Database connection error:', err.message);
  } else {
    logger.info('Connected to the tasks database.');

    // 创建任务表
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId TEXT NOT NULL UNIQUE,
      taskName TEXT NOT NULL DEFAULT '',
      taskDeadline DATETIME,
      fileName TEXT NOT NULL,
      updateTime TEXT,
      tableLinks JSON NOT NULL DEFAULT '[]',
      uploadedHeaders JSON NOT NULL DEFAULT '[]',
      uploadedData JSON NOT NULL DEFAULT '[]',
      splitEnabled BOOLEAN DEFAULT FALSE,
      selectedHeader TEXT,
      split BOOLEAN DEFAULT FALSE,
      header TEXT,
      splitData JSON NOT NULL DEFAULT '[]',
      permissions JSON NOT NULL DEFAULT '{}',
      progress TEXT DEFAULT 'generation',
      status TEXT DEFAULT 'draft',
      formDescription TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        logger.error('Error creating tasks table:', err.message);
      } else {
        logger.info('Created tasks table.');
      }
    });

    // 创建表格填报数据表
    db.run(`CREATE TABLE IF NOT EXISTS table_fillings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filling_task_id TEXT NOT NULL UNIQUE,
      filling_task_name TEXT NOT NULL,
      original_task_id TEXT NOT NULL,
      original_table_data JSON NOT NULL DEFAULT '[]',
      modified_table_data JSON NOT NULL DEFAULT '[]',
      filling_status TEXT DEFAULT 'in_progress',
      overdue_permission BOOLEAN DEFAULT FALSE,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (original_task_id) REFERENCES tasks (taskId)
    )`, (err) => {
      if (err) {
        logger.error('Error creating table_fillings table:', err.message);
      } else {
        logger.info('Created table_fillings table.');
      }
    });
  }
});

export default db;
