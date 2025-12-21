<template>
  <div class="error-page">
    <div class="error-content">
      <h1 class="error-code">404</h1>
      <h2 class="error-message">{{ errorMessage }}</h2>
      <p class="error-desc">{{ errorDesc }}</p>
      <el-button type="primary" size="large" @click="goHome">返回首页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { computed } from "vue";

const router = useRouter();
const route = useRoute();

// 从路由参数获取错误信息，如果没有则使用默认值
const errorMessage = computed(() => {
  return route.query.message as string || "任务不存在或已失效";
});

const errorDesc = computed(() => {
  return route.query.message as string ? `${route.query.message as string}，请返回首页重新创建任务。` : "未检测到有效的任务信息，任务ID输入错误或任务可能已经删除。";
});

const goHome = () => {
  router.push({ path: "/" });
};
</script>

<style scoped lang="less">
.error-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 72px);
  padding: 20px;
  background-color: #f5f7fa;
}

.error-content {
  text-align: center;
  background-color: #fff;
  padding: 60px 40px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
}

.error-code {
  font-size: 80px;
  font-weight: 700;
  color: #e74c3c;
  margin: 0 0 20px 0;
}

.error-message {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin: 0 0 16px 0;
}

.error-desc {
  font-size: 14px;
  color: #666;
  margin: 0 0 32px 0;
}
</style>