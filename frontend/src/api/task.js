// 任务相关API

// 导入通用请求工具
import { post, get } from '../utils/request';

/**
 * 保存任务条件设置（后端接收前端推送的全量task数据）
 * @param {Object} taskData - 任务数据
 * @returns {Promise<Object>} - 返回保存结果
 */
export const saveTaskSettings = async (taskData) => {
  try {
    return await post('/task/push-full-data', taskData);
  } catch (error) {
    console.error("保存任务设置出错:", error);
    throw error;
  }
};

/**
 * 获取任务发布页面数据（后端发送给前端全量的task数据）
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} - 返回任务发布数据
 */
export const getTaskReleaseData = async (taskId) => {
  try {
    return await get(`/task/get-full-data/${taskId}`);
  } catch (error) {
    console.error("获取任务发布数据出错:", error);
    throw error;
  }
};

/**
 * 获取任务完整数据（后端发送给前端全量的task数据）
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} - 返回任务完整数据
 */
export const getTaskData = async (taskId) => {
  try {
    return await get(`/task/get-full-data/${taskId}`);
  } catch (error) {
    console.error("获取任务数据出错:", error);
    throw error;
  }
};



/**
 * 删除任务及相关的表格填报任务
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} - 返回删除结果
 */
export const deleteTask = async (taskId) => {
  try {
    return await post(`/task/push-delete-task/${taskId}`);
  } catch (error) {
    console.error("删除任务出错:", error);
    throw error;
  }
};

/**
 * 撤回任务
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} - 返回撤回结果
 */
export const withdrawTask = async (taskId) => {
  try {
    return await post(`/task/push-withdraw-task/${taskId}`);
  } catch (error) {
    console.error("撤回任务出错:", error);
    throw error;
  }
};

/**
 * 获取任务拆分后所有表格的填报状态
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} - 返回填报状态
 */
export const getFullTableFillingStatus = async (taskId) => {
  try {
    return await get(`/task/get-full-table-filling-status/${taskId}`);
  } catch (error) {
    console.error("获取表格填报状态出错:", error);
    throw error;
  }
};

/**
 * 获取任务所有子任务的最新状态
 * @param {string} taskId - 任务ID
 * @returns {Promise<Array>} - 返回子任务状态列表
 */
export const getSubTaskStatuses = async (taskId) => {
  try {
    return await get(`/task/get-sub-task-statuses/${taskId}`);
  } catch (error) {
    console.error("获取子任务状态出错:", error);
    throw error;
  }
};

/**
 * 获取任务某个拆分后表格，填报者填报的表格数据
 * @param {string} linkCode - 任务链接码
 * @returns {Promise<Object>} - 返回表格数据
 */
export const getTableData = async (linkCode) => {
  try {
    return await get(`/table-filling/get-table-data/${linkCode}`);
  } catch (error) {
    console.error("获取表格数据出错:", error);
    throw error;
  }
};

/**
 * 撤回表格提交
 * @param {string} linkCode - 任务链接码
 * @returns {Promise<Object>} - 返回撤回结果
 */
export const withdrawTable = async (linkCode) => {
  try {
    return await post(`/table-filling/push-withdraw/${linkCode}`);
  } catch (error) {
    console.error("撤回表格提交出错:", error);
    throw error;
  }
};

/**
 * 获取某个拆分后表格的相关信息（用于tablefilling.vue）
 * @param {string} linkCode - 任务链接码
 * @returns {Promise<Object>} - 返回表格完整数据
 */
export const getTaskFillingData = async (linkCode) => {
  try {
    return await get(`/table-filling/get-full-data/${linkCode}`);
  } catch (error) {
    console.error("获取表格填报数据出错:", error);
    throw error;
  }
};

/**
 * 保存表格草稿（用于暂存填报的表格数据）
 * @param {string} linkCode - 任务链接码
 * @param {Array} tableData - 表格数据
 * @returns {Promise<Object>} - 返回保存结果
 */
export const saveDraft = async (linkCode, tableData) => {
  try {
    return await post(`/table-filling/push-submit-data/${linkCode}`, { tableData, isDraft: true });
  } catch (error) {
    console.error("保存表格草稿出错:", error);
    throw error;
  }
};

/**
 * 提交表格数据（用于提交填报的表格数据）
 * @param {string} linkCode - 任务链接码
 * @param {Array} tableData - 表格数据
 * @returns {Promise<Object>} - 返回提交结果
 */
export const submitTable = async (linkCode, tableData) => {
  try {
    return await post(`/table-filling/push-submit-data/${linkCode}`, { tableData, isDraft: false });
  } catch (error) {
    console.error("提交表格数据出错:", error);
    throw error;
  }
};

/**
 * 还原表格数据（用原始数据覆盖修改后的数据）
 * @param {string} linkCode - 任务链接码
 * @returns {Promise<Object>} - 返回还原结果
 */
export const restoreTable = async (linkCode) => {
  try {
    return await post(`/table-filling/restore-table-data/${linkCode}`);
  } catch (error) {
    console.error("还原表格数据出错:", error);
    throw error;
  }
};
