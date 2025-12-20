import * as taskService from '../services/taskService.js';
import { createError, ERROR_TYPES } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';

// 1. 接受用户上传的任务（含表格）
const saveTask = (req, res, next) => {
  const taskData = req.body;
  
  if (!taskData.taskId || !taskData.taskName || !taskData.fileName || !taskData.uploadedHeaders || !taskData.uploadedData || !taskData.permissions) {
    logger.warn('Required fields are missing in task submission', { taskData }, req);
    return next(createError(ERROR_TYPES.VALIDATION, 'Required fields are missing'));
  }
  
  logger.info('Saving task data', { taskId: taskData.taskId, taskName: taskData.taskName }, req);
  
  taskService.saveTask(taskData, (err, result) => {
    if (err) {
      logger.error('Failed to save task', { error: err.message, taskId: taskData.taskId }, req);
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    // 任务已存在的情况
    if (result.message === 'Task already exists') {
      logger.warn('Task already exists', { taskId: taskData.taskId }, req);
      return next(createError(ERROR_TYPES.CONFLICT, '任务已经存在'));
    }
    
    logger.info('Task saved successfully', { taskId: taskData.taskId, resultId: result.id }, req);
    
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
const getTaskReleaseData = (req, res, next) => {
  const taskId = req.params.taskId;
  
  logger.info('Fetching task release data', { taskId }, req);
  
  taskService.getTaskReleaseData(taskId, (err, task) => {
    if (err) {
      logger.error('Failed to fetch task release data', { error: err.message, taskId }, req);
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    if (!task) {
      logger.warn('Task not found', { taskId }, req);
      return next(createError(ERROR_TYPES.NOT_FOUND, 'Task not found'));
    }
    
    logger.info('Task release data fetched successfully', { taskId }, req);
    
    res.status(200).json(task);
  });
};

// 3. 接受表格填报者上传的信息（暂存、提交填报的表格数据）
const submitTask = (req, res, next) => {
  const linkCode = req.params.linkCode;
  const { tableData, isDraft } = req.body;
  
  if (!tableData) {
    logger.warn('Table data is required for submission', { linkCode }, req);
    return next(createError(ERROR_TYPES.VALIDATION, 'Table data is required'));
  }
  
  // 对于草稿和提交，使用不同的状态
  const status = isDraft ? 'in_progress' : 'submitted';
  
  logger.info(`Submitting ${status === 'in_progress' ? 'draft' : 'completed'} task`, { linkCode }, req);
  
  taskService.submitTask(linkCode, tableData, status, (err, result) => {
    if (err) {
      logger.error(`Failed to submit ${status === 'in_progress' ? 'draft' : 'completed'} task`, { error: err.message, linkCode }, req);
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    if (!result) {
      logger.warn('Task not found for submission', { linkCode }, req);
      return next(createError(ERROR_TYPES.NOT_FOUND, 'Task not found'));
    }
    
    logger.info(`${status === 'in_progress' ? 'Draft' : 'Submission'} saved successfully`, { linkCode, resultId: result.id }, req);
    
    res.status(200).json({
      linkCode,
      tableData,
      message: isDraft ? 'Draft saved successfully' : 'Submission saved successfully'
    });
  });
};

// 4. 反馈用户表格填报情况
const getTaskStatus = (req, res, next) => {
  const taskId = req.params.taskId;
  
  taskService.getTaskStatus(taskId, (err, result) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    if (!result) {
      return next(createError(ERROR_TYPES.NOT_FOUND, 'Task not found'));
    }
    
    res.status(200).json(result);
  });
};

// 5. 撤回任务
const withdrawTask = (req, res, next) => {
  const taskId = req.params.taskId;
  
  taskService.withdrawTask(taskId, (err, result) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    if (!result) {
      return next(createError(ERROR_TYPES.NOT_FOUND, 'Task not found'));
    }
    
    res.status(200).json({
      taskId,
      status: 'withdrawn',
      message: 'Task withdrawn successfully'
    });
  });
};

// 6. 删除task任务及相关的表格填报任务
const deleteTask = (req, res, next) => {
  const taskId = req.params.taskId;
  
  if (!taskId) {
    return next(createError(ERROR_TYPES.VALIDATION, 'TaskId is required'));
  }
  
  taskService.deleteTask(taskId, (err, result) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    res.status(200).json(result);
  });
};

// 7. 获取任务某个拆分后表格，填报者填报的表格数据
const getTaskFillingTableData = (req, res, next) => {
  const linkCode = req.params.linkCode;
  
  if (!linkCode) {
    return next(createError(ERROR_TYPES.VALIDATION, 'LinkCode is required'));
  }
  
  taskService.getTaskFillingTableData(linkCode, (err, result) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    res.status(200).json(result);
  });
};

// 6. 获取所有任务
const getAllTasks = (req, res, next) => {
  taskService.getAllTasks((err, tasks) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    res.status(200).json(tasks);
  });
};

// 7. 获取任务完整数据
const getTaskData = (req, res, next) => {
  const taskId = req.params.taskId;
  
  taskService.getTaskData(taskId, (err, task) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    if (!task) {
      return next(createError(ERROR_TYPES.NOT_FOUND, 'Task not found'));
    }
    
    res.status(200).json(task);
  });
};

