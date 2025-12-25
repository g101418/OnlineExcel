<template>
  <div class="task-generation-root">
    <TaskInfo title="任务生成" :showDivider="true" @task-validity-change="handleTaskValidityChange" />
    <div class="content-wrapper">
      <!-- 只有当任务有效时，才显示内容 -->
      <div v-if="isTaskValid" class="main-area">
        <div class="controls">
          <span style="margin-left: 8px"><strong>拆分方式</strong>（拆分表格给不同填报者填报）：</span>
          <el-switch v-model="splitEnabled" active-text="拆分" inactive-text="不拆分"></el-switch>

          <el-select v-if="splitEnabled" v-model="selectedHeader" placeholder="选择用于拆分的表头"
            style="width: 240px; margin-left: 12px">
            <el-option v-for="(h, idx) in uploadedHeaders" :key="idx" :label="h" :value="h" />
          </el-select>
          <el-button type="primary" :disabled="splitEnabled && !selectedHeader" @click="handleSetConditions">
            {{ splitEnabled ? '下一步' : '下一步' }}
          </el-button>
        </div>

        <div class="hot-wrap">
          <!-- <el-table v-if="hotData && hotData.length" :data="hotData" border stripe size="small" class="data-table">
            <el-table-column v-for="(h, idx) in headers" :key="idx" :prop="h" :label="h"
              :fixed="idx === 0 ? 'left' : false" min-width="120" />
          </el-table> -->
          <vxe-table border show-overflow show-header-overflow show-footer-overflow max-height="100%"
            :column-config="{ resizable: true }" :virtual-y-config="{ enabled: true, gt: 0 }" :data="hotData">
            <vxe-column v-for="(h, idx) in uploadedHeaders" :key="idx" :field="h" :title="h" min-width="120"></vxe-column>
          </vxe-table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useTaskStore, saveState } from "../stores/task";
import TaskInfo from "../components/TaskInfo.vue";
import SparkMD5 from "spark-md5";

const route = useRoute();
const router = useRouter();
const store = useTaskStore();

// 从路由query获取taskId
const taskId = computed(() => route.query.taskId as string);

// 本地变量存储当前任务数据
let currentTaskData = null;
let uploadedHeaders = [];
let uploadedData = [];
let taskFileName = '';

// 本地变量存储用户操作
const splitEnabled = ref(false);
const selectedHeader = ref('');
const hotData = ref<any[]>([]);

// 任务有效性状态（由TaskInfo组件传递）
const isTaskValid = ref(true);

// 监听taskId的变化，确保切换任务时能正确获取当前任务
watch(
  () => taskId.value,
  () => {
    if (taskId.value) {
      // 仅在taskId变化时获取一次任务数据
      const task = store.tasks.find(task => task.taskId === taskId.value);
      if (task) {
        currentTaskData = task;
        uploadedHeaders = task.uploadedHeaders || [];
        uploadedData = task.uploadedData || [];
        taskFileName = task.fileName || '';
        
        // 初始化本地操作状态
        splitEnabled.value = task.splitEnabled || false;
        selectedHeader.value = task.selectedHeader || '';
      }
    }
  },
  { immediate: true }
);

// 处理任务有效性变化
const handleTaskValidityChange = (valid: boolean) => {
  isTaskValid.value = valid;
};

onMounted(() => {
  if (currentTaskData) {
    // 设置当前进度为任务生成页面
    store.setProgress(taskId.value, 'generation');
    
    // 直接处理数据，路由参数与store的一致性已由TaskInfo组件检查
    // 将原始数据转换为表格需要的对象格式
    if (uploadedData.length > 0 && uploadedHeaders.length > 0) {
      hotData.value = uploadedData.map((row: any[]) => {
        const obj: any = {};
        uploadedHeaders.forEach((hd, idx) => {
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

const goHome = () => {
  router.push({ path: "/" });
};

const handleSetConditions = async () => {
  if (!currentTaskData) return;

  // 检查当前任务状态是否为generation
  if (currentTaskData.progress !== 'generation') {
    // 不强行修改状态，直接跳转到对应页面，由目标页面的逻辑处理
    router.push({
      path: "/task-condition",
      query: { taskId: taskId.value },
    });
    return;
  }

  // 当启用拆分时，检查选择的列是否有空白单元格
  if (splitEnabled.value && selectedHeader.value) {
    // 找到选择的列在headers中的索引
    const columnIndex = uploadedHeaders.indexOf(selectedHeader.value);
    if (columnIndex !== -1) {
      // 检查该列是否有空白单元格
      const hasEmptyCells = uploadedData.some(row => {
        const cellValue = row[columnIndex];
        return cellValue === undefined || cellValue === null || String(cellValue).trim() === '';
      });

      if (hasEmptyCells) {
        ElMessage.error(`选择的拆分列 "${selectedHeader.value}" 包含空白单元格，请确保该列所有单元格都有值`);
        return;
      }
    }
  }

  // 检查状态是否发生了变更
  const statusChanged = splitEnabled.value !== currentTaskData.splitEnabled ||
    (splitEnabled.value && selectedHeader.value !== currentTaskData.selectedHeader);

  if (statusChanged) {
    // 根据当前选择更新store状态
    if (splitEnabled.value) {
      // 执行拆分
      store.setSplitInfo(taskId.value, true, selectedHeader.value);
      store.doSplit(taskId.value);
    } else {
      // 清除拆分信息
      store.setSplitInfo(taskId.value, false, '');
    }
  }

  // 生成表格随机编码
  const generateTableCode = (table, index) => {
    const dateStr = new Date().toISOString().slice(0, 19).replace(/-/g, "").replace(/[T:]/g, "");
    const tableIdentifier = table.name || `table_${index}`;
    const metaStr = `${dateStr}:${taskId.value}:${tableIdentifier}`;
    return SparkMD5.hash(metaStr).slice(0, 28);
  };

  // 生成splitTables数据
  let splitTables = [];
  if (splitEnabled.value && selectedHeader.value) {
    // 如果启用了拆分，获取拆分后的数据
    const task = store.tasks.find(task => task.taskId === taskId.value);
    if (task && task.splitData && task.splitData.length > 0) {
      splitTables = task.splitData;
    }
  } else {
    // 未拆分的情况：使用完整数据作为一个表格
    splitTables = [{ name: taskFileName || '未拆分表格', data: uploadedData, headers: uploadedHeaders }];
  }

  // 为所有表格生成随机编码并保存到store
  const tableCodes = splitTables.map((table, index) => generateTableCode(table, index));
  // 保存到store时保留完整信息，方便前端使用
  const tableLinks = splitTables.map((table, index) => ({
    name: table.name,
    code: tableCodes[index],
    taskName: currentTaskData?.taskName || ''
  }));
  store.setTableLinks(taskId.value, tableLinks);

  // 设置进度为条件设置页面（只有在当前状态是generation时才执行）
  store.setProgress(taskId.value, 'condition');
  
  // 手动保存状态到本地存储
  await saveState(store.$state);
  
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
