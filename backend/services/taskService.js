const db = require('../db');

// 保存任务
exports.saveTask = (taskData, callback) => {
  const {
    taskId,
    taskName,
    taskDeadline,
    fileName,
    uploadedHeaders,
    uploadedData,
    selectedHeader,
    split,
    header,
    splitData,
    permissions,
    tableLinks = []
  } = taskData;

  // 先检查taskId是否已经存在
  const checkSql = `SELECT id FROM tasks WHERE taskId = ?`;
  db.get(checkSql, [taskId], (err, existingTask) => {
    if (err) {
      return callback(err);
    }
    
    // 如果已存在，忽略请求
    if (existingTask) {
      return callback(null, {
        taskId,
        message: 'Task already exists, request ignored'
      });
    }
    
    // 如果不存在，执行插入操作
    const sql = `INSERT INTO tasks (
      taskId, taskName, taskDeadline, fileName, uploadedHeaders, uploadedData, 
      selectedHeader, split, header, 
      splitData, permissions, tableLinks,
      updateTime, splitEnabled, permissionPanelCollapsed, progress
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [
      taskId,
      taskName,
      taskDeadline,
      fileName,
      JSON.stringify(uploadedHeaders),
      JSON.stringify(uploadedData),
      selectedHeader,
      split,
      header,
      JSON.stringify(splitData),
      JSON.stringify(permissions),
      JSON.stringify(tableLinks),
      JSON.stringify(taskData.updateTime || new Date().toISOString()),
      taskData.splitEnabled || false,
      taskData.permissionPanelCollapsed || false,
      taskData.progress || 'generation'
    ], function(err) {
      if (err) {
        return callback(err);
      }
      
      callback(null, {
        id: this.lastID,
        taskId,
        taskName,
        taskDeadline,
        fileName,
        message: 'Task saved successfully'
      });
    });
  });
};

// 获取任务发布数据
exports.getTaskReleaseData = (taskId, callback) => {
  const sql = `SELECT * FROM tasks WHERE taskId = ?`;
  db.get(sql, [taskId], (err, task) => {
    if (err) {
      return callback(err);
    }
    
    if (!task) {
      return callback(new Error('Task not found'));
    }
    
    // 解析JSON数据
    task.uploadedHeaders = JSON.parse(task.uploadedHeaders);
    task.uploadedData = JSON.parse(task.uploadedData);
    task.splitData = JSON.parse(task.splitData);
    task.permissions = JSON.parse(task.permissions);
    task.tableLinks = JSON.parse(task.tableLinks);
    
    callback(null, task);
  });
};

// 提交任务
exports.submitTask = (taskId, submitter, data, callback) => {
  // 检查任务是否存在
  const checkTaskSql = `SELECT id FROM tasks WHERE taskId = ?`;
  db.get(checkTaskSql, [taskId], (err, task) => {
    if (err) {
      return callback(err);
    }
    
    if (!task) {
      return callback(new Error('Task not found'));
    }
    
    // 插入提交数据
    const submitSql = `INSERT INTO task_submissions (task_id, submitter, data) VALUES (?, ?, ?)`;
    db.run(submitSql, [task.id, submitter, JSON.stringify(data)], function(err) {
      if (err) {
        return callback(err);
      }
      
      callback(null, {
        id: this.lastID,
        taskId,
        submitter,
        data,
        message: 'Submission saved successfully'
      });
    });
  });
};

// 获取任务状态
exports.getTaskStatus = (taskId, callback) => {
  // 检查任务是否存在
  const checkTaskSql = `SELECT * FROM tasks WHERE taskId = ?`;
  db.get(checkTaskSql, [taskId], (err, task) => {
    if (err) {
      return callback(err);
    }
    
    if (!task) {
      return callback(new Error('Task not found'));
    }
    
    // 解析JSON数据
    task.uploadedHeaders = JSON.parse(task.uploadedHeaders);
    task.uploadedData = JSON.parse(task.uploadedData);
    task.splitData = JSON.parse(task.splitData);
    task.permissions = JSON.parse(task.permissions);
    
    // 获取所有提交
    const submissionsSql = `SELECT * FROM task_submissions WHERE task_id = ? ORDER BY submitted_at DESC`;
    db.all(submissionsSql, [task.id], (err, submissions) => {
      if (err) {
        return callback(err);
      }
      
      // 解析JSON数据
      submissions = submissions.map(sub => {
        sub.data = JSON.parse(sub.data);
        return sub;
      });
      
      callback(null, {
        task,
        submissions,
        total_submissions: submissions.length
      });
    });
  });
};

// 撤回任务
exports.withdrawTask = (taskId, callback) => {
  const sql = `UPDATE tasks SET status = 'withdrawn' WHERE taskId = ?`;
  db.run(sql, [taskId], function(err) {
    if (err) {
      return callback(err);
    }
    
    if (this.changes === 0) {
      return callback(new Error('Task not found'));
    }
    
    callback(null, {
      taskId,
      status: 'withdrawn',
      message: 'Task withdrawn successfully'
    });
  });
};

// 获取所有任务
exports.getAllTasks = (callback) => {
  const sql = `SELECT * FROM tasks ORDER BY created_at DESC`;
  db.all(sql, [], (err, tasks) => {
    if (err) {
      return callback(err);
    }
    
    // 解析JSON数据
    tasks = tasks.map(task => {
      task.uploadedHeaders = JSON.parse(task.uploadedHeaders);
      task.uploadedData = JSON.parse(task.uploadedData);
      task.splitData = JSON.parse(task.splitData);
      task.permissions = JSON.parse(task.permissions);
      task.tableLinks = JSON.parse(task.tableLinks);
      return task;
    });
    
    callback(null, tasks);
  });
};