// 8. 获取表格填报数据
const getTaskFillingData = (req, res, next) => {
  const linkCode = req.params.linkCode;
  
  taskService.getTaskFillingData(linkCode, (err, fillingTask) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    if (!fillingTask) {
      return next(createError(ERROR_TYPES.NOT_FOUND, 'Filling task not found'));
    }
    
    res.status(200).json(fillingTask);
  });
};

// 9. 保存表格草稿
const saveDraft = (req, res, next) => {
  const linkCode = req.params.linkCode;
  const { tableData } = req.body;
  
  if (!tableData) {
    return next(createError(ERROR_TYPES.VALIDATION, 'Table data is required'));
  }
  
  taskService.saveDraft(linkCode, tableData, (err, result) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    res.status(200).json(result);
  });
};

// 10. 撤回表格提交
const withdrawTable = (req, res, next) => {
  const linkCode = req.params.linkCode;
  
  taskService.withdrawTable(linkCode, (err, result) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    res.status(200).json(result);
  });
};

// 11. 获取任务所有子任务的状态
const getSubTaskStatuses = (req, res, next) => {
  const taskId = req.params.taskId;
  
  taskService.getSubTaskStatuses(taskId, (err, statuses) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    res.status(200).json(statuses);
  });
};

// 12. 还原表格数据
const restoreTable = (req, res, next) => {
  const linkCode = req.params.linkCode;
  
  taskService.restoreTable(linkCode, (err, result) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    res.status(200).json(result);
  });
};

// 13. 检查ID是否存在（支持taskid和子任务id查询）
const checkIdExists = (req, res, next) => {
  const id = req.params.id;
  
  taskService.checkIdExists(id, (err, result) => {
    if (err) {
      return next(createError(ERROR_TYPES.NOT_FOUND, err.message, err));
    }
    
    res.status(200).json(result);
  });
};

// 14. 对子任务进行逾期豁免
const overdueExemption = (req, res, next) => {
  const linkCode = req.params.linkCode;
  
  taskService.overdueExemption(linkCode, (err, result) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    res.status(200).json(result);
  });
};

// 15. 查询任务的所有子任务是否被豁免
const checkTaskOverdue = (req, res, next) => {
  const taskId = req.params.taskId;
  
  taskService.checkTaskOverdue(taskId, (err, result) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    res.status(200).json(result);
  });
};

// 16. 查询单个子项目的豁免情况
const checkSubTaskOverdue = (req, res, next) => {
  const linkCode = req.params.linkCode;
  
  taskService.checkSubTaskOverdue(linkCode, (err, result) => {
    if (err) {
      return next(createError(ERROR_TYPES.DATABASE, err.message, err));
    }
    
    res.status(200).json(result);
  });
};

export {
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