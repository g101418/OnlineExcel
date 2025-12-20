const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const limiter = require('./utils/rate-limit');
const redirectLocalhost = require('./utils/localhost-redirector');
const securityHeaders = require('./utils/security-headers');

const path = require('path');
const os = require('os');

const taskRoutes = require('./routes/taskRoutes');

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
