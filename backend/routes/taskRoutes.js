const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');

// 1. 接受用户上传的任务（含表格）- POST /api/save-task
router.post('/save-task', taskController.saveTask);

// 2. 按照用户请求发送相关任务信息 - GET /api/task/release/:taskId
router.get('/task/release/:taskId', taskController.getTaskReleaseData);

// 3. 接受表格填报者上传的信息 - POST /api/task/submit/:taskId
router.post('/task/submit/:taskId', taskController.submitTask);

// 4. 反馈用户表格填报情况 - GET /api/task/status/:taskId
router.get('/task/status/:taskId', taskController.getTaskStatus);

// 5. 撤回任务 - POST /api/task/withdraw/:taskId
router.post('/task/withdraw/:taskId', taskController.withdrawTask);

// 6. 获取所有任务 - GET /api/tasks
router.get('/tasks', taskController.getAllTasks);

module.exports = router;
