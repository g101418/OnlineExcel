const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const taskRoutes = require('./routes/taskRoutes');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 5090;

// // 获取服务器的实际IP地址
// function getServerIp() {
//   const interfaces = os.networkInterfaces();
//   for (const name of Object.keys(interfaces)) {
//     for (const iface of interfaces[name]) {
//       if (iface.family === 'IPv4' && !iface.internal) {
//         return iface.address;
//       }
//     }
//   }
//   return '127.0.0.1'; // 回退到本地地址
// }

// const SERVER_IP = getServerIp();
// console.log(`Server IP address: ${SERVER_IP}`);

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

// 重定向localhost请求到实际IP地址
// app.use((req, res, next) => {
//   const host = req.headers.host;
//   if (host && host.includes('localhost')) {
//     const protocol = req.secure ? 'https' : 'http';
//     const path = req.originalUrl;
//     const redirectUrl = `${protocol}://${SERVER_IP}:${PORT}${path}`;
//     return res.redirect(301, redirectUrl);
//   }
//   next();
// });

// 中间件配置
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

// 应用限流中间件
app.use(limiter);

// 静态文件服务 - 提供前端打包后的文件
app.use(express.static(path.join(__dirname, './dist')));

// 引入路由
app.use('/api', taskRoutes);

// 处理前端路由的历史模式刷新问题
app.get(/^(?!\/api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, './dist/index.html'));
});

// 服务器启动
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
