# 使用官方Node.js 20镜像作为基础
FROM node:20-alpine

# 设置工作目录
WORKDIR /app/backend

# 安装系统依赖
RUN apk add --no-cache python3 python3-dev py3-setuptools make g++ git libc6-compat sqlite

# 复制后端代码和依赖文件
COPY backend/package*.json ./
COPY backend/app.js ./
COPY backend/db.js ./
COPY backend/controllers/ ./controllers/
COPY backend/routes/ ./routes/
COPY backend/services/ ./services/
COPY backend/utils/ ./utils/
COPY backend/dist/ ./dist/

# 安装依赖
RUN npm install --only=production

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=5090

# 暴露端口
EXPOSE 5090

# 启动应用
CMD ["node", "app.js"]