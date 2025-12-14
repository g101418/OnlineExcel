// 任务相关API

// 模拟API请求的基础URL
// const API_BASE_URL = 'http://localhost:3000/api';

const currentUrl = window.location.href;

// 方法1：通用解析方法（推荐，适配所有URL格式）
function getPartBeforePort(url) {
  // 创建URL对象解析（自动处理协议、域名、端口等）
  const urlObj = new URL(url);
  // 拼接协议和主机名（端口前的核心部分）
  const partBeforePort = `${urlObj.protocol}//${urlObj.hostname}`;
  return partBeforePort;
}

const API_BASE_URL = getPartBeforePort(currentUrl) + ':3000/api'

/**
 * 保存任务条件设置
 * @param {Object} taskData - 任务数据
 * @returns {Promise<Object>} - 返回保存结果
 */
export const saveTaskSettings = async (taskData) => {
  try {
    // TODO: 实际项目中应替换为真实的API调用
    const response = await fetch(`${API_BASE_URL}/save-task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      throw new Error("保存任务设置失败");
    }

    return await response.json();
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
    // TODO: 实际项目中应替换为真实的API调用
    const response = await fetch(`${API_BASE_URL}/task/release/${taskId}`);

    if (!response.ok) {
      throw new Error("获取任务发布数据失败");
    }

    return await response.json();
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
    // TODO: 实际项目中应替换为真实的API调用
    const response = await fetch(`${API_BASE_URL}/task/withdraw/${taskId}`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("撤回任务失败");
    }

    return await response.json();
  } catch (error) {
    console.error("撤回任务出错:", error);
    throw error;
  }
};
