const taskService = require('../services/taskService');

// 1. 接受用户上传的任务（含表格）
const saveTask = (req, res) => {
  const taskData = req.body;
  
  if (!taskData.taskId || !taskData.taskName || !taskData.fileName || !taskData.uploadedHeaders || !taskData.uploadedData || !taskData.permissions) {
    return res.status(400).json({ error: 'Required fields are missing' });
  }
  
  taskService.saveTask(taskData, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // 任务已存在的情况
    if (result.message === 'Task already exists') {
      return res.status(409).json({ error: '任务已经存在' });
    }
    
    res.status(201).json({
      id: result.id,
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

// 3. 接受表格填报者上传的信息（暂存、提交填报的表格数据）
const submitTask = (req, res) => {
  const linkCode = req.params.linkCode;
  const { tableData, isDraft } = req.body;
  
  if (!tableData) {
    return res.status(400).json({ error: 'Table data is required' });
  }
  
  // 对于草稿和提交，使用不同的状态
  const status = isDraft ? 'in_progress' : 'submitted';
  
  taskService.submitTask(linkCode, tableData, status, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!result) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.status(200).json({
      linkCode,
      tableData,
      message: isDraft ? 'Draft saved successfully' : 'Submission saved successfully'
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

// 6. 删除task任务及相关的表格填报任务
const deleteTask = (req, res) => {
  const taskId = req.params.taskId;
  
  if (!taskId) {
    return res.status(400).json({ error: 'TaskId is required' });
  }
  
  taskService.deleteTask(taskId, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(200).json(result);
  });
};

// 7. 获取任务某个拆分后表格，填报者填报的表格数据
const getTaskFillingTableData = (req, res) => {
  const linkCode = req.params.linkCode;
  
  if (!linkCode) {
    return res.status(400).json({ error: 'LinkCode is required' });
  }
  
  taskService.getTaskFillingTableData(linkCode, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(200).json(result);
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

// 7. 获取任务完整数据
const getTaskData = (req, res) => {
  const taskId = req.params.taskId;
  
  taskService.getTaskData(taskId, (err, task) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.status(200).json(task);
  });
};

// 8. 获取表格填报数据
const getTaskFillingData = (req, res) => {
  const linkCode = req.params.linkCode;
  
  taskService.getTaskFillingData(linkCode, (err, fillingTask) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!fillingTask) {
      return res.status(404).json({ error: 'Filling task not found' });
    }
    
    res.status(200).json(fillingTask);
  });
};

// 9. 保存表格草稿
const saveDraft = (req, res) => {
  const linkCode = req.params.linkCode;
  const { tableData } = req.body;
  
  if (!tableData) {
    return res.status(400).json({ error: 'Table data is required' });
  }
  
  taskService.saveDraft(linkCode, tableData, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(200).json(result);
  });
};

// 10. 撤回表格提交
const withdrawTable = (req, res) => {
  const linkCode = req.params.linkCode;
  
  taskService.withdrawTable(linkCode, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(200).json(result);
  });
};

// 11. 获取任务所有子任务的状态
const getSubTaskStatuses = (req, res) => {
  const taskId = req.params.taskId;
  
  taskService.getSubTaskStatuses(taskId, (err, statuses) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(200).json(statuses);
  });
};

// 12. 还原表格数据
const restoreTable = (req, res) => {
  const linkCode = req.params.linkCode;
  
  taskService.restoreTable(linkCode, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(200).json(result);
  });
};

// 13. 检查ID是否存在（支持taskid和子任务id查询）
const checkIdExists = (req, res) => {
  const id = req.params.id;
  
  taskService.checkIdExists(id, (err, result) => {
    if (err) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(200).json(result);
  });
};

// 14. 对子任务进行逾期豁免
const overdueExemption = (req, res) => {
  const linkCode = req.params.linkCode;
  
  taskService.overdueExemption(linkCode, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(200).json(result);
  });
};

// 15. 查询任务的所有子任务是否被豁免
const checkTaskOverdue = (req, res) => {
  const taskId = req.params.taskId;
  
  taskService.checkTaskOverdue(taskId, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(200).json(result);
  });
};

// 16. 查询单个子项目的豁免情况
const checkSubTaskOverdue = (req, res) => {
  const linkCode = req.params.linkCode;
  
  taskService.checkSubTaskOverdue(linkCode, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(200).json(result);
  });
};

module.exports = {
  saveTask,
  getTaskReleaseData,
  submitTask,
  getTaskStatus,
  withdrawTask,
  deleteTask,
  getAllTasks,
  getTaskData,
  getTaskFillingData,
  getTaskFillingTableData,
  saveDraft,
  withdrawTable,
  getSubTaskStatuses,
  restoreTable,
  checkIdExists,
  overdueExemption,
  checkTaskOverdue,
  checkSubTaskOverdue
};