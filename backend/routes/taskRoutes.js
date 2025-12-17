const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

// ====================== /api/task/ ======================
// 针对整个task任务的操作，可能涉及多个拆分后表格

// 1. 后端接收前端推送的全量task数据（condition转release时）
router.post('/task/push-full-data', taskController.saveTask);

// 2. 后端发送给前端全量的task数据（用户访问release页面时）
router.get('/task/get-full-data/:taskId', taskController.getTaskReleaseData);

// 3. 删除task任务及相关的表格填报任务
router.post('/task/push-delete-task/:taskId', taskController.deleteTask);

// 4. 发送给前端任务拆分后所有表格的填报状态
router.get('/task/get-full-table-filling-status/:taskId', taskController.getTaskStatus);

// 5. 获取所有任务 - 原有接口，保留
router.get('/task/tasks', taskController.getAllTasks);

// 6. 获取任务完整数据 - 原有接口，保留
router.get('/task/get-task-data/:taskId', taskController.getTaskData);

// 7. 获取任务所有子任务的最新状态
router.get('/task/get-sub-task-statuses/:taskId', taskController.getSubTaskStatuses);

// ====================== /api/table-filling/ ======================
// 针对拆分后单个表的操作

// 5. 发送给前端任务某个拆分后表格，填报者填报的表格数据
router.get('/table-filling/get-table-data/:linkCode', taskController.getTaskFillingTableData);

// 6. 前端发送给后端信息，退回某个填报者填报的信息
router.post('/table-filling/push-withdraw/:linkCode', taskController.withdrawTable);

// 7. 发送给前端某个拆分后表格的相关信息
router.get('/table-filling/get-full-data/:linkCode', taskController.getTaskFillingData);

// 8. 前端发送给后端信息，用于暂存、提交填报的表格数据
router.post('/table-filling/push-submit-data/:linkCode', taskController.submitTask);

// 9. 保存表格草稿
router.post('/table-filling/save-draft/:linkCode', taskController.saveDraft);

module.exports = router;
