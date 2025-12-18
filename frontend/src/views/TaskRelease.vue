<template>
  <div class="task-release-root">
    <TaskInfo title="发布任务" />
    
    <!-- 显示表格列表 -->
    <div v-if="isTaskValid && splitTables.length > 0" class="tables-container">
      <div class="table-header">
        <div class="title-container">
          <h3>表格列表</h3>
          <div class="status-info">
            <el-tag v-if="currentTask?.status === 'draft'" type="success">进行中</el-tag>
            <el-tag v-else type="danger">已超期</el-tag>
            <span v-if="currentTask?.taskDeadline" class="deadline">截止时间: {{ formatDate(currentTask?.taskDeadline) }}</span>
          </div>
        </div>
        <div class="header-buttons">
          <el-button type="primary" @click="exportAllLinks">一键导出链接</el-button>
          <el-button :disabled="!hasSubmittedTables" @click="exportAllTables">汇总导出数据</el-button>
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

        <el-table-column label="操作" width="250">
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
            <el-button 
              v-if="scope.row.taskStatus === 'overdue' && !scope.row.overduePermission" 
              type="warning" 
              size="small"
              @click="exemptSubTask(scope.row)"
            >
              逾期豁免
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    
    <!-- 表格数据查看对话框 -->
    <el-dialog
      v-model="tableDataDialogVisible"
      title="表格数据"
      width="80%"
    >
      <div v-if="tableDataLoading" class="dialog-loading">
        <el-icon :size="48" class="loading-icon">
          <Loading />
        </el-icon>
        <div>加载中...</div>
      </div>
      <el-table v-else-if="tableData && tableData.table_data && tableData.table_data.length > 0" :data="tableData.table_data" style="width: 100%">
        <el-table-column 
          v-for="(column, index) in tableHeaders" 
          :key="index" 
          :prop="'col' + index" 
          :label="column" 
        />
      </el-table>
      <div v-else-if="!tableDataLoading && (!tableData || !tableData.table_data || tableData.table_data.length === 0)" class="no-data">
        该表格没有数据
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="tableDataDialogVisible = false">关闭</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { ref, computed, onMounted } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import { Loading } from "@element-plus/icons-vue";
import TaskInfo from "../components/TaskInfo.vue";
import { useTaskStore, saveState } from "../stores/task";
import * as XLSX from "xlsx";
// 导入API
import { getTaskReleaseData, getTaskData, deleteTask, getSubTaskStatuses, getTableData, withdrawTable, overdueExemption, checkTaskOverdue, checkSubTaskOverdue } from "../api/task";

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
const isTaskValid = ref(true);

// 拆分表格相关数据
const splitTables = ref([]);
const loading = ref(false);

// 计算属性：为表格添加链接和状态（从服务端获取）
const splitTablesWithLinks = computed(() => {
  return splitTables.value;
});

// 计算属性：检查是否有已提交的表格
const hasSubmittedTables = computed(() => {
  return splitTables.value.some(table => table.status === '已上传');
});

// 表格数据查看相关变量
const tableDataDialogVisible = ref(false);
const tableData = ref(null);
const tableDataLoading = ref(false);
const tableHeaders = ref([]);

// 链接简写函数：简化显示的链接，保持复制使用完整链接
const shortenLink = (code) => {
  if (!code) return '';
  return `http://...link=${code}`;
};

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
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
    const fullLink = `${window.location.origin}/table-filling?link=${table.code}`;
    return `${table.name}	${fullLink}`;
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
    // 根据用户要求，task任务只有删除delete，没有撤回
    // 先调用API删除任务及相关子任务
    await deleteTask(taskId.value);
    
    // 设置进度为条件设置页面
    store.setProgress(taskId.value, 'condition');
    
    // 导航到条件设置页面
    router.push({
      path: "/task-condition",
      query: { taskId: taskId.value }
    });
    
    ElMessage.success("任务已删除并返回条件设置页面");
  } catch (error) {
    console.error("返回条件设置页面失败:", error);
    
    // 检查错误信息，如果任务已删除或不存在，仍允许跳转
    if (error.response?.status === 404 || error.message.includes('不存在') || error.message.includes('not found')) {
      // 设置进度为条件设置页面
      store.setProgress(taskId.value, 'condition');
      
      // 导航到条件设置页面
      router.push({
        path: "/task-condition",
        query: { taskId: taskId.value }
      });
      
      ElMessage.success("任务已删除并返回条件设置页面");
    } else {
      ElMessage.error("返回条件设置页面失败，请稍后重试");
    }
  }
};

// 查看表格详情
const viewTable = async (table) => {
  tableDataLoading.value = true;
  tableDataDialogVisible.value = true;
  try {
    const response = await getTableData(table.code);
    // 将二维数组转换为对象数组，以便el-table正确渲染
    const tableDataArray = response.table_data.map(row => {
      const rowObj = {};
      row.forEach((cell, index) => {
        rowObj["col" + index] = cell;
      });
      return rowObj;
    });
    tableData.value = {
      ...response,
      table_data: tableDataArray
    };
    // 使用当前任务的uploadedHeaders作为表头
    tableHeaders.value = currentTask.value?.uploadedHeaders || [];
  } catch (error) {
    console.error("获取表格数据失败:", error);
    ElMessage.error("获取表格数据失败，请稍后重试");
  } finally {
    tableDataLoading.value = false;
  }
};

// 退回表格
const rejectTable = async (table) => {
  try {
    await withdrawTable(table.code);
    table.status = '已退回';
    ElMessage.success("表格已退回");
  } catch (error) {
    console.error("退回表格失败:", error);
    ElMessage.error("退回表格失败，请稍后重试");
  }
};

// 逾期豁免
const exemptSubTask = async (table) => {
  try {
    await overdueExemption(table.code);
    // 更新本地表格数据的豁免状态
    table.overduePermission = true;
    ElMessage.success("已豁免该子任务");
  } catch (error) {
    console.error("逾期豁免失败:", error);
    ElMessage.error("逾期豁免失败，请稍后重试");
  }
};

// 汇总导出所有已提交的表格数据
const exportAllTables = async () => {
  try {
    // 获取所有已提交的表格
    const submittedTables = splitTables.value.filter(table => table.status === '已上传');
    
    if (submittedTables.length === 0) {
      ElMessage.warning("没有已提交的表格可以导出");
      return;
    }
    
    // 显示加载状态
    const loading = ElLoading.service({
      lock: true,
      text: '正在汇总导出数据，请稍候...',
      background: 'rgba(0, 0, 0, 0.7)'
    });
    
    // 获取所有已提交表格的数据
    const allTableData = await Promise.all(
      submittedTables.map(async table => {
        try {
          const response = await getTableData(table.code);
          return response.table_data;
        } catch (error) {
          console.error(`获取表格 ${table.name} 数据失败:`, error);
          return null;
        }
      })
    );
    
    // 过滤掉获取失败的表格数据
    const validTableData = allTableData.filter(data => data !== null);
    
    if (validTableData.length === 0) {
      ElMessage.error("获取表格数据失败，请稍后重试");
      loading.close();
      return;
    }
    
    // 汇总数据：使用当前任务的uploadedHeaders作为表头，其他表格只保留数据行
    const mergedData = [];
    
    // 获取表头（从当前任务的uploadedHeaders）
    const headers = currentTask.value?.uploadedHeaders || [];
    
    // 如果有表头，添加到汇总数据中
    if (headers.length > 0) {
      mergedData.push(headers);
      
      // 添加所有数据行
      validTableData.forEach(tableData => {
        if (tableData && tableData.length > 0) {
          mergedData.push(...tableData); // 添加所有数据行（因为table_data本身不包含表头）
        }
      });
    } else if (validTableData.length > 0 && validTableData[0].length > 0) {
      // 如果没有上传的表头，则尝试从第一个有效表格的第一行获取表头
      mergedData.push(validTableData[0][0]); // 添加表头
      
      // 添加所有数据行（包括第一个表格的其他行和后续表格的所有行）
      validTableData.forEach((tableData, index) => {
        if (tableData && tableData.length > 0) {
          if (index === 0) {
            mergedData.push(...tableData.slice(1)); // 第一个表格跳过表头行
          } else {
            mergedData.push(...tableData); // 后续表格添加所有行
          }
        }
      });
    }
    
    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet(mergedData);
    
    // 创建工作簿并添加工作表
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '汇总数据');
    
    // 生成文件名
    const exportFileName = `${fileName.value.replace(/\.[^/.]+$/, "")}_汇总数据_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "_")}.xlsx`;
    
    // 导出Excel文件
    XLSX.writeFile(workbook, exportFileName);
    
    // 关闭加载状态
    loading.close();
    
    ElMessage.success("汇总导出成功");
  } catch (error) {
    console.error("汇总导出失败:", error);
    ElMessage.error("汇总导出失败，请稍后重试");
  }
};

// 获取拆分表格数据（从服务端获取）
const fetchSplitTables = async () => {
  try {
    loading.value = true;
    
    // 检查是否有taskId
    if (!route.query.taskId) {
      ElMessage.error("缺少必要的任务ID参数");
      isTaskValid.value = false;
      return;
    }
    
    // 调用API从服务端获取数据，使用query中的taskId
    const response = await getTaskReleaseData(route.query.taskId as string);
    
    // 检查响应数据是否有效
    if (!response) {
      ElMessage.error("获取的数据格式无效");
      isTaskValid.value = false;
      return;
    }
    
    // 处理未拆分表格的情况：如果splitData为空，使用uploadedData创建一个单元素的splitData数组
    if (!response.splitData || response.splitData.length === 0) {
      // 从当前任务获取原始数据和表头
      const currentTaskData = currentTask.value;
      if (currentTaskData && currentTaskData.uploadedData && currentTaskData.uploadedHeaders) {
        response.splitData = [{
          sheetName: currentTaskData.fileName || '未拆分表格',
          data: currentTaskData.uploadedData,
          headers: currentTaskData.uploadedHeaders
        }];
      } else {
        ElMessage.error("获取的数据格式无效");
        isTaskValid.value = false;
        return;
      }
    }
    
    // 将服务端返回的数据保存到本地store
    const existingTaskIndex = store.tasks.findIndex(task => task.taskId === response.taskId);
    if (existingTaskIndex !== -1) {
      // 如果任务已存在，使用服务端数据完全替换本地任务数据
      // 只保留本地的权限设置，其他所有数据都从服务端获取
      const existingTask = store.tasks[existingTaskIndex];
      const localPermissions = existingTask.permissions;
      
      // 使用服务端数据完全覆盖本地任务数据
      const updatedTask = { 
        ...response,
        // 保留本地的权限设置
        permissions: localPermissions,
        // 更新时间
        updateTime: new Date().toLocaleString('zh-CN')
      };
      
      // 直接替换整个任务对象
      store.tasks[existingTaskIndex] = updatedTask;
      
      // 手动保存状态到本地存储
      saveState(store.$state);
    } else {
      // 如果任务不存在，创建新任务
      store.createTask(response.taskId, response.fileName);
      
      // 找到新创建的任务索引
      const newTaskIndex = store.tasks.findIndex(task => task.taskId === response.taskId);
      if (newTaskIndex !== -1) {
        // 使用服务端数据完全替换新创建的任务
        store.tasks[newTaskIndex] = { 
          ...response,
          updateTime: new Date().toLocaleString('zh-CN') // 更新时间
        };
        
        // 手动保存状态到本地存储
        saveState(store.$state);
      }
    }
    
    // 确保tableLinks存在且为数组
    const tableLinks = response.tableLinks || [];
    
    // 获取任务状态（从当前任务数据或直接调用API）
    const taskStatus = currentTask.value?.status || 'draft';
    
    // 转换splitData为前端需要的表格格式
    splitTables.value = response.splitData.map((table, index) => {
      // 获取对应索引的链接码，如果没有则使用空字符串
      const linkCode = tableLinks[index]?.code || '';
      
      return {
        id: index + 1,
        name: table.sheetName || `表格${index + 1}`,
        rowCount: table.data ? table.data.length : 0,
        code: linkCode,
        status: '未上传',
        taskStatus: taskStatus, // 任务状态
        overduePermission: false, // 默认未豁免
        originalData: table
      };
    });
    
    // 获取最新的子任务状态
    const subtaskStatuses = await getSubTaskStatuses(route.query.taskId as string);
    
    // 更新表格状态
    if (subtaskStatuses && subtaskStatuses.length > 0) {
      splitTables.value.forEach(table => {
        const statusInfo = subtaskStatuses.find(status => status.filling_task_id === table.code);
        if (statusInfo) {
          // 映射后端状态到前端显示
          switch (statusInfo.filling_status) {
            case 'submitted':
              table.status = '已上传';
              break;
            case 'returned':
              table.status = '已退回';
              break;
            case 'in_progress':
            default:
              table.status = '未上传';
              break;
          }
        }
      });
    }
    
    // 查询子任务的豁免情况
    const taskOverdueInfo = await checkTaskOverdue(route.query.taskId as string);
    if (taskOverdueInfo && taskOverdueInfo.overdueStatus) {
      // 更新每个表格的豁免状态
      splitTables.value.forEach(table => {
        const overdueInfo = taskOverdueInfo.overdueStatus.find(item => item.filling_task_id === table.code);
        if (overdueInfo) {
          table.overduePermission = overdueInfo.overdue_permission;
        }
      });
    }
    
    // 标记任务为有效
    isTaskValid.value = true;
  } catch (error) {
    console.error("获取拆分表格数据失败:", error);
    // 直接跳转到error页面，不使用本地数据
    router.push({ path: "/error", query: { message: "获取服务端数据失败，请稍后重试" } });
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

.title-container {
  display: flex;
  align-items: center;
  gap: 15px;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #606266;
}

.deadline {
  padding: 5px 0;
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