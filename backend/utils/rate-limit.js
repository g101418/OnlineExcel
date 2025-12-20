const rateLimit = require('express-rate-limit');

// 限流配置 - 可根据需要调整
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 60 * 1000, // 1小时，单位毫秒
  max: 500, // 每小时最多请求次数
  message: '请求过于频繁，请稍后再试', // 超过限制时的提示信息
  standardHeaders: true, // 启用标准的RateLimit-*响应头
  legacyHeaders: false, // 禁用旧版X-RateLimit-*响应头
};

// 创建限流中间件
const limiter = rateLimit(RATE_LIMIT_CONFIG);

module.exports = limiter;
