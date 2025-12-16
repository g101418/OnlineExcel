const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const PORT = 3000;

// 中间件配置
app.use(cors());
app.use(bodyParser.json());

// 1. 接受用户上传的任务（含表格）- POST /api/save-task
app.post('/api/save-task', (req, res) => {
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
  } = req.body;
  
  if (!taskId || !taskName || !fileName || !uploadedHeaders || !uploadedData || !splitData || !permissions) {
    return res.status(400).json({ error: 'Required fields are missing' });
  }
  
  // 先检查taskId是否已经存在
  const checkSql = `SELECT id FROM tasks WHERE taskId = ?`;
  db.get(checkSql, [taskId], (err, existingTask) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // 如果已存在，忽略请求
    if (existingTask) {
      return res.status(200).json({
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
      JSON.stringify(req.body.updateTime || new Date().toISOString()),
      req.body.splitEnabled || false,
      req.body.permissionPanelCollapsed || false,
      req.body.progress || 'generation'
    ], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.status(201).json({
        id: this.lastID,
        taskId,
        taskName,
        taskDeadline,
        fileName,
        message: 'Task saved successfully'
      });
    });
  });
});

// 2. 按照用户请求发送相关任务信息 - GET /api/task/release/:taskId
app.get('/api/task/release/:taskId', (req, res) => {
  const taskId = req.params.taskId;
  
  const sql = `SELECT * FROM tasks WHERE taskId = ?`;
  db.get(sql, [taskId], (err, task) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // 解析JSON数据
    task.uploadedHeaders = JSON.parse(task.uploadedHeaders);
    task.uploadedData = JSON.parse(task.uploadedData);
    task.splitData = JSON.parse(task.splitData);
    task.permissions = JSON.parse(task.permissions);
    task.tableLinks = JSON.parse(task.tableLinks);
    
    res.status(200).json(task);
  });
});

// 3. 接受表格填报者上传的信息 - POST /api/task/submit/:taskId
app.post('/api/task/submit/:taskId', (req, res) => {
  const taskId = req.params.taskId;
  const { submitter, data } = req.body;
  
  if (!submitter || !data) {
    return res.status(400).json({ error: 'Submitter and data are required' });
  }
  
  // 检查任务是否存在
  const checkTaskSql = `SELECT id FROM tasks WHERE taskId = ?`;
  db.get(checkTaskSql, [taskId], (err, task) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // 插入提交数据
    const submitSql = `INSERT INTO task_submissions (task_id, submitter, data) VALUES (?, ?, ?)`;
    db.run(submitSql, [task.id, submitter, JSON.stringify(data)], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.status(201).json({
        id: this.lastID,
        taskId,
        submitter,
        data,
        message: 'Submission saved successfully'
      });
    });
  });
});

// 4. 反馈用户表格填报情况 - GET /api/task/status/:taskId
app.get('/api/task/status/:taskId', (req, res) => {
  const taskId = req.params.taskId;
  
  // 检查任务是否存在
  const checkTaskSql = `SELECT * FROM tasks WHERE taskId = ?`;
  db.get(checkTaskSql, [taskId], (err, task) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
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
        return res.status(500).json({ error: err.message });
      }
      
      // 解析JSON数据
      submissions = submissions.map(sub => {
        sub.data = JSON.parse(sub.data);
        return sub;
      });
      
      res.status(200).json({
        task,
        submissions,
        total_submissions: submissions.length
      });
    });
  });
});

// 5. 撤回任务 - POST /api/task/withdraw/:taskId
app.post('/api/task/withdraw/:taskId', (req, res) => {
  const taskId = req.params.taskId;
  
  const sql = `UPDATE tasks SET status = 'withdrawn' WHERE taskId = ?`;
  db.run(sql, [taskId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.status(200).json({
      taskId,
      status: 'withdrawn',
      message: 'Task withdrawn successfully'
    });
  });
});

// 6. 获取所有任务 - GET /api/tasks
app.get('/api/tasks', (req, res) => {
  const sql = `SELECT * FROM tasks ORDER BY created_at DESC`;
  db.all(sql, [], (err, tasks) => {
    if (err) {
      return res.status(500).json({ error: err.message });
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
    
    res.status(200).json(tasks);
  });
});

// 服务器启动
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
