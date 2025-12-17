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
    
    // 执行插入或更新操作
    let sql;
    let params;
    
    if (existingTask) {
      // 如果任务已存在，执行更新操作
      sql = `UPDATE tasks SET 
        taskName = ?, taskDeadline = ?, fileName = ?, uploadedHeaders = ?, uploadedData = ?, 
        selectedHeader = ?, split = ?, header = ?, 
        splitData = ?, permissions = ?, tableLinks = ?, 
        updateTime = ?, splitEnabled = ?, permissionPanelCollapsed = ?, progress = ? 
        WHERE taskId = ?`;
      
      params = [
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
        taskData.progress || 'generation',
        taskId
      ];
    } else {
      // 如果任务不存在，执行插入操作
      sql = `INSERT INTO tasks (
        taskId, taskName, taskDeadline, fileName, uploadedHeaders, uploadedData, 
        selectedHeader, split, header, 
        splitData, permissions, tableLinks,
        updateTime, splitEnabled, permissionPanelCollapsed, progress
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      params = [
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
      ];
    }
    
    db.run(sql, params, function(err) {
      if (err) {
        return callback(err);
      }
      
      // 无论插入还是更新，都需要先删除原有子任务，然后创建新的子任务
      // 先删除与任务相关的表格填报任务
      const deleteFillingTasksSql = `DELETE FROM table_fillings WHERE original_task_id = ?`;
      db.run(deleteFillingTasksSql, [taskId], (err) => {
        if (err) {
          return callback(err);
        }
        
        // 然后创建新的表格填报任务
        const insertFillingTask = (index, callback) => {
          if (index >= tableLinks.length) {
            // 所有表格填报任务都创建完成
            return callback(null);
          }
          
          const tableLink = tableLinks[index];
          const tableData = splitData[index] || { data: [] };
          
          const fillingSql = `INSERT INTO table_fillings (
            filling_task_id, filling_task_name, original_task_id, 
            original_table_data, modified_table_data, filling_status, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
          
          db.run(fillingSql, [
            tableLink.code,
            tableLink.name,
            taskId,
            JSON.stringify(tableData.data),
            JSON.stringify(tableData.data),
            'in_progress'
          ], function(err) {
            if (err) {
              return callback(err);
            }
            
            // 继续创建下一个表格填报任务
            insertFillingTask(index + 1, callback);
          });
        };
      
        // 开始创建表格填报任务
        insertFillingTask(0, (err) => {
          if (err) {
            return callback(err);
          }
          
          // 所有操作都成功完成
          callback(null, {
            id: existingTask ? existingTask.id : this.lastID,
            taskId,
            taskName,
            taskDeadline,
            fileName,
            message: existingTask ? 'Task updated and filling tasks recreated successfully' : 'Task saved successfully'
          });
        });
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

// 获取任务完整数据
exports.getTaskData = (taskId, callback) => {
  // 复用getTaskReleaseData的实现
  exports.getTaskReleaseData(taskId, callback);
};

// 获取表格填报数据
exports.getTaskFillingData = (linkCode, callback) => {
  const sql = `
    SELECT tf.*, t.taskId, t.taskName, t.taskDeadline, t.uploadedHeaders, t.permissions 
    FROM table_fillings tf 
    JOIN tasks t ON tf.original_task_id = t.taskId 
    WHERE tf.filling_task_id = ?
  `;
  db.get(sql, [linkCode], (err, fillingTask) => {
    if (err) {
      return callback(err);
    }
    
    if (!fillingTask) {
      return callback(new Error('Filling task not found'));
    }
    
    // 解析JSON数据
    fillingTask.original_table_data = JSON.parse(fillingTask.original_table_data);
    fillingTask.modified_table_data = JSON.parse(fillingTask.modified_table_data);
    const uploadedHeaders = JSON.parse(fillingTask.uploadedHeaders);
    const permissions = JSON.parse(fillingTask.permissions);
    
    // 构建返回数据
    const responseData = {
      taskId: fillingTask.taskId,
      taskName: fillingTask.taskName,
      taskDeadline: fillingTask.taskDeadline,
      headers: uploadedHeaders, // 表头数据
      tableData: fillingTask.modified_table_data || fillingTask.original_table_data, // 表格内容数据
      permissions: permissions, // 权限与校验规则
      fillingTaskId: fillingTask.filling_task_id,
      fillingTaskName: fillingTask.filling_task_name,
      originalTaskId: fillingTask.original_task_id,
      fillingStatus: fillingTask.filling_status
    };
    callback(null, responseData);
  });
};

// 保存表格草稿
exports.saveDraft = (linkCode, tableData, callback) => {
  const sql = `UPDATE table_fillings SET modified_table_data = ?, updated_at = CURRENT_TIMESTAMP WHERE filling_task_id = ?`;
  db.run(sql, [JSON.stringify(tableData), linkCode], function(err) {
    if (err) {
      return callback(err);
    }
    
    if (this.changes === 0) {
      return callback(new Error('Filling task not found'));
    }
    
    callback(null, {
      linkCode,
      tableData,
      message: 'Draft saved successfully'
    });
  });
};

// 撤回表格提交（改为已退回状态）
exports.withdrawTable = (linkCode, callback) => {
  const sql = `UPDATE table_fillings SET filling_status = 'returned', updated_at = CURRENT_TIMESTAMP WHERE filling_task_id = ?`;
  db.run(sql, [linkCode], function(err) {
    if (err) {
      return callback(err);
    }
    
    if (this.changes === 0) {
      return callback(new Error('Filling task not found'));
    }
    
    callback(null, {
      linkCode,
      status: 'returned',
      message: 'Table submission returned successfully'
    });
  });
};

// 获取任务所有子任务的状态
exports.getSubTaskStatuses = (taskId, callback) => {
  const sql = `SELECT filling_task_id, filling_status FROM table_fillings WHERE original_task_id = ?`;
  db.all(sql, [taskId], (err, statuses) => {
    if (err) {
      return callback(err);
    }
    callback(null, statuses);
  });
};

// 提交任务（暂存、提交填报的表格数据）
exports.submitTask = (linkCode, tableData, status, callback) => {
  // 检查表格填报任务是否存在
  const checkFillingTaskSql = `SELECT * FROM table_fillings WHERE filling_task_id = ?`;
  db.get(checkFillingTaskSql, [linkCode], (err, fillingTask) => {
    if (err) {
      return callback(err);
    }
    
    if (!fillingTask) {
      return callback(new Error('Filling task not found'));
    }
    
    // 更新表格填报数据
    const updateFillingTaskSql = `UPDATE table_fillings SET modified_table_data = ?, filling_status = ?, updated_at = CURRENT_TIMESTAMP WHERE filling_task_id = ?`;
    db.run(updateFillingTaskSql, [JSON.stringify(tableData), status, linkCode], function(err) {
      if (err) {
        return callback(err);
      }
      
      callback(null, {
        id: this.lastID,
        linkCode,
        tableData,
        status,
        message: status === 'in_progress' ? 'Draft saved successfully' : 'Submission saved successfully'
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

// 删除任务及相关的表格填报任务
exports.deleteTask = (taskId, callback) => {
  // 开始事务
  db.serialize(() => {
    // 先删除与任务相关的表格填报任务
    const deleteFillingTasksSql = `DELETE FROM table_fillings WHERE original_task_id = ?`;
    db.run(deleteFillingTasksSql, [taskId], (err) => {
      if (err) {
        return callback(err);
      }
    });
    
    // 最后删除任务本身
    const deleteTaskSql = `DELETE FROM tasks WHERE taskId = ?`;
    db.run(deleteTaskSql, [taskId], function(err) {
      if (err) {
        return callback(err);
      }
      
      callback(null, {
        taskId,
        message: this.changes > 0 
          ? 'Task and related filling tasks deleted successfully' 
          : 'Task already deleted'
      });
    });
  });
};

// 获取任务某个拆分后表格，填报者填报的表格数据
exports.getTaskFillingTableData = (linkCode, callback) => {
  const sql = `SELECT modified_table_data FROM table_fillings WHERE filling_task_id = ?`;
  db.get(sql, [linkCode], (err, fillingTask) => {
    if (err) {
      return callback(err);
    }
    
    if (!fillingTask) {
      return callback(new Error('Filling task not found'));
    }
    
    // 解析JSON数据
    fillingTask.modified_table_data = JSON.parse(fillingTask.modified_table_data);
    
    callback(null, {
      table_data: fillingTask.modified_table_data,
      message: 'Table data retrieved successfully'
    });
  });
};

// 还原表格数据（用原始数据覆盖修改后的数据）
exports.restoreTable = (linkCode, callback) => {
  const sql = `
    UPDATE table_fillings 
    SET modified_table_data = original_table_data, updated_at = CURRENT_TIMESTAMP 
    WHERE filling_task_id = ?
  `;
  db.run(sql, [linkCode], function(err) {
    if (err) {
      return callback(err);
    }
    
    if (this.changes === 0) {
      return callback(new Error('Filling task not found'));
    }
    
    callback(null, {
      linkCode,
      message: 'Table data restored successfully'
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
