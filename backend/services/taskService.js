import db from '../db.js';

// 检查任务是否超期，并更新状态
const checkAndUpdateTaskOverdue = (taskId, callback) => {
  // 查询任务信息
  const sql = `SELECT taskDeadline, status FROM tasks WHERE taskId = ?`;
  db.get(sql, [taskId], (err, task) => {
    if (err) {
      return callback(err);
    }

    if (!task) {
      return callback(new Error('Task not found'));
    }

    // 如果任务已经是overdue状态，不再检查
    if (task.status === 'overdue') {
      return callback(null, { isOverdue: true, status: task.status });
    }

    // 如果没有设置截止时间，不认为是超期
    if (!task.taskDeadline) {
      return callback(null, { isOverdue: false, status: task.status });
    }

    // 检查是否超期
    const now = new Date();
    const deadline = new Date(task.taskDeadline);
    const isOverdue = now > deadline;

    // 如果超期，更新状态
    if (isOverdue) {
      const updateSql = `UPDATE tasks SET status = 'overdue', updated_at = CURRENT_TIMESTAMP WHERE taskId = ?`;
      db.run(updateSql, [taskId], (err) => {
        if (err) {
          return callback(err);
        }
        callback(null, { isOverdue: true, status: 'overdue' });
      });
    } else {
      callback(null, { isOverdue: false, status: task.status });
    }
  });
};

// 统一导出所有函数
export {
  checkAndUpdateTaskOverdue,
  checkTaskOverdueAndPermission,
  checkSubTaskOverduePermission,
  saveTask,
  getTaskReleaseData,
  getTaskData,
  getTaskFillingData,
  saveDraft,
  withdrawTable,
  getSubTaskStatuses,
  submitTask,
  getTaskStatus,
  withdrawTask,
  deleteTask,
  getTaskFillingTableData,
  restoreTable,
  getAllTasks,
  checkIdExists,
  overdueExemption,
  checkTaskOverdue,
  checkSubTaskOverdue
};

// 为子任务相关接口添加的统一函数：先检测主任务是否逾期，再检查子任务豁免状态
const checkTaskOverdueAndPermission = (linkCode, callback) => {
  // 1. 先获取子任务信息，包括original_task_id
  const sql = `SELECT tf.*, t.taskId, t.taskDeadline, t.status 
              FROM table_fillings tf 
              JOIN tasks t ON tf.original_task_id = t.taskId 
              WHERE tf.filling_task_id = ?`;
  db.get(sql, [linkCode], (err, fillingTask) => {
    if (err) {
      return callback(err);
    }

    if (!fillingTask) {
      return callback(new Error('Filling task not found'));
    }

    // 2. 检测主任务是否逾期
    checkAndUpdateTaskOverdue(fillingTask.original_task_id, (err, overdueResult) => {
      if (err) {
        return callback(err);
      }

      // 3. 如果主任务逾期，检查子任务是否被豁免
      if (overdueResult.isOverdue && !fillingTask.overdue_permission) {
        return callback(new Error('超期'));
      }

      // 允许操作
      callback(null, {
        canOperate: true,
        isOverdue: overdueResult.isOverdue,
        taskId: fillingTask.original_task_id,
        fillingTask: fillingTask
      });
    });
  });
};

// 保存任务
const saveTask = (taskData, callback) => {
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
    tableLinks = [],
    formDescription = ''
  } = taskData;

  // 先检查taskId是否已经存在
  const checkSql = `SELECT id FROM tasks WHERE taskId = ?`;
  db.get(checkSql, [taskId], (err, existingTask) => {
    if (err) {
      return callback(err);
    }

    // 如果任务已存在，直接返回错误
    if (existingTask) {
      return callback(null, { message: 'Task already exists' });
    }

    // 执行插入操作
    const sql = `INSERT INTO tasks (
      taskId, taskName, taskDeadline, fileName, uploadedHeaders, uploadedData, 
      selectedHeader, split, header, 
      splitData, permissions, tableLinks,
      updateTime, splitEnabled, permissionPanelCollapsed, progress, formDescription
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
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
      taskData.progress || 'generation',
      formDescription
    ];

    db.run(sql, params, function (err) {
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
            original_table_data, modified_table_data, filling_status, overdue_permission, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

          db.run(fillingSql, [
            tableLink.code,
            tableLink.name,
            taskId,
            JSON.stringify(tableData.data),
            JSON.stringify(tableData.data),
            'in_progress',
            false
          ], function (err) {
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
const getTaskReleaseData = (taskId, callback) => {
  // 先检查并更新任务是否超期
  checkAndUpdateTaskOverdue(taskId, (err) => {
    if (err) {
      return callback(err);
    }

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
  });
};

// 获取任务完整数据
const getTaskData = (taskId, callback) => {
  // 复用getTaskReleaseData的实现
  exports.getTaskReleaseData(taskId, callback);
};

// 检查子任务的超期情况并验证权限
const checkSubTaskOverduePermission = (linkCode, callback) => {
  const sql = `
    SELECT tf.*, t.taskDeadline, t.status 
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

    // 检查是否超期：如果没有设置截止时间，不认为是超期
    let isOverdue = false;
    if (fillingTask.taskDeadline) {
      const now = new Date();
      const deadline = new Date(fillingTask.taskDeadline);
      isOverdue = now > deadline;
    }

    // 如果任务未超期，直接允许操作
    if (!isOverdue) {
      return callback(null, { canOperate: true, isOverdue: false });
    }

    // 如果任务超期，检查是否被豁免
    if (fillingTask.overdue_permission) {
      return callback(null, { canOperate: true, isOverdue: true });
    }

    // 超期且未被豁免，不允许操作
    return callback(new Error('超期'));
  });
};

