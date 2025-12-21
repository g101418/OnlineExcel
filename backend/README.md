# 在线表格填报工具 - 后端

## 项目简介

在线表格填报工具的后端部分，主要负责处理表格任务的创建、管理、数据存储和API接口提供等核心功能。后端采用Node.js和Express框架开发，提供了丰富的RESTful API接口，支持前端应用的各种功能需求。

### 主要功能

- 表格任务的创建、保存和管理
- 表格数据的拆分、分配和填报处理
- 数据的验证、存储和检索
- 用户权限和任务状态管理
- 日志记录和错误处理
- 安全防护和限流机制

## 技术栈

| 技术/框架 | 版本 | 用途 |
|---------|-----|------|
| Node.js | v18+ | 运行环境 |
| Express | ^5.2.1 | Web应用框架 |
| SQLite3 | ^5.1.7 | 数据库 |
| CORS | ^2.8.5 | 跨域资源共享 |
| body-parser | ^2.2.1 | 请求体解析 |
| express-rate-limit | ^8.2.1 | 接口限流 |
| Winston | ^3.19.0 | 日志管理 |
| winston-daily-rotate-file | ^5.0.0 | 日志文件轮换 |

## 项目结构

```
backend/
├── app.js                    # 应用入口文件
├── db.js                     # 数据库配置和连接
├── package.json              # 项目配置和依赖
├── controllers/              # 控制器目录
│   └── taskController.js     # 任务相关控制器
├── routes/                   # 路由目录
│   └── taskRoutes.js         # 任务相关路由
├── services/                 # 业务逻辑目录
│   └── taskService.js        # 任务相关业务逻辑
└── utils/                    # 工具函数目录
    ├── errorHandler.js       # 错误处理
    ├── logger.js             # 日志配置
    ├── rate-limit.js         # 限流配置
    ├── localhost-redirector.js # localhost重定向
    └── security-headers.js   # 安全响应头
```

## API接口说明

### 任务管理接口 (/api/task/)

| 接口地址 | 请求方法 | 功能描述 |
|---------|---------|---------|
| /task/push-full-data | POST | 接收前端推送的全量任务数据 |
| /task/get-full-data/:taskId | GET | 获取任务完整数据 |
| /task/push-delete-task/:taskId | POST | 删除任务及相关表格 |
| /task/get-full-table-filling-status/:taskId | GET | 获取任务所有表格填报状态 |
| /task/tasks | GET | 获取所有任务 |
| /task/get-task-data/:taskId | GET | 获取任务完整数据(兼容旧接口) |
| /task/get-sub-task-statuses/:taskId | GET | 获取任务所有子任务的最新状态 |

### 表格填报接口 (/api/table-filling/)

| 接口地址 | 请求方法 | 功能描述 |
|---------|---------|---------|
| /table-filling/get-table-data/:linkCode | GET | 获取拆分后表格的填报数据 |
| /table-filling/push-withdraw/:linkCode | POST | 退回填报者的信息 |
| /table-filling/get-full-data/:linkCode | GET | 获取拆分后表格的完整信息 |
| /table-filling/push-submit-data/:linkCode | POST | 提交填报的表格数据(支持暂存和提交) |
| /table-filling/save-draft/:linkCode | POST | 保存表格草稿 |
| /table-filling/restore-table-data/:linkCode | POST | 还原表格数据 |
| /table-filling/overdue_exemption/:linkCode | POST | 对子任务进行逾期豁免 |
| /table-filling/check_overdue/:linkCode | GET | 查询单个子任务的豁免情况 |

### 通用接口

| 接口地址 | 请求方法 | 功能描述 |
|---------|---------|---------|
| /check-id-exists/:id | GET | 检查ID是否存在(支持taskId和linkCode) |

## 开发与运行

### 环境要求

- Node.js v18+ 
- npm或yarn包管理工具

### 安装依赖

```bash
cd backend
npm install
```

### 启动开发服务器

```bash
npm start
```

服务器默认运行在 http://0.0.0.0:5090

### 生产环境部署

1. 确保安装了所有依赖
2. 运行启动命令

```bash
npm start
```

## 注意事项

1. 后端服务默认端口为5090，如需修改请在app.js中修改PORT变量
2. 数据库文件默认存储在项目根目录的database.db
3. 系统包含限流机制，默认配置为每分钟最多100次请求
4. 所有API接口均支持CORS跨域请求
5. 系统会自动记录操作日志，日志文件存储在logs目录
6. 接口返回数据格式统一为JSON格式

## 错误处理

系统采用统一的错误处理机制，所有API接口的错误响应格式如下：

```json
{
  "status": 400,
  "type": "VALIDATION",
  "message": "错误信息描述"
}
```

常见错误类型：
- VALIDATION: 参数验证错误
- NOT_FOUND: 资源不存在
- DATABASE: 数据库操作错误
- CONFLICT: 资源冲突
- SERVER_ERROR: 服务器内部错误

## 安全特性

- 跨域资源共享(CORS)配置
- 请求体大小限制
- 安全响应头设置
- 接口限流保护
- 详细的日志记录
