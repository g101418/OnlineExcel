const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const taskRoutes = require('./routes/taskRoutes');

const app = express();
const PORT = 3000;

// 中间件配置
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

// 引入路由
app.use('/api', taskRoutes);

// 服务器启动
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
