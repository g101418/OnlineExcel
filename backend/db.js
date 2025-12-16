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
      permissionPanelCollapsed BOOLEAN DEFAULT FALSE,
      progress TEXT DEFAULT 'generation',
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
    
    // 为已存在的表添加缺失的字段
    const alterColumns = [
      `ADD COLUMN taskName TEXT NOT NULL DEFAULT ''`,
      `ADD COLUMN taskDeadline DATETIME`,
      `ADD COLUMN updateTime TEXT`,
      `ADD COLUMN splitEnabled BOOLEAN DEFAULT FALSE`,
      `ADD COLUMN permissionPanelCollapsed BOOLEAN DEFAULT FALSE`,
      `ADD COLUMN progress TEXT DEFAULT 'generation'`
    ];
    
    alterColumns.forEach((alterStmt, index) => {
      db.run(`ALTER TABLE tasks ${alterStmt}`, (err) => {
        if (err) {
          // 如果是"duplicate column name"错误，忽略它
          if (!err.message.includes('duplicate column name')) {
            console.error(err.message);
          } else {
            console.log(`Column already exists in tasks table: ${alterStmt}`);
          }
        } else {
          console.log(`Added column to tasks table: ${alterStmt}`);
        }
        
        // 只有当所有ALTER TABLE语句执行完毕后，才开始执行其他操作
        if (index === alterColumns.length - 1) {
          // 可以在这里添加其他初始化操作
        }
      });
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
