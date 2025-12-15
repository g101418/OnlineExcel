<template>
  <div class="task-generation-root">
    <TaskInfo title="任务生成" :taskId="taskId" :fileName="fileName" :showDivider="true" @task-validity-change="handleTaskValidityChange" />
    <div class="content-wrapper">
      <!-- 只有当任务有效时，才显示内容 -->
      <div v-if="isTaskValid" class="main-area">
        <div class="controls">
          <span style="margin-left: 8px">拆分方式：</span>
          <el-switch v-model="splitEnabled" active-text="拆分" inactive-text="不拆分"></el-switch>

          <el-select v-if="splitEnabled" v-model="selectedHeader" placeholder="选择表头" style="width: 240px; margin-left: 12px">
            <el-option v-for="(h, idx) in headers" :key="idx" :label="h" :value="h" />
          </el-select>
          <el-button type="primary" :disabled="splitEnabled && !selectedHeader" @click="handleSetConditions">
            {{ splitEnabled ? '拆分并设定条件' : '设定条件' }}
          </el-button>
        </div>

        <div class="hot-wrap">
          <el-table v-if="hotData && hotData.length" :data="hotData" border stripe size="small" class="data-table">
            <el-table-column v-for="(h, idx) in headers" :key="idx" :prop="h" :label="h"
              :fixed="idx === 0 ? 'left' : false" min-width="120" />
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useTaskStore } from "../stores/task";
import TaskInfo from "../components/TaskInfo.vue";

const route = useRoute();
const router = useRouter();
const store = useTaskStore();

// 从store获取当前任务
const currentTask = computed(() => store.currentTask);

// 从当前任务获取数据
const taskId = computed(() => currentTask.value?.taskId || '');
const fileName = computed(() => currentTask.value?.fileName || '');
const headers = computed(() => currentTask.value?.uploadedHeaders || []);
const rawData = computed(() => currentTask.value?.uploadedData || []);
const hotData = ref<any[]>([]);
const splitEnabled = ref(currentTask.value?.splitEnabled || false);
const selectedHeader = ref(currentTask.value?.selectedHeader || '');

// 监听当前任务变化，更新本地状态
watch(
  () => currentTask.value,
  (newTask) => {
    if (newTask) {
      splitEnabled.value = newTask.splitEnabled || false;
      selectedHeader.value = newTask.selectedHeader || '';
    }
  },
  { immediate: true, deep: true }
);
// 任务有效性状态（由TaskInfo组件传递）
const isTaskValid = ref(true);

// 处理任务有效性变化
const handleTaskValidityChange = (valid: boolean) => {
  isTaskValid.value = valid;
};

onMounted(async () => {
  if (currentTask.value) {
    // 设置当前进度为任务生成页面
    store.setProgress('generation');
    // 直接处理数据，路由参数与store的一致性已由TaskInfo组件检查
    // 将原始数据转换为表格需要的对象格式
    if (rawData.value && rawData.value.length && headers.value.length) {
      hotData.value = rawData.value.map((row: any[]) => {
        const obj: any = {};
        headers.value.forEach((hd, idx) => {
          obj[hd] = row[idx] !== undefined && row[idx] !== null ? row[idx] : "";
        });
        return obj;
      });
    }
  }
});

onBeforeUnmount(() => {
  // 保持空
});

// 监听路由参数变化，手动修改URL时更新页面
watch(
  () => route.query,
  (newQuery) => {
    // 当路由参数变化时，重新处理数据
    // 路由参数与store的一致性已由TaskInfo组件检查
    if (rawData.value && rawData.value.length && headers.value.length) {
      hotData.value = rawData.value.map((row: any[]) => {
        const obj: any = {};
        headers.value.forEach((hd, idx) => {
          obj[hd] = row[idx] !== undefined && row[idx] !== null ? row[idx] : "";
        });
        return obj;
      });
    } else {
      hotData.value = [];
    }
  },
  { deep: true }
);

