const sqlite3 = require('sqlite3').verbose();

// 创建数据库连接
const db = new sqlite3.Database('./tasks.db', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Connected to the tasks database.');
    
    // 创建任务表
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId TEXT NOT NULL UNIQUE,
      taskName TEXT NOT NULL,
      taskDeadline DATETIME,
      fileName TEXT NOT NULL,
      tableLinks JSON NOT NULL DEFAULT '[]',
      uploadedHeaders JSON NOT NULL,
      uploadedData JSON NOT NULL,
      split BOOLEAN DEFAULT FALSE,
      header TEXT,
      selectedHeader TEXT,            
      splitData JSON NOT NULL,
      permissions JSON NOT NULL,      
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log('Created tasks table.');
      }
    });
    
    // 为已存在的表添加taskName字段
    db.run(`ALTER TABLE tasks ADD COLUMN taskName TEXT NOT NULL DEFAULT ''`, (err) => {
      if (err) {
        // 如果是"duplicate column name"错误，忽略它
        if (!err.message.includes('duplicate column name')) {
          console.error(err.message);
        } else {
          console.log('taskName column already exists in tasks table.');
        }
      } else {
        console.log('Added taskName column to tasks table.');
      }
    });
    
    // 为已存在的表添加taskDeadline字段
    db.run(`ALTER TABLE tasks ADD COLUMN taskDeadline DATETIME`, (err) => {
      if (err) {
        // 如果是"duplicate column name"错误，忽略它
        if (!err.message.includes('duplicate column name')) {
          console.error(err.message);
        } else {
          console.log('taskDeadline column already exists in tasks table.');
        }
      } else {
        console.log('Added taskDeadline column to tasks table.');
      }
    });
    
    // 创建任务提交表
    db.run(`CREATE TABLE IF NOT EXISTS task_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      tableLink TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      submitted_data JSON NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks (id)
    )`, (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log('Created task_submissions table.');
      }
    });
  }
});

module.exports = db;
