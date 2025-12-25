import sqlite3 from 'sqlite3';
import logger from './utils/logger.js';

// 创建数据库连接
const db = new sqlite3.Database('./tasks.db', (err) => {
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