const goHome = () => {
  router.push({ path: "/" });
};

const handleSetConditions = () => {
  if (!currentTask.value) return;
  
  // 检查状态是否发生了变更
  const statusChanged = splitEnabled.value !== currentTask.value.splitEnabled || 
                       (splitEnabled.value && selectedHeader.value !== currentTask.value.selectedHeader);

  if (statusChanged) {
    // 根据当前选择更新store状态
    if (splitEnabled.value) {
      // 执行拆分
      store.setSplitInfo(true, selectedHeader.value);
      store.doSplit();
    } else {
      // 清除拆分信息
      store.setSplitInfo(false, '');
    }
  }

  // 设置进度为条件设置页面
  store.setProgress('condition');
  router.push({
    path: "/task-condition",
    query: { taskId: taskId.value },
  });
};
</script>

<style scoped lang="less">
/* 保持纯 CSS Flex 布局和 box-sizing 的修复 */
.task-generation-root {
  padding: 20px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 72px);
  box-sizing: border-box;
  padding-bottom: 30px;
}

.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}



.main-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex: 0 0 auto;
}

.hot-wrap {
  border: 1px solid #e6e6e6;
  border-radius: 6px;
  padding: 8px;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  flex: 1 1 auto;
  box-sizing: border-box;
  min-height: 0;
}

.data-table {
  width: 100% !important;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* el-table 内部 Flex 规则 */
.hot-wrap ::v-deep(.el-table__header-wrapper) {
  flex: 0 0 auto;
}

.hot-wrap ::v-deep(.el-table__body-wrapper) {
  overflow: auto;
  flex: 1 1 auto;
  min-height: 0;
}

/* 🚀 核心修改：表头样式 (深灰色背景，加粗字体) */
.hot-wrap ::v-deep(.el-table__header-wrapper th .cell),
.hot-wrap ::v-deep(.el-table__header-wrapper th) {
  /* 调整背景色为深灰色 */
  background-color: #f0f0f0 !important;
  color: #000000 !important;
  font-weight: 700 !important;
  /* 字体加粗 */
}

/* 确保固定列的样式和主表格同步 */
.hot-wrap ::v-deep(.el-table__fixed),
.hot-wrap ::v-deep(.el-table__fixed-right) {
  height: 100% !important;
  overflow: hidden;
  box-shadow: 4px 0 6px -3px rgba(0, 0, 0, 0.1);
}

.hot-wrap ::v-deep(.el-table__fixed-body-wrapper) {
  overflow: hidden !important;
}

.hot-wrap ::v-deep(.el-table__fixed .el-table__header-wrapper th .cell),
.hot-wrap ::v-deep(.el-table__fixed .el-table__header-wrapper th) {
  /* 确保固定列表头使用相同的深灰色背景 */
  background-color: #606060 !important;
}

/* 覆盖固定列表格的斑马纹背景，与主表格保持同步 */
.hot-wrap ::v-deep(.el-table__fixed .el-table__body tr.el-table__row:nth-child(odd) td) {
  background-color: #ffffff;
}

.hot-wrap ::v-deep(.el-table__fixed .el-table__body tr.el-table__row:nth-child(even) td) {
  background-color: #f6f8ff;
}

.hot-wrap ::v-deep(.el-table__header-wrapper table),
.hot-wrap ::v-deep(.el-table__body-wrapper table) {
  width: 100% !important;
  table-layout: auto !important;
}

.hot-wrap ::v-deep(.el-table__header-wrapper table th),
.hot-wrap ::v-deep(.el-table__body-wrapper table td) {
  min-width: 120px;
}

.no-data {
  display: flex;
  flex-direction: column;
  gap: 12px;
}



::v-deep(.el-divider) {
  /* 默认值通常是 margin: 24px 0; */
  margin-top: 5px !important;
  /* 缩小上边距 */
  margin-bottom: 10px !important;
  /* 缩小下边距 */
}
</style>
