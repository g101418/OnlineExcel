import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// ========== 核心：兼容本地/Docker的日志目录逻辑 ==========
// 1. 区分环境（开发/生产）
const isProduction = process.env.NODE_ENV === 'production';

// 2. 日志目录：本地用 process.cwd()/logs，Docker用挂载的 logs_mount 目录
const logDir = isProduction
  ? (process.env.LOG_DIR || '/app/backend/logs_mount')  // Docker部署：挂载目录
  : path.join(process.cwd(), 'logs');                   // 本地开发：保持你原有逻辑

// 3. 确保日志目录存在（复用你原有代码逻辑）
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 自定义时间戳格式（北京时间）
const timestampFormat = () => {
  return new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

// 创建基础日志实例
const baseLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: timestampFormat }),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      // 传统日志格式：[时间戳] [级别] 消息 [元数据]
      let logMessage = `[${timestamp}] [${level}] ${message}`;
      if (Object.keys(metadata).length > 0) {
        logMessage += ` ${JSON.stringify(metadata)}`;
      }
      return logMessage;
    })
  ),
  transports: [
    // 合并日志文件（按大小轮转）
    new winston.transports.File({
      filename: path.join(logDir, 'application.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// 创建包装后的logger，自动处理请求IP
const logger = {
  // 基础日志方法，支持自动提取req中的IP
  _log(level, message, metadata = {}, req = null) {
    let clientIp = '';
    // 如果metadata中包含req，或者req作为单独参数传入
    const request = req || metadata.req;
    if (request) {
      // 从请求中提取IP和其他有用信息
      clientIp = request.ip;
      metadata.path = request.path;
      metadata.method = request.method;

      // 移除req对象，避免日志过大
      if (metadata.req) delete metadata.req;
    }

    // 在消息中添加IP地址
    if (clientIp) {
      message = `[${clientIp}] ${message}`;
    }

    baseLogger[level](message, metadata);
  },

  // 扩展各个日志级别方法
  info(message, metadata = {}, req = null) {
    this._log('info', message, metadata, req);
  },

  warn(message, metadata = {}, req = null) {
    this._log('warn', message, metadata, req);
  },

  error(message, metadata = {}, req = null) {
    this._log('error', message, metadata, req);
  },

  debug(message, metadata = {}, req = null) {
    this._log('debug', message, metadata, req);
  },

  verbose(message, metadata = {}, req = null) {
    this._log('verbose', message, metadata, req);
  },

  // 保留原有的http方法
  http(message, req) {
    let clientIp = req?.ip || '';
    if (clientIp) {
      message = `[${clientIp}] ${message}`;
    }
    this.info(message, {
      path: req?.path,
      method: req?.method,
      userAgent: req?.headers['user-agent']
    });
  },

  // 暴露基础logger的level属性
  get level() {
    return baseLogger.level;
  },

  set level(newLevel) {
    baseLogger.level = newLevel;
  }
};

export default logger;