import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import rateLimiter from './utils/rate-limit.js';
import redirectLocalhost from './utils/localhost-redirector.js';
import securityHeaders from './utils/security-headers.js';
import { errorHandler } from './utils/errorHandler.js';
import logger from './utils/logger.js';

import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import taskRoutes from './routes/taskRoutes.js';

const app = express();
const PORT = 5090;


// // 重定向localhost请求到实际IP地址
// app.use(redirectLocalhost);



// 中间件配置
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

// 添加安全响应头中间件
app.use(securityHeaders);

// 应用限流中间件
app.use(rateLimiter);

// 静态文件服务 - 提供前端打包后的文件
app.use(express.static(path.join(__dirname, './dist')));

// 引入路由
app.use('/api', taskRoutes);

// 处理前端路由的历史模式刷新问题
app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, './dist/index.html'));
});

// 全局错误处理中间件
app.use(errorHandler);

// 服务器启动
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server is running on http://0.0.0.0:${PORT}`);
});
