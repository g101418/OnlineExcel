<template>
  <div class="home-root">
    <div class="home-card">
      <div class="icon" aria-hidden>
        <img :src="logo" alt="logo" class="logo" />
      </div>

      <h1 class="title">在线表格处理工具</h1>
      <p class="desc">将大型表格拆分为多个可管理的任务，支持批量生成与下载。</p>

      <el-button class="start-btn" size="large" type="primary" @click="openUploadDialog">
        上传表格开始任务
      </el-button>
      <el-dialog title="上传表格" v-model="showUploadDialog" append-to-body width="680px" @close="onDialogClose">
        <div class="dialog-content">
          <el-upload class="upload-demo" :before-upload="beforeUpload" :auto-upload="false" accept=".xls,.xlsx,.csv"
            :on-change="handleChange" :file-list="fileList" :limit="1" drag>
            <i class="el-icon-upload"></i>
            <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
            <div class="el-upload__tip">仅支持后缀为 .xls/.xlsx/.csv 的表格文件</div>
          </el-upload>
          <div v-if="uploading" style="margin-top: 12px">
            <el-progress :percentage="uploadProgress" />
          </div>
        </div>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="onDialogClose">取消</el-button>
            <el-button type="primary" :disabled="!selectedFile || uploading" @click="submitUpload">上传并继续</el-button>
          </span>
        </template>
      </el-dialog>

      <!-- 历史表格信息展示 -->
      <div v-if="hasHistoricalData" class="history-section">
        <h2 class="history-title">历史任务</h2>
        <el-table :data="historicalTables" style="width: 100%; margin-bottom: 20px">
          <el-table-column prop="fileName" label="文件名" min-width="180" />
          <el-table-column prop="taskName" label="任务名称" min-width="180" />
          <el-table-column prop="taskId" label="任务ID" width="180" />
          <el-table-column label="任务状态" width="160">
            <template #default="scope">
              <el-tag :type="getStatusType(scope.row.progress)"
                :effect="scope.row.progress === 'release' ? 'dark' : 'light'">
                {{ getStatusText(scope.row.progress) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="dataSize" label="数据大小" width="120">
            <template #default="scope">{{ formatDataSize(scope.row.dataSize) }}</template>
          </el-table-column>


          <el-table-column label="操作" width="200">
            <template #default="scope">
              <el-button type="primary" size="small" @click="navigateToTask(scope.row)">
                处理
              </el-button>
              <el-button type="danger" size="small" @click="deleteHistoricalTask(scope.row.taskId)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="clear-history">
          <el-button size="small" text @click="clearHistory">清除历史任务</el-button>
        </div>
      </div>

      <!-- 根据任务ID获取任务链接 -->
      <div class="get-task-link">
        <h3 class="get-task-link-title">根据任务ID跳转任务页面</h3>
        <div class="get-task-link-form">
          <el-input 
            v-model="taskIdInput" 
            placeholder="请输入任务ID" 
            class="task-id-input"
            :error="inputError"
          />
          <el-button 
            type="primary" 
            size="small" 
            @click="getTaskByLink"
            class="jump-btn"
          >
            跳转任务页面
          </el-button>
        </div>
        <p v-if="inputError" class="error-message">{{ inputError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { ref, onMounted, onActivated, computed, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";

import SparkMD5 from "spark-md5";
import logo from "../assets/logo.png";
import * as XLSX from "xlsx";
import { useTaskStore, saveState } from "../stores/task";
import { deleteTask, checkIdExists } from "../api/task";

// when a file is selected, we parse it and store the parsed data in pinia store

const store = useTaskStore();

const router = useRouter();
const showUploadDialog = ref(false);
const fileList = ref<any[]>([]);
const selectedFile = ref<File | null>(null);
const uploading = ref(false);
const uploadProgress = ref(0);

// 历史表格信息
const historicalTables = ref([]);
const hasHistoricalData = computed(() => historicalTables.value.length > 0);

// 根据任务ID获取任务链接
const taskIdInput = ref('');
const inputError = ref('');

// 根据任务ID获取任务并跳转
const getTaskByLink = async () => {
  // 清除之前的错误信息
  inputError.value = '';
  
  if (!taskIdInput.value.trim()) {
    inputError.value = '请输入任务ID';
    return;
  }
  
  const taskId = taskIdInput.value.trim();
  
  // 检查ID长度
  if (taskId.length !== 24 && taskId.length !== 28) {
    inputError.value = 'ID长度必须为24位或28位';
    return;
  }
  
  try {
    // 调用API检查ID是否存在
    const result = await checkIdExists(taskId);
    
    // 根据API返回结果跳转
    if (result === 'task') {
      // 主任务跳转release页面
      router.push({ path: '/task-release', query: { taskId } });
    } else if (result === 'table_filling') {
      // 子任务跳转tablefilling页面，注意参数名必须是link，与TableFilling组件的linkCode计算属性对应
      router.push({ path: '/table-filling', query: { link: taskId } });
    }
  } catch (error) {
    console.error('检查ID是否存在失败:', error);
    // 处理API错误
    if (error.response?.data?.error) {
      inputError.value = error.response.data.error;
    } else {
      inputError.value = '不存在该任务ID';
    }
  }
};

// 计算历史表格数据大小
const calculateDataSize = (headers, data) => {
  try {
    const jsonStr = JSON.stringify({ headers, data });
    return new Blob([jsonStr]).size;
  } catch (e) {
    return 0;
  }
};

// 获取任务状态文本
const getStatusText = (progress) => {
  const statusMap = {
    generation: '正在拆分表格',
    condition: '正在设置条件',
    release: '已经发布任务',
    completed: '已经完成'
  };
  return statusMap[progress] || '未知状态';
};

// 获取任务状态类型
const getStatusType = (progress) => {
  const typeMap = {
    generation: 'info',      // 浅蓝色（正在拆分表格）
    condition: 'primary',    // 深蓝色（正在设置条件）
    release: 'warning',      // 橙色（已经发布任务）
    completed: 'success'     // 绿色（已经完成）
  };
  return typeMap[progress] || 'default';
};

// 格式化数据大小
const formatDataSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 导航到任务页面
const navigateToTask = (table) => {
  // 从store中获取最新的任务状态
  const latestTask = store.getTask(table.taskId);
  const actualProgress = latestTask ? latestTask.progress : table.progress;
  
  // 根据最新的progress状态决定跳转目标
  let targetPath;
  if (actualProgress === 'condition') {
    targetPath = '/task-condition';
  } else if (actualProgress === 'release') {
    targetPath = '/task-release';
  } else if (actualProgress === 'completed') {
    targetPath = '/task-release'; // 完成的任务也显示在release页面
  } else {
    targetPath = '/task-generation';
  }

  router.push({
    path: targetPath,
    query: { taskId: table.taskId },
  });
};

// 删除单个历史任务
const deleteHistoricalTask = async (taskId) => {
  try {
    await ElMessageBox.confirm('确定要删除这个历史任务吗？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });

    // 获取要删除的任务
    const task = store.getTask(taskId);
    if (task) {
      // 如果任务处在release环节，需要给服务端发消息
      if (task.progress === 'release') {
        // 通知服务端删除任务
        try {
          await deleteTask(taskId);
        } catch (error) {
          console.error(`删除任务${taskId}失败:`, error);
          // 如果任务已删除或不存在，仍继续执行后续逻辑
          if (!(error.response?.status === 404 || error.message.includes('不存在') || error.message.includes('not found'))) {
            throw error;
          }
        }
      }

      // 从store中删除任务
      store.deleteTask(taskId);

      // 更新历史表格列表
      loadHistoricalData();

      ElMessage.success('任务已删除');
    }
  } catch (error) {
    // 用户取消删除
    if (error !== 'cancel') {
      ElMessage.error('删除任务失败');
    }
  }
};

// 清除历史记录
const clearHistory = async () => {
  try {
    await ElMessageBox.confirm('确定要清除所有历史表格记录吗？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });

    // 获取所有历史任务
    const allTasks = [...store.tasks];
    
    // 筛选出状态为release的任务并通知服务端删除
    for (const task of allTasks) {
      if (task.progress === 'release') {
        try {
          await deleteTask(task.taskId);
        } catch (error) {
          console.error(`删除任务${task.taskId}失败:`, error);
          // 如果任务已删除或不存在，仍继续执行后续逻辑
          if (!(error.response?.status === 404 || error.message.includes('不存在') || error.message.includes('not found'))) {
            // 非404错误需要记录，但继续处理其他任务
            console.error('非404错误:', error);
          }
        }
      }
    }

    // 清除store中的数据
    store.clearAll();

    // 清空历史表格列表
    historicalTables.value = [];

    ElMessage.success('历史记录已清除');
  } catch (error) {
    // 用户取消清除
    if (error !== 'cancel') {
      ElMessage.error('清除历史记录失败');
    }
  }
};

// 加载历史表格数据
const loadHistoricalData = () => {
  // 清空当前历史记录
  historicalTables.value = [];

  // 遍历store中的所有任务
  store.tasks.forEach(task => {
    // 计算数据大小
    const dataSize = calculateDataSize(task.uploadedHeaders, task.uploadedData);

    // 创建历史表格项
    const historicalItem = {
      taskId: task.taskId,
      fileName: task.fileName,
      taskName: task.taskName,
      dataSize: dataSize,
      updateTime: task.updateTime,
      progress: task.progress
    };

    // 添加到历史记录列表
    historicalTables.value.push(historicalItem);
  });
};

// 页面加载时加载历史表格数据
onMounted(() => {
  loadHistoricalData();
});

// 当组件被激活时重新加载历史数据（用于从其他页面返回时更新状态）
onActivated(() => {
  loadHistoricalData();
});

// 监听store.tasks的变化，当任务列表变化时重新加载历史数据
watch(
  () => store.tasks,
  () => {
    loadHistoricalData();
  },
  { deep: true }
);

const openUploadDialog = async () => {
  showUploadDialog.value = true;
};

const onDialogClose = () => {
  showUploadDialog.value = false;
  fileList.value = [];
  selectedFile.value = null;
  uploading.value = false;
  uploadProgress.value = 0;
};

const beforeUpload = (file) => {
  const validExt = ["xls", "xlsx", "csv"];
  const name = file.name || "";
  const ext = name.split(".").pop().toLowerCase();
  if (!validExt.includes(ext)) {
    ElMessage.error("只支持 .xls / .xlsx / .csv 格式的文件");
    return false;
  }
  // max 1MB
  const isLt1M = file.size / 1024 / 1024 < 1;
  if (!isLt1M) {
    ElMessage.error("文件不能超过 1MB");
    return false;
  }
  return true;
};

const handleChange = (file, fileListArg) => {
  // file.raw is the actual File object
  selectedFile.value = file.raw || file;
  fileList.value = fileListArg;
  // 选择文件时不立即解析，只在点击上传并继续时解析
};

const parseFileToStore = async (file: File) => {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // Use sheet_to_json with header: 1 to get arrays (first row is headers)
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    if (!rows || rows.length === 0) {
      return { headers: [], dataRows: [] };
    }
    const headers = rows[0].map((h) => (h === null || h === undefined ? "" : String(h)));
    const dataRows = rows.slice(1);
    return { headers, dataRows };
  } catch (err) {
    console.error("failed to parse file:", err);
    return { headers: [], dataRows: [] };
  }
};

const submitUpload = async () => {
  if (!selectedFile.value) {
    ElMessage.warning("请先选择一个表格文件");
    return;
  }
  // 再次校验文件类型/大小，防止绕过 beforeUpload
  if (!beforeUpload(selectedFile.value)) {
    return;
  }
  uploading.value = true;
  uploadProgress.value = 0;
  const clientTaskId = generateTaskId(selectedFile.value as File);

  // 模拟上传进度
  const uploadInterval = setInterval(() => {
    if (uploadProgress.value < 90) {
      uploadProgress.value += 10;
    }
  }, 200);

  try {
    // 确保文件解析完成，重新解析以保证数据最新
    const { headers, dataRows } = await parseFileToStore(selectedFile.value as File);

    // 检查是否有实际数据行
    if (!dataRows || dataRows.length === 0) {
      ElMessage.error("表格必须包含数据行，不能为空或只上传表头");
      selectedFile.value = null;
      fileList.value = [];
      uploading.value = false;
      uploadProgress.value = 0;
      return;
    }

    // 检查表头是否重复
    if (headers && headers.length > 0) {
      const headerSet = new Set();
      const duplicateHeaders = [];

      headers.forEach((header, index) => {
        if (headerSet.has(header)) {
          duplicateHeaders.push({ index: index + 1, name: header });
        } else {
          headerSet.add(header);
        }
      });

      // 如果有重复的表头，显示错误消息并终止上传过程
      if (duplicateHeaders.length > 0) {
        const errorMsg = `表格中存在重复的表头：${duplicateHeaders.map(h => `第${h.index}列 "${h.name}"`).join("、")}`;
        ElMessage.error(errorMsg);
        selectedFile.value = null;
        fileList.value = [];
        uploading.value = false;
        uploadProgress.value = 0;
        return;
      }
    }

    // 直接执行前端逻辑，不调用后端API
    await new Promise(resolve => setTimeout(resolve, 500)); // 缩短模拟处理时间

    clearInterval(uploadInterval);
    uploadProgress.value = 100;

    // 设置任务信息
    store.createTask(clientTaskId, selectedFile.value?.name || "");

    // 将解析的数据保存到任务中
    store.setUploadedData(clientTaskId, headers, dataRows);

    // 手动触发状态保存，确保数据已写入localStorage
    const saveSuccess = saveState(store.$state);
    if (!saveSuccess) {
      ElMessage.warning("数据保存空间不足，刷新页面可能导致数据丢失");
    }

    showUploadDialog.value = false;
    ElMessage.success("文件处理成功，正在跳转...");
    router.push({
      path: "/task-generation",
      query: { taskId: clientTaskId },
    });
  } catch (e) {
    clearInterval(uploadInterval);
    console.error("文件处理失败:", e);
    showUploadDialog.value = false;
    ElMessage.error("文件处理失败，请检查文件格式并重试");
    uploading.value = false;
    uploadProgress.value = 0;
  } finally {
    uploading.value = false;
    uploadProgress.value = 0;
  }
};

const generateTaskId = (file: File) => {
  // 原有逻辑：仅包含年月日
  // const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

  // 新逻辑：包含年月日时分秒
  const dateStr = new Date().toISOString().slice(0, 19).replace(/-/g, "").replace(/[T:]/g, ""); // YYYYMMDDHHmmss

  const baseName = file.name || "";
  const metaStr = `${dateStr}:${baseName}:${file.size}:${file.lastModified || 0}`;
  return SparkMD5.hash(metaStr).slice(0, 24);
};

// uploadToServer removed; use uploadFile from src/api/index.js
</script>

<style scoped lang="less">
.home-root {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  padding: 20px 0;
  width: 100%;
}

.home-card {
  width: 100%;
  max-width: 800px;
  text-align: center;
  padding: 56px 32px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(16, 24, 40, 0.08);
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.title {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  color: #111827;
}

.desc {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.start-btn {
  margin-top: 12px;
  width: 100%;
  max-width: 360px;
  font-size: 18px;
  padding: 12px 20px;
  height: 48px;
}

.logo {
  width: 96px;
  height: 96px;
}

/* 历史表格样式 */
.history-section {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
  width: 100%;
}

.history-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.clear-history {
  text-align: right;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .history-section {
    margin-top: 30px;
  }

  .history-title {
    font-size: 16px;
  }

  .el-table {
    font-size: 12px;
  }
}

/* 根据任务ID获取任务链接样式 */
.get-task-link {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

.get-task-link-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  text-align: center;
}

.get-task-link-form {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
}

.task-id-input {
  width: 300px;
}

.error-message {
  margin: 8px 0 0 0;
  color: #f56c6c;
  font-size: 12px;
  text-align: center;
}

@media (max-width: 768px) {
  .get-task-link-form {
    flex-direction: column;
    align-items: stretch;
  }
  
  .task-id-input {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .home-card {
    padding: 36px 20px;
  }

  .title {
    font-size: 24px;
  }
  .start-btn {
    font-size: 16px;
    height: 44px;
  }
  
  .history-section {
    margin-top: 24px;
  }
  
  .get-task-link {
    margin-top: 24px;
  }
}
</style>
