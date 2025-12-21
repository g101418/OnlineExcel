import rateLimit from 'express-rate-limit';

// 创建限流中间件的函数
const createRateLimiter = (maxRequests = 500) => {
  // 限流配置 - 可根据需要调整
  const RATE_LIMIT_CONFIG = {
    windowMs: 60 * 60 * 1000, // 1小时，单位毫秒
    max: maxRequests, // 每小时最多请求次数，默认500
    message: '请求过于频繁，请稍后再试', // 超过限制时的提示信息
    standardHeaders: true, // 启用标准的RateLimit-*响应头
    legacyHeaders: false, // 禁用旧版X-RateLimit-*响应头
  };

  // 创建并返回限流中间件
  return rateLimit(RATE_LIMIT_CONFIG);
};

export default createRateLimiter;
