<template>
  <div class="error-container">
    <div class="error-card">
      <el-icon class="error-icon"><WarningFilled /></el-icon>
      <h1 class="error-title">任务信息验证失败</h1>
      <p class="error-message">您访问的任务信息不存在或已失效，请重新创建任务。</p>
      <p class="error-timer">系统将在 {{ countdown }} 秒后自动返回首页...</p>
      <el-button type="primary" @click="goToHome" style="margin-top: 20px;">
        立即返回首页
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { WarningFilled } from '@element-plus/icons-vue';

const router = useRouter();
const countdown = ref(5);
let timer: number | null = null;

// 页面挂载时开始倒计时
onMounted(() => {
  timer = window.setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      goToHome();
    }
  }, 1000);
});

// 页面卸载时清除定时器
onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});

// 立即返回首页
const goToHome = () => {
  if (timer) {
    clearInterval(timer);
  }
  router.push('/');
};
</script>

<style scoped lang="less">
.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f5f7fa;
}

.error-card {
  text-align: center;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(16, 24, 40, 0.08);
  padding: 48px;
  max-width: 480px;
  width: 100%;
}

.error-icon {
  font-size: 72px;
  color: #f56c6c;
  margin-bottom: 20px;
}

.error-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

.error-message {
  font-size: 16px;
  color: #606266;
  margin-bottom: 8px;
}

.error-timer {
  font-size: 14px;
  color: #909399;
  margin-bottom: 24px;
}
</style>