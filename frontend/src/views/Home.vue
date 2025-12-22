<template>
  <div class="home-root">
    <div class="home-card">
      <div class="icon" aria-hidden>
        <img :src="logo" alt="logo" class="logo" />
      </div>

      <h1 class="title">在线表格填报工具</h1>
      <p class="desc">将大型表格拆分为多个可管理的任务，支持批量生成与下载。</p>

      <el-button class="start-btn" size="large" type="primary" @click="openUploadDialog">
        加载表格开始任务
      </el-button>
      <el-dialog title="加载表格" v-model="showUploadDialog" append-to-body width="680px" @close="onDialogClose">
        <div class="dialog-content">
          <el-upload class="upload-demo" :before-upload="beforeUpload" :auto-upload="false" accept=".xls,.xlsx,.csv,.et"
            :on-change="handleChange" :file-list="fileList" :limit="1" drag>
            <i class="el-icon-upload"></i>
            <div class="el-upload__text">将文件拖到此处，或<em>点击加载</em></div>
            <div class="el-upload__tip">仅支持后缀为 .xls/.xlsx/.csv/.et 的表格文件</div>
          </el-upload>
          <div v-if="uploading" style="margin-top: 12px">
            <el-progress :percentage="uploadProgress" />
          </div>
        </div>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="onDialogClose">取消</el-button>
            <el-button type="primary" :disabled="!selectedFile || uploading" @click="submitUpload">加载表格并继续</el-button>
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
          <el-input v-model="taskIdInput" placeholder="请输入清分任务或填报任务ID" class="task-id-input" :error="inputError" />
          <el-button type="primary" size="small" @click="getTaskByLink" class="jump-btn">
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
    condition: '正在完善任务',
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

// 删除单个任务的通用函数
const deleteSingleTask = async (taskId) => {
  const task = store.getTask(taskId);
  if (!task) return true;

  try {
    // 无论任务处于什么状态，都先检查服务端是否存在该任务
    await checkIdExists(taskId);
    // 服务端存在，调用删除API
    await deleteTask(taskId);
    // 服务端删除成功，删除本地数据
    store.deleteTask(taskId);
    return true;
  } catch (error) {
    console.error(`删除任务${taskId}失败:`, error);
    // 如果是404错误（任务不存在），直接删除本地数据
    if (error.response?.status === 404 || error.message.includes('不存在') || error.message.includes('not found')) {
      store.deleteTask(taskId);
      return true;
    }
    // 其他错误（网络中断、服务端错误等），保留本地数据
    return false;
  }
};

// 删除单个历史任务
const deleteHistoricalTask = async (taskId) => {
  try {
    await ElMessageBox.confirm('确定要删除这个历史任务吗？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });

    const success = await deleteSingleTask(taskId);
    if (success) {
      ElMessage.success('任务已删除');
      // 不需要手动调用loadHistoricalData，watch监听器会自动处理数据更新
    } else {
      ElMessage.error('删除任务失败，请检查网络连接或稍后重试');
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

    // 记录删除失败的任务数
    let failedCount = 0;

    // 逐个删除任务
    for (const task of allTasks) {
      const success = await deleteSingleTask(task.taskId);
      if (!success) {
        failedCount++;
      }
    }

    if (failedCount > 0) {
      ElMessage.error(`部分任务删除失败（${failedCount}个），请检查网络连接或稍后重试`);
    } else {
      ElMessage.success('历史记录已清除');
    }
  } catch (error) {
    // 用户取消清除
    if (error !== 'cancel') {
      ElMessage.error('清除历史记录失败');
    }
  }
};

// 加载历史表格数据
const loadHistoricalData = async (deleteNonExistent = true) => {
  // 清空当前历史记录
  historicalTables.value = [];

  // 遍历store中的所有任务
  for (const task of store.tasks) {
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

    // 如果任务状态是已发布，需要检测是否存在
    if (task.progress === 'release') {
      try {
        // 调用API检查任务是否存在
        await checkIdExists(task.taskId);
        // 任务存在，添加到历史记录列表
        historicalTables.value.push(historicalItem);
      } catch (error) {
        // 任务不存在且允许删除，从本地删除
        if (deleteNonExistent) {
          console.log(`任务 ${task.taskId} 不存在，从本地删除`);
          store.deleteTask(task.taskId);
        } else {
          // 不允许删除时，仍然添加到历史记录列表
          historicalTables.value.push(historicalItem);
        }
      }
    } else {
      // 非已发布任务，直接添加到历史记录列表
      historicalTables.value.push(historicalItem);
    }
  }
};

// 页面加载时加载历史表格数据
onMounted(async () => {
  await loadHistoricalData();
});

// 当组件被激活时重新加载历史数据（用于从其他页面返回时更新状态）
onActivated(async () => {
  await loadHistoricalData();
});

// 监听store.tasks的变化，当任务列表变化时重新加载历史数据
watch(
  () => store.tasks,
  async () => {
    await loadHistoricalData();
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
  const validExt = ["xls", "xlsx", "csv", "et"];
  const name = file.name || "";
  const ext = name.split(".").pop().toLowerCase();
  if (!validExt.includes(ext)) {
    ElMessage.error("只支持 .xls / .xlsx / .csv / .et 格式的文件");
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

    // 使用 header: 1 获取原始数组
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // 1. 校验：表格是否完全为空
    if (!rows || rows.length === 0) {
      return { headers: [], dataRows: [] };
    }

    // 2. 高效获取整个表格的最大列数
    // 使用XLSX库提供的工作表范围信息获取最大行列数
    let maxCols = 0;
    if (worksheet['!ref']) {
      // 获取工作表的范围（如A1:G100）
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      // 最大列数 = 结束列索引 + 1（因为索引从0开始）
      maxCols = range.e.c + 1;
    } else {
      // 兼容没有!ref的情况，使用传统方法
      rows.forEach(row => {
        if (Array.isArray(row) && row.length > maxCols) {
          maxCols = row.length;
        }
      });
    }

    // 如果最大列数为0，说明全是空行
    if (maxCols === 0) {
      return { headers: [], dataRows: [] };
    }

    // 3. 处理表头
    // 获取第一行作为表头原始数据
    const rawHeaders = rows[0] || [];
    const headers = [];

    // 按照最大列数填充表头，确保 header 数组长度足够
    for (let i = 0; i < maxCols; i++) {
      const cell = rawHeaders[i];
      // 转为字符串并去空格，undefined/null 转为空字符串
      const headerText = (cell === null || cell === undefined) ? "" : String(cell).trim();
      headers.push(headerText);
    }

    // 4. 处理数据行 (去除第一行表头)
    const dataRows = rows.slice(1);

    return { headers, dataRows };
  } catch (err) {
    console.error("failed to parse file:", err);
    // 返回空结构以便在外层报错
    return { headers: [], dataRows: [] };
  }
};

const submitUpload = async () => {
  if (!selectedFile.value) {
    ElMessage.warning("请先选择一个表格文件");
    return;
  }
  
  if (!beforeUpload(selectedFile.value)) {
    return;
  }

  uploading.value = true;
  uploadProgress.value = 0;
  
  // 模拟进度条
  const uploadInterval = setInterval(() => {
    if (uploadProgress.value < 90) {
      uploadProgress.value += 10;
    }
  }, 200);

  try {
    const { headers, dataRows } = await parseFileToStore(selectedFile.value as File);

    // --- 校验逻辑开始 ---

    // 校验1：表格完全为空（没有表头 或 没有列）
    if (headers.length === 0) {
      ElMessage.error("表格为空或无法解析，请检查文件内容");
      stopUpload(uploadInterval);
      return;
    }

    // 校验2：表头有空单元格
    // 收集所有空表头的列号（从1开始）
    const emptyHeaderIndices: number[] = [];
    headers.forEach((header, index) => {
      if (!header) { // 空字符串、null、undefined
        emptyHeaderIndices.push(index + 1);
      }
    });

    if (emptyHeaderIndices.length > 0) {
      const errorMsg = `第 ${emptyHeaderIndices.join("、")} 列表头为空，请补充完整后上传`;
      ElMessage.error(errorMsg);
      stopUpload(uploadInterval);
      return;
    }

    // 校验3：必须包含数据行
    if (!dataRows || dataRows.length === 0) {
      ElMessage.error("表格仅包含表头，请添加数据行。如确需上传，可手动增加“序号”列等并填写至少一行。");
      stopUpload(uploadInterval);
      return;
    }
    
    // 校验4：表头重复校验 (原有逻辑优化)
    const headerSet = new Set();
    const duplicateHeaders: string[] = [];
    headers.forEach((header, index) => {
      if (headerSet.has(header)) {
        duplicateHeaders.push(`第${index + 1}列 "${header}"`);
      } else {
        headerSet.add(header);
      }
    });

    if (duplicateHeaders.length > 0) {
      ElMessage.error(`存在重复表头：${duplicateHeaders.join("、")}`);
      stopUpload(uploadInterval);
      return;
    }

    // 校验5：localStorage容量检查
    const dataSize = calculateDataSize(headers, dataRows);
    const estimatedSize = dataSize * 2; // 乘以3作为安全系数
    
    // 获取当前localStorage已使用的空间
    let usedStorage = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        usedStorage += localStorage[key].length * 2; // 每个字符占用2字节
      }
    }    
    
    // 检查是否有足够的空间
    const availableStorage = 4.5 * 1024 * 1024 - usedStorage; // 假设localStorage总容量为4.5MB
    
    if (estimatedSize > availableStorage) {
      ElMessage.error(`表格数据过大，本地存储空间不足，请删除无用任务后再试。`);
      stopUpload(uploadInterval);
      return;
    }

    // --- 校验逻辑结束 ---

    // 只有所有校验通过，才继续后续流程
    // ... 模拟网络请求延迟
    await new Promise(resolve => setTimeout(resolve, 100));

    clearInterval(uploadInterval);
    uploadProgress.value = 100;

    const clientTaskId = generateTaskId(selectedFile.value as File);
    store.createTask(clientTaskId, selectedFile.value?.name || "");
    store.setUploadedData(clientTaskId, headers, dataRows);

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
    console.error("文件处理失败:", e);
    ElMessage.error("文件处理异常，请检查文件格式");
    stopUpload(uploadInterval);
  }
};

const stopUpload = (intervalId: any) => {
  clearInterval(intervalId);
  selectedFile.value = null;
  fileList.value = [];
  uploading.value = false;
  uploadProgress.value = 0;
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

@media (max-width: 640px) {
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
