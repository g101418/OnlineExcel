// 任务相关API

// 导入通用请求工具
import { post, get } from '../utils/request';

/**
 * 保存任务条件设置
 * @param {Object} taskData - 任务数据
 * @returns {Promise<Object>} - 返回保存结果
 */
export const saveTaskSettings = async (taskData) => {
  try {
    return await post('/save-task', taskData);
  } catch (error) {
    console.error("保存任务设置出错:", error);
    throw error;
  }
};

/**
 * 获取任务发布页面数据
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} - 返回任务发布数据
 */
export const getTaskReleaseData = async (taskId) => {
  try {
    return await get(`/task/release/${taskId}`);
  } catch (error) {
    console.error("获取任务发布数据出错:", error);
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
    return await post(`/task/withdraw/${taskId}`);
  } catch (error) {
    console.error("撤回任务出错:", error);
    throw error;
  }
};

/**
 * 获取任务完整数据
 * @param {string} taskId - 任务ID
 * @returns {Promise<Object>} - 返回任务完整数据
 */
export const getTaskData = async (taskId) => {
  try {
    return await get(`/task/${taskId}`);
  } catch (error) {
    console.error("获取任务数据出错:", error);
    throw error;
  }
};

/**
 * 获取表格填报数据
 * @param {string} linkCode - 任务链接码
 * @returns {Promise<Object>} - 返回任务填报数据
 */
export const getTaskFillingData = async (linkCode) => {
  try {
    return await get(`/task/filling/${linkCode}`);
  } catch (error) {
    console.error("获取表格填报数据出错:", error);
    throw error;
  }
};

/**
 * 保存表格草稿
 * @param {string} linkCode - 任务链接码
 * @param {Array} tableData - 表格数据
 * @returns {Promise<Object>} - 返回保存结果
 */
export const saveDraft = async (linkCode, tableData) => {
  try {
    return await post(`/task/filling/${linkCode}/draft`, { tableData });
  } catch (error) {
    console.error("保存表格草稿出错:", error);
    throw error;
  }
};

/**
 * 提交表格数据
 * @param {string} linkCode - 任务链接码
 * @param {Array} tableData - 表格数据
 * @returns {Promise<Object>} - 返回提交结果
 */
export const submitTable = async (linkCode, tableData) => {
  try {
    return await post(`/task/filling/${linkCode}/submit`, { tableData });
  } catch (error) {
    console.error("提交表格数据出错:", error);
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
    return await post(`/task/filling/${linkCode}/withdraw`);
  } catch (error) {
    console.error("撤回表格提交出错:", error);
    throw error;
  }
};
