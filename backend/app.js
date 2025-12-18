const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const taskRoutes = require('./routes/taskRoutes');

const app = express();
const PORT = 3000;

// 限流配置 - 可根据需要调整
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 60 * 1000, // 1小时，单位毫秒
  max: 300, // 每小时最多请求次数
  message: '请求过于频繁，请稍后再试', // 超过限制时的提示信息
  standardHeaders: true, // 启用标准的RateLimit-*响应头
  legacyHeaders: false, // 禁用旧版X-RateLimit-*响应头
};

// 创建限流中间件
const limiter = rateLimit(RATE_LIMIT_CONFIG);

// 中间件配置
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

// 应用限流中间件
app.use(limiter);

// 引入路由
app.use('/api', taskRoutes);

// 服务器启动
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