// 获取表格填报数据
const getTaskFillingData = (linkCode, callback) => {
  // 先获取子任务信息，包括original_task_id
  const sql = `
    SELECT tf.*, t.taskId, t.taskName, t.taskDeadline, t.uploadedHeaders, t.permissions, t.formDescription 
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

    // 检查并更新主任务是否超期
    checkAndUpdateTaskOverdue(fillingTask.original_task_id, (err) => {
      if (err) {
        return callback(err);
      }

      // 解析JSON数据
      fillingTask.original_table_data = JSON.parse(fillingTask.original_table_data);
      fillingTask.modified_table_data = JSON.parse(fillingTask.modified_table_data);
      const uploadedHeaders = JSON.parse(fillingTask.uploadedHeaders);
      const permissions = JSON.parse(fillingTask.permissions);

      // 构建返回数据
      const responseData = {
        taskName: fillingTask.taskName,
        taskDeadline: fillingTask.taskDeadline,
        headers: uploadedHeaders, // 表头数据
        tableData: fillingTask.modified_table_data || fillingTask.original_table_data, // 表格内容数据
        permissions: permissions, // 权限与校验规则
        taskId: fillingTask.filling_task_id, // 使用filling_task_id作为前端展示的任务ID
        fillingStatus: fillingTask.filling_status,
        formDescription: fillingTask.formDescription || ''
      };
      callback(null, responseData);
    });
  });
};

// 保存表格草稿
const saveDraft = (linkCode, tableData, callback) => {
  // 先检测主任务是否逾期，再检查子任务豁免状态
  checkTaskOverdueAndPermission(linkCode, (err) => {
    if (err) {
      return callback(err);
    }

    const sql = `UPDATE table_fillings SET modified_table_data = ?, updated_at = CURRENT_TIMESTAMP WHERE filling_task_id = ?`;
    db.run(sql, [JSON.stringify(tableData), linkCode], function (err) {
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
  });
};

// 撤回表格提交（改为已退回状态）
const withdrawTable = (linkCode, callback) => {
  const sql = `UPDATE table_fillings SET filling_status = 'returned', updated_at = CURRENT_TIMESTAMP WHERE filling_task_id = ?`;
  db.run(sql, [linkCode], function (err) {
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
const getSubTaskStatuses = (taskId, callback) => {
  const sql = `SELECT filling_task_id, filling_status FROM table_fillings WHERE original_task_id = ?`;
  db.all(sql, [taskId], (err, statuses) => {
    if (err) {
      return callback(err);
    }
    callback(null, statuses);
  });
};

// 提交任务（暂存、提交填报的表格数据）
const submitTask = (linkCode, tableData, status, callback) => {
  // 先检测主任务是否逾期，再检查子任务豁免状态
  checkTaskOverdueAndPermission(linkCode, (err) => {
    if (err) {
      return callback(err);
    }

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
      db.run(updateFillingTaskSql, [JSON.stringify(tableData), status, linkCode], function (err) {
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
  });
};

// 获取任务状态
const getTaskStatus = (taskId, callback) => {
  // 先检查并更新任务是否超期
  checkAndUpdateTaskOverdue(taskId, (err) => {
    if (err) {
      return callback(err);
    }

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
  });
};

// 撤回任务
const withdrawTask = (taskId, callback) => {
  const sql = `UPDATE tasks SET status = 'withdrawn' WHERE taskId = ?`;
  db.run(sql, [taskId], function (err) {
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
const deleteTask = (taskId, callback) => {
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
    db.run(deleteTaskSql, [taskId], function (err) {
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
const getTaskFillingTableData = (linkCode, callback) => {
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
const restoreTable = (linkCode, callback) => {
  // 先检测主任务是否逾期，再检查子任务豁免状态
  checkTaskOverdueAndPermission(linkCode, (err) => {
    if (err) {
      return callback(err);
    }

    const sql = `
      UPDATE table_fillings 
      SET modified_table_data = original_table_data, updated_at = CURRENT_TIMESTAMP 
      WHERE filling_task_id = ?
    `;
    db.run(sql, [linkCode], function (err) {
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
  });
};

// 获取所有任务
const getAllTasks = (callback) => {
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

// 检查ID是否存在（支持taskid和子任务id查询）
const checkIdExists = (id, callback) => {
  // 根据ID长度判断查询表
  if (id.length === 24) {
    // 24位ID，查询主任务表
    const checkTaskSql = `SELECT taskId FROM tasks WHERE taskId = ?`;
    db.get(checkTaskSql, [id], (err, task) => {
      if (err) {
        return callback(err);
      }

      if (task) {
        // 存在task，返回"task"
        return callback(null, "task");
      }

      // 不存在，返回错误
      callback(new Error("未找到任务ID，可能已经删除或未上传"));
    });
  } else if (id.length === 28) {
    // 30位ID，查询子任务表
    const checkFillingTaskSql = `SELECT filling_task_id FROM table_fillings WHERE filling_task_id = ?`;
    db.get(checkFillingTaskSql, [id], (err, fillingTask) => {
      if (err) {
        return callback(err);
      }

      if (fillingTask) {
        // 存在table_filling任务，返回"table_filling"
        return callback(null, "table_filling");
      }

      // 不存在，返回错误
      callback(new Error("未找到任务ID，可能已经删除或未上传"));
    });
  } else {
    // 长度不符合要求，直接返回错误
    callback(new Error("ID长度错误"));
  }
};

// 对子任务进行逾期豁免
const overdueExemption = (linkCode, callback) => {
  const sql = `UPDATE table_fillings SET overdue_permission = true, updated_at = CURRENT_TIMESTAMP WHERE filling_task_id = ?`;
  db.run(sql, [linkCode], function (err) {
    if (err) {
      return callback(err);
    }

    if (this.changes === 0) {
      return callback(new Error('Filling task not found'));
    }

    callback(null, {
      linkCode,
      message: 'Overdue exemption granted successfully'
    });
  });
};

// 查询任务的所有子任务是否被豁免
const checkTaskOverdue = (taskId, callback) => {
  // 先检查并更新任务是否超期
  checkAndUpdateTaskOverdue(taskId, (err) => {
    if (err) {
      return callback(err);
    }

    const sql = `
      SELECT tf.filling_task_id, tf.overdue_permission, tf.filling_task_name, t.status, t.taskDeadline 
      FROM table_fillings tf 
      JOIN tasks t ON tf.original_task_id = t.taskId 
      WHERE t.taskId = ?
    `;
    db.all(sql, [taskId], (err, subTasks) => {
      if (err) {
        return callback(err);
      }

      callback(null, subTasks);
    });
  });
};

// 查询单个子项目的豁免情况
const checkSubTaskOverdue = (linkCode, callback) => {
  // 先获取子任务信息，包括original_task_id
  const sql = `
    SELECT tf.*, t.taskId, t.status, t.taskDeadline 
    FROM table_fillings tf 
    JOIN tasks t ON tf.original_task_id = t.taskId 
    WHERE tf.filling_task_id = ?
  `;
  db.get(sql, [linkCode], (err, subTask) => {
    if (err) {
      return callback(err);
    }

    if (!subTask) {
      return callback(new Error('Sub task not found'));
    }

    // 检查并更新主任务是否超期
    checkAndUpdateTaskOverdue(subTask.original_task_id, (err) => {
      if (err) {
        return callback(err);
      }

      // 查询更新后的状态
      const updateSql = `
        SELECT tf.overdue_permission, t.status, t.taskDeadline 
        FROM table_fillings tf 
        JOIN tasks t ON tf.original_task_id = t.taskId 
        WHERE tf.filling_task_id = ?
      `;
      db.get(updateSql, [linkCode], (err, updatedSubTask) => {
        if (err) {
          return callback(err);
        }

        callback(null, updatedSubTask);
      });
    });
  });
};
