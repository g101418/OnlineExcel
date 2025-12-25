# 基础镜像：Node.js 20 轻量版
FROM node:20-alpine

# 设置容器内工作目录（对应你的backend目录）
WORKDIR /app/backend

# 安装系统依赖（sqlite、编译工具等）
RUN apk add --no-cache python3 python3-dev py3-setuptools make g++ git libc6-compat sqlite

# 核心：创建挂载目录（数据库+日志），用于映射宿主机路径
RUN mkdir -p /app/backend/db_mount
RUN mkdir -p /app/backend/logs_mount

# 复制backend下的所有代码（逐个复制，避免遗漏/误复制）
# 复制后端代码和依赖文件
COPY backend/package*.json ./
COPY backend/app.js ./
COPY backend/db.js ./
COPY backend/controllers/ ./controllers/
COPY backend/routes/ ./routes/
COPY backend/services/ ./services/
COPY backend/utils/ ./utils/
COPY backend/dist/ ./dist/

# 安装项目依赖（仅生产环境）
RUN npm install --only=production

# 环境变量：修正为日志目录（核心！）
ENV NODE_ENV=production
ENV PORT=5090
# 数据库路径（文件）
ENV DB_PATH=/app/backend/db_mount/task.db
# 日志目录（不再是单个文件）
ENV LOG_DIR=/app/backend/logs_mount

# 暴露端口
EXPOSE 5090

# 启动应用
CMD ["node", "app.js"]