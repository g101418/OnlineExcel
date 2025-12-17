<template>
  <div class="task-release-root">
    <TaskInfo title="发布任务" />
    
    <!-- 显示表格列表 -->
    <div v-if="isTaskValid && splitTables.length > 0" class="tables-container">
      <div class="table-header">
        <h3>表格列表</h3>
        <div class="header-buttons">
          <el-button type="primary" @click="exportAllLinks">一键导出链接</el-button>
          <el-button type="danger" @click="goToTaskCondition">撤回任务并返回条件设置</el-button>
        </div>
      </div>
      
      <el-table :data="splitTablesWithLinks" style="width: 100%">
        <el-table-column prop="name" label="表格名称" width="200" />
        <el-table-column prop="rowCount" label="行数" width="100" />
        <el-table-column label="链接" min-width="200">
          <template #default="scope">
            <el-tooltip content="点击复制链接" placement="top">
              <span class="copy-clickable" @click="copyLink(scope.row.code)">{{ shortenLink(scope.row.code) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.status === '已上传'" type="success">{{ scope.row.status }}</el-tag>
            <el-tag v-else-if="scope.row.status === '已退回'" type="info">{{ scope.row.status }}</el-tag>
            <el-tag v-else type="danger">{{ scope.row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button 
              v-if="scope.row.status === '已上传'" 
              type="primary" 
              size="small" 
              @click="viewTable(scope.row)"
            >
              查看
            </el-button>
            <el-button 
              v-if="scope.row.status === '已上传'" 
              type="warning" 
              size="small" 
              @click="rejectTable(scope.row)"
            >
              退回
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { ref, computed, onMounted } from "vue";
import { ElMessage } from "element-plus";
import TaskInfo from "../components/TaskInfo.vue";
import { useTaskStore } from "../stores/task";
// 导入API
import { getTaskReleaseData, getTaskData } from "../api/task";

const router = useRouter();
const route = useRoute();
const store = useTaskStore();

// 从路由query获取taskId
const taskId = computed(() => route.query.taskId as string);
// 从store获取当前任务数据
const currentTask = computed(() => store.tasks.find(task => task.taskId === taskId.value));
const fileName = computed(() => currentTask.value?.fileName || '');
const taskName = computed(() => currentTask.value?.taskName || '');
const split = computed(() => currentTask.value?.split || false);
const header = computed(() => currentTask.value?.header || '');
const splitData = computed(() => currentTask.value?.splitData || []);

// 任务有效性检查
const isTaskValid = computed(() => {
  if (!route.query.taskId) return false;
  
  // 检查本地store中是否存在该taskId的任务
  const taskExists = store.tasks.some(task => task.taskId === route.query.taskId);
  return taskExists;
});

// 拆分表格相关数据
const splitTables = ref([]);
const loading = ref(false);

// 计算属性：为表格添加链接和状态（从服务端获取）
const splitTablesWithLinks = computed(() => {
  return splitTables.value;
});

// 链接简写函数：简化显示的链接，保持复制使用完整链接
const shortenLink = (code) => {
  if (!code) return '';
  return `http://...link=${code}`;
};

// 复制链接
const copyLink = async (code) => {
  const fullLink = `${window.location.origin}/table-filling?link=${code}`;
  try {
    await navigator.clipboard.writeText(fullLink);
    ElMessage.success({
      message: "链接已成功复制到剪贴板！",
      duration: 1000,
    });
  } catch (err) {
    // 兼容方案
    const textarea = document.createElement("textarea");
    textarea.value = fullLink;
    textarea.style.position = "fixed";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const success = document.execCommand("copy");
      if (success) {
        ElMessage.success({
          message: "链接已成功复制到剪贴板！",
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

// 一键导出所有链接
const exportAllLinks = async () => {
  const linksText = splitTablesWithLinks.value.map(table => {
    const fullLink = `${window.location.origin}/process-table?link=${table.code}`;
    return `${table.name}\t${fullLink}`;
  }).join("\n");
  
  try {
    await navigator.clipboard.writeText(linksText);
    ElMessage.success({
      message: "所有链接已成功导出到剪贴板！",
      duration: 1000,
    });
  } catch (err) {
    // 兼容方案
    const textarea = document.createElement("textarea");
    textarea.value = linksText;
    textarea.style.position = "fixed";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const success = document.execCommand("copy");
      if (success) {
        ElMessage.success({
          message: "所有链接已成功导出到剪贴板！",
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

// 返回条件设置页面（将任务从发布状态撤回至条件设置状态）
const goToTaskCondition = async () => {
  try {
    // 调用API获取最新任务数据并更新Pinia store
    const taskData = await getTaskData(taskId.value);
    // 更新当前任务的信息
    store.setUploadedData(taskId.value, taskData.uploadedHeaders, taskData.uploadedData);
    store.setSplitInfo(taskId.value, taskData.splitEnabled, taskData.selectedHeader);
    // 更新其他必要的任务信息
    if (taskData.taskName) store.setTaskName(taskId.value, taskData.taskName);
    if (taskData.taskDeadline) store.setTaskDeadline(taskId.value, taskData.taskDeadline);
    
    // 设置进度为条件设置页面
    store.setProgress(taskId.value, 'condition');
    
    // 导航到条件设置页面
    router.push({
      path: "/task-condition",
      query: { taskId: taskId.value }
    });
    
    ElMessage.success("任务已撤回并返回条件设置页面");
  } catch (error) {
    console.error("返回条件设置页面失败:", error);
    ElMessage.error("返回条件设置页面失败，请稍后重试");
  }
};

// 查看表格详情（TODO: 后期需要实现从后端获取数据并展示详情）
const viewTable = (table) => {
  // TODO: 此功能需要从后端获取表格的详情数据
  // TODO: 需要实现表格详情展示的对话框或页面
  console.log("查看表格详情:", table);
  ElMessage.info("查看功能尚未实现，后期将从后端获取数据");
};

// 退回表格（TODO: 后期需要实现退回的后端逻辑）
const rejectTable = (table) => {
  // TODO: 此功能需要调用后端API来实现表格的退回操作
  // TODO: 需要处理退回后的状态更新和用户反馈
  console.log("退回表格:", table);
  table.status = '已退回'; // 更新状态为已退回
  ElMessage.info("表格已退回，状态已更新为已退回");
};

// 获取拆分表格数据（从服务端获取）
const fetchSplitTables = async () => {
  try {
    loading.value = true;
    
    // 只有当任务有效时才调用API
    if (!isTaskValid.value) {
      splitTables.value = [];
      return;
    }
    
    // 调用API从服务端获取数据，使用query中的taskId
    const response = await getTaskReleaseData(route.query.taskId as string);
    
    // 转换后端返回的数据结构为前端需要的格式
    if (response && response.splitData) {
      // 确保tableLinks存在且为数组
      const tableLinks = response.tableLinks || [];
      
      // 转换splitData为前端需要的表格格式
      splitTables.value = response.splitData.map((table, index) => {
        // 获取对应索引的链接码，如果没有则使用空字符串
        const linkCode = tableLinks[index] || '';
        
        return {
          id: index + 1,
          name: table.sheetName || `表格${index + 1}`,
          rowCount: table.data ? table.data.length : 0,
          code: linkCode,
          status: '未上传',
          originalData: table
        };
      });
    } else {
      splitTables.value = [];
    }
  } catch (error) {
    console.error("获取拆分表格数据失败:", error);
    splitTables.value = []; // 出错时设为空数组
    // 只有当任务有效时才显示错误信息
    if (isTaskValid.value) {
      ElMessage.error("获取表格数据失败，请稍后重试");
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  // 根据路由query中的taskId设置当前任务
  if (taskId.value) {
    // 设置进度为任务发布页面
    store.setProgress(taskId.value, 'release');
  }
  
  // 初始化表格数据
  fetchSplitTables();
});
</script>

<style scoped lang="less">
.task-release-root {
  padding: 10px;
}

.tables-container {
  margin-top: 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.table-header h3 {
  margin: 0;
}

.header-buttons {
  display: flex;
  gap: 10px;
}

.copy-clickable {
  cursor: pointer;
  color: #409eff;
  &:hover {
    text-decoration: underline;
  }
}
</style>