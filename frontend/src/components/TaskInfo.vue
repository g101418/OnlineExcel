<template>
  <div class="task-info">
    <!-- 严格检查路由query和store的一致性 -->
    <div v-if="!route.query.taskId || (route.query.taskId && route.query.taskId !== store.taskId)" class="no-data">
      <p>未检测到任务信息，请返回首页重新上传。</p>
      <el-button type="primary" @click="goHome">返回首页</el-button>
    </div>
    <div v-else>
      <component :is="headingLevel" class="task-title">{{ title }}</component>
      <div class="meta">
        <p>
          <strong>任务编号：</strong>
          <el-tooltip content="点击复制任务编号" placement="top">
            <span class="copy-clickable" @click="copyTaskId(taskId)">{{ taskId }}</span>
          </el-tooltip>
        </p>
        <p v-if="fileName"><strong>文件名：</strong>{{ fileName }}</p>
      </div>
      <el-divider v-if="showDivider" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { useRoute, useRouter } from "vue-router";
import { useTaskStore } from "../stores/task";

// 定义组件属性
interface Props {
  title: string;         // 任务标题
  taskId: string;        // 任务编号
  fileName?: string;     // 文件名（可选）
  showDivider?: boolean; // 是否显示分隔线（可选，默认true）
  headingLevel?: 'h1' | 'h2'; // 标题级别（可选，默认h2）
}

// 使用withDefaults设置默认值
const props = withDefaults(defineProps<Props>(), {
  showDivider: true,
  headingLevel: 'h2'
});

// 定义组件事件
const emit = defineEmits<{
  (e: 'task-validity-change', isValid: boolean): void;
}>();

// 路由和store
const route = useRoute();
const router = useRouter();
const store = useTaskStore();

// 计算属性：标题级别
const headingLevel = computed(() => props.headingLevel);

// 计算属性：检查路由query和store是否一致
const isTaskValid = computed(() => {
  return !!route.query.taskId && route.query.taskId === store.taskId;
});

// 监听路由变化，通知父组件任务有效性变化
watch(
  () => [route.query.taskId, store.taskId],
  () => {
    emit('task-validity-change', isTaskValid.value);
  },
  { deep: true }
);

// 组件挂载时初始化任务有效性状态
onMounted(() => {
  emit('task-validity-change', isTaskValid.value);
});

// 复制任务编号功能
const copyTaskId = async (textToCopy: string) => {
  if (!textToCopy) return;

  try {
    // 优先使用 Clipboard API (现代浏览器)
    await navigator.clipboard.writeText(textToCopy);
    ElMessage.success({
      message: "任务编号已成功复制到剪贴板！",
      duration: 1000,
    });
  } catch (err) {
    // 兼容方案: 使用 document.execCommand (旧版浏览器)
    const textarea = document.createElement("textarea");
    textarea.value = textToCopy;
    textarea.style.position = "fixed"; // 防止屏幕滚动
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const success = document.execCommand("copy");
      if (success) {
        ElMessage.success({
          message: "任务编号已成功复制到剪贴板！",
          duration: 1000,
        });
      } else {
        throw new Error("execCommand failed");
      }
    } finally {
      document.body.removeChild(textarea);
    }
  }
};

// 返回首页方法
const goHome = () => router.push({ path: "/" });
</script>

<style scoped lang="less">
.task-info {
  .task-title {
    margin-bottom: 16px;
    font-size: 20px;
    font-weight: 600;
    color: #333;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    margin-bottom: 16px;
    p {
      margin: 0;
      font-size: 14px;
      .copy-clickable {
        cursor: pointer;
        color: #409eff;
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
  .no-data {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 20px 0;
    p {
      font-size: 16px;
      color: #606266;
    }
  }
}
</style>