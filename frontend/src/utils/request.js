// 通用HTTP请求工具

// 获取API基础URL
const getApiBaseUrl = () => {
  const currentUrl = window.location.href;
  const urlObj = new URL(currentUrl);
  return `${urlObj.protocol}//${urlObj.hostname}:3000/api`;
};

// API基础URL
const API_BASE_URL = getApiBaseUrl();

/**
 * 通用请求方法
 * @param {string} url - 请求路径
 * @param {Object} options - 请求选项
 * @returns {Promise<Object>} - 返回请求结果
 */
export const request = async (url, options = {}) => {
  try {
    // 构建完整请求URL
    const fullUrl = `${API_BASE_URL}${url}`;
    
    // 默认请求选项
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    // 合并请求选项
    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };
    
    // 发送请求
    const response = await fetch(fullUrl, mergedOptions);
    
    // 解析响应数据
    const data = await response.json();
    
    // 检查请求是否成功
    if (!response.ok) {
      const error = new Error(`请求失败: ${response.status}`);
      error.response = { status: response.status, data };
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('请求出错:', error);
    throw error;
  }
};

/**
 * GET请求方法
 * @param {string} url - 请求路径
 * @param {Object} params - 请求参数
 * @returns {Promise<Object>} - 返回请求结果
 */
export const get = async (url, params = {}) => {
  // 构建查询参数
  const queryParams = new URLSearchParams(params).toString();
  const fullUrl = queryParams ? `${url}?${queryParams}` : url;
  
  return request(fullUrl, { method: 'GET' });
};

/**
 * POST请求方法
 * @param {string} url - 请求路径
 * @param {Object} data - 请求数据
 * @returns {Promise<Object>} - 返回请求结果
 */
export const post = async (url, data = {}) => {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * PUT请求方法
 * @param {string} url - 请求路径
 * @param {Object} data - 请求数据
 * @returns {Promise<Object>} - 返回请求结果
 */
export const put = async (url, data = {}) => {
  return request(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * DELETE请求方法
 * @param {string} url - 请求路径
 * @returns {Promise<Object>} - 返回请求结果
 */
export const del = async (url) => {
  return request(url, { method: 'DELETE' });
};

// 导出API基础URL
export { API_BASE_URL };
