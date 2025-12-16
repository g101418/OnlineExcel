const taskService = require('../services/taskService');

// 1. 接受用户上传的任务（含表格）
const saveTask = (req, res) => {
  const taskData = req.body;
  
  if (!taskData.taskId || !taskData.taskName || !taskData.fileName || !taskData.uploadedHeaders || !taskData.uploadedData || !taskData.splitData || !taskData.permissions) {
    return res.status(400).json({ error: 'Required fields are missing' });
  }
  
  taskService.saveTask(taskData, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // 任务已存在的情况
    if (result.message === 'Task already exists') {
      return res.status(200).json({ ...result, message: 'Task already exists, request ignored' });
    }
    
    res.status(201).json({
      id: result.id,
      taskId: result.taskId,
      taskName: taskData.taskName,
      taskDeadline: taskData.taskDeadline,
      fileName: taskData.fileName,
      message: 'Task saved successfully'
    });
  });
};

// 2. 按照用户请求发送相关任务信息
const getTaskReleaseData = (req, res) => {
  const taskId = req.params.taskId;
  
  taskService.getTaskReleaseData(taskId, (err, task) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.status(200).json(task);
  });
};

// 3. 接受表格填报者上传的信息
const submitTask = (req, res) => {
  const taskId = req.params.taskId;
  const { submitter, data } = req.body;
  
  if (!submitter || !data) {
    return res.status(400).json({ error: 'Submitter and data are required' });
  }
  
  taskService.submitTask(taskId, submitter, data, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!result) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.status(201).json({
      id: result.id,
      taskId,
      submitter,
      data,
      message: 'Submission saved successfully'
    });
  });
};

// 4. 反馈用户表格填报情况
const getTaskStatus = (req, res) => {
  const taskId = req.params.taskId;
  
  taskService.getTaskStatus(taskId, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!result) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.status(200).json(result);
  });
};

// 5. 撤回任务
const withdrawTask = (req, res) => {
  const taskId = req.params.taskId;
  
  taskService.withdrawTask(taskId, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!result) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.status(200).json({
      taskId,
      status: 'withdrawn',
      message: 'Task withdrawn successfully'
    });
  });
};

// 6. 获取所有任务
const getAllTasks = (req, res) => {
  taskService.getAllTasks((err, tasks) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(200).json(tasks);
  });
};

module.exports = {
  saveTask,
  getTaskReleaseData,
  submitTask,
  getTaskStatus,
  withdrawTask,
  getAllTasks
};