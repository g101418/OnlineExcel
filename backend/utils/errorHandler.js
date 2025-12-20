import logger from './logger.js';

// 错误类型枚举
const ERROR_TYPES = {
  DATABASE: 'database',
  VALIDATION: 'validation',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  SERVER_ERROR: 'server_error'
};

// 敏感错误关键词列表
const SENSITIVE_KEYWORDS = [
  'sqlite',
  'database',
  'table',
  'column',
  'sql',
  'query',
  'syntax',
  'constraint',
  'foreign key',
  'primary key'
];

// 检查错误信息是否包含敏感内容
const isSensitiveError = (errorMessage) => {
  if (!errorMessage) return false;
  const lowerMessage = errorMessage.toLowerCase();
  return SENSITIVE_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
};

// 创建标准化错误对象
const createError = (type, message, originalError = null) => {
  const error = new Error(message);
  error.type = type;
  error.originalError = originalError;
  return error;
};

// 获取错误对应的HTTP状态码
const getStatusCode = (errorType) => {
  switch (errorType) {
    case ERROR_TYPES.VALIDATION:
      return 400;
    case ERROR_TYPES.UNAUTHORIZED:
      return 401;
    case ERROR_TYPES.FORBIDDEN:
      return 403;
    case ERROR_TYPES.NOT_FOUND:
      return 404;
    case ERROR_TYPES.CONFLICT:
      return 409;
    case ERROR_TYPES.DATABASE:
    case ERROR_TYPES.SERVER_ERROR:
    default:
      return 500;
  }
};

// 格式化错误响应
const formatErrorResponse = (error) => {
  // 确保错误对象格式正确
  if (!(error instanceof Error)) {
    error = createError(ERROR_TYPES.SERVER_ERROR, '未知错误');
  }

  // 过滤敏感错误信息
  const safeMessage = isSensitiveError(error.message) 
    ? '服务器内部错误' 
    : error.message;

  // 获取状态码
  const statusCode = getStatusCode(error.type || ERROR_TYPES.SERVER_ERROR);

  // 构建统一格式的错误响应
  const response = {
    error: safeMessage,
    timestamp: new Date().toISOString()
  };

  return { statusCode, response };
};

// 全局错误处理中间件
const errorHandler = (err, req, res, next) => {
  // 记录原始错误信息到服务器日志（便于调试）
  logger.error('Server Error:', {
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack
  });

  // 格式化错误响应
  const { statusCode, response } = formatErrorResponse(err);

  // 返回统一格式的错误响应
  res.status(statusCode).json(response);
};

export {
  ERROR_TYPES,
  createError,
  errorHandler,
  formatErrorResponse
};