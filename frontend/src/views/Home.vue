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
          <!-- 表头设置选项 -->
          <div class="options-section">
            <el-divider>表格解析选项</el-divider>

            <div class="option-item">
              <el-form label-position="top" label-width="120px">
                <el-form-item label="表头行范围">
                  <div class="row-range">
                    <el-input-number v-model="headerStartRowIndex" :min="1" :step="1" placeholder="起始行"
                      style="width: 160px; margin-right: 10px;" />
                    <span>至</span>
                    <el-input-number v-model="headerEndRowIndex" :min="headerStartRowIndex" :step="1" placeholder="结束行"
                      style="width: 160px; margin-left: 10px;" />
                  </div>
                  <div class="form-tip">注意：行号从1开始计数</div>
                </el-form-item>

                <el-form-item label="扩展合并单元格">
                  <el-switch v-model="isHandingMergedCells" active-text="是" inactive-text="否" />
                  <div class="form-tip">启用后，数据行中合并单元格的数据会扩展到所有单元格</div>
                </el-form-item>
              </el-form>
            </div>
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
import { ref, onMounted, onActivated, computed, shallowRef, watch } from "vue";
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

const headerStartRowIndex = ref(1);
const headerEndRowIndex = ref(1);
const isHandingMergedCells = ref(true);

// 监听结束行变化，确保始终大于起始行
watch(headerEndRowIndex, (newVal) => {
  if (newVal <= headerStartRowIndex.value) {
    headerEndRowIndex.value = headerStartRowIndex.value;
  }
});

// 监听起始行变化，确保结束行始终大于起始行
watch(headerStartRowIndex, (newVal) => {
  if (headerEndRowIndex.value <= newVal) {
    headerEndRowIndex.value = newVal;
  }
});

// 历史表格信息
const historicalTables = shallowRef([]);
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
      // 保存更新后的状态到本地存储
      await saveState(store.$state);

      loadHistoricalData();
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

    // 逐个删除任务，每个任务都会与服务器通信
    for (const task of allTasks) {
      const success = await deleteSingleTask(task.taskId);
      if (!success) {
        failedCount++;
      }
    }

    await saveState(store.$state);

    if (failedCount > 0) {
      ElMessage.error(`部分任务删除失败（${failedCount}个），请检查网络连接或稍后重试`);
    } else {
      ElMessage.success('历史记录已清除');
      setTimeout(() => window.location.reload(), 700);
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
  let tmpHistoricalTables = [];
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
        tmpHistoricalTables.push(historicalItem);
      } catch (error) {
        // 任务不存在且允许删除，从本地删除
        if (deleteNonExistent) {
          console.log(`任务 ${task.taskId} 不存在，从本地删除`);
          store.deleteTask(task.taskId);
          // 保存更新后的状态到本地存储
          await saveState(store.$state);
        } else {
          // 不允许删除时，仍然添加到历史记录列表
          tmpHistoricalTables.push(historicalItem);
        }
      }
    } else {
      // 非已发布任务，直接添加到历史记录列表
      tmpHistoricalTables.push(historicalItem);
    }
  }
  historicalTables.value = tmpHistoricalTables;
};

// 页面加载时加载历史表格数据
onMounted(async () => {
  await loadHistoricalData();
});

// 当组件被激活时重新加载历史数据（用于从其他页面返回时更新状态）
onActivated(async () => {
  await loadHistoricalData();
});

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
  // max 20MB
  const isLt20M = file.size / 1024 / 1024 < 20;
  if (!isLt20M) {
    ElMessage.error("文件不能超过 20MB");
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

/**
   * 解析 Excel 文件以提取 vxe-table 的分组表头、扁平化表头和数据行。
   * 支持多行表头及合并单元格。
   * @param file 要解析的 Excel 文件。
   * @param headerStartRowIndex 表头起始行的索引（从 0 开始）。
   * @param headerEndRowIndex 表头结束行的索引（从 0 开始）。
   * @param isHandingMergedCells 是否在数据行中展开合并单元格（默认为 true）。
   * @returns [headers, flattenedHeaders, dataRows] 或在结构无效时抛出错误。
   */
const parseFile = async (
  file: File,
  headerStartRowIndex: number,
  headerEndRowIndex: number,
  isHandingMergedCells: boolean = true
): Promise<[any[], string[], any[][]]> => {
  // 将文件读取为 ArrayBuffer 并使用 XLSX 解析工作簿
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const workbookSheetNames = workbook.SheetNames;
  if (workbookSheetNames.length === 0) {
    throw new Error("表格文件为空，没有找到任何工作表");
  }
  const worksheet = workbook.Sheets[workbookSheetNames[0]];

  // 将工作表转换为 JSON 行（header:1 保留原始结构）
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  if (!rows || rows.length === 0) {
    throw new Error("表格为空或无法解析，请检查文件内容");
  }

  // 计算工作表中的最大列数
  let maxCols = 0;
  if (worksheet["!ref"]) {
    maxCols = XLSX.utils.decode_range(worksheet["!ref"]).e.c + 1;
  } else {
    rows.forEach((r) => (maxCols = Math.max(maxCols, r.length)));
  }
  if (maxCols === 0) {
    throw new Error("表格为空或无法解析，请检查文件内容");
  }

  // 验证表头行范围
  const numHeaderRows = headerEndRowIndex - headerStartRowIndex + 1;
  if (
    numHeaderRows <= 0 ||
    headerStartRowIndex < 0 ||
    headerEndRowIndex >= rows.length
  ) {
    throw new Error(
      `表头行范围无效。请确保起始行小于等于结束行，且行号不超出表格范围（表格共有 ${rows.length} 行）`
    );
  }

  // 从工作表中获取合并范围
  const merges = worksheet["!merges"] || [];

  // 辅助函数：查找包含 (r, c) 的合并范围
  const findMerge = (r: number, c: number) => {
    return merges.find(
      (m) => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c
    );
  };

  // 辅助函数：获取 (r, c) 处的原始单元格值，去空格或返回空字符串
  const getCellValue = (r: number, c: number) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = worksheet[addr];
    return cell ? String(cell.v).trim() : "";
  };

  // 辅助函数：获取有效值（如果是合并单元格则进行扩展）
  const getEffectiveValue = (r: number, c: number) => {
    const merge = findMerge(r, c);
    if (merge) {
      return getCellValue(merge.s.r, merge.s.c);
    }
    return getCellValue(r, c);
  };

  // 构建用于 vxe-table 的分组表头
  let headers: {
    title: string;
    children?: any[];
    start: number;
    width: number;
  }[] = [];
  let prevLevel: typeof headers = [];

  // 遍历每一行表头
  for (let row = headerStartRowIndex; row <= headerEndRowIndex; row++) {
    let currentLevel: typeof headers = [];
    let col = 0;
    while (col < maxCols) {
      const merge = findMerge(row, col);
      let title = "";
      let colspan = 1;
      let rowspan = 1;
      if (merge) {
        if (merge.s.r === row && merge.s.c === col) {
          // 这是合并单元格的起始位置
          title = getCellValue(row, col);
          colspan = merge.e.c - merge.s.c + 1;
          rowspan = merge.e.r - merge.s.r + 1;
        } else {
          // 在合并单元格内部但不是起始位置 - 跳过（合并导致的“空”单元格）
          col++;
          continue;
        }
      } else {
        // 普通单元格（未合并）
        title = getCellValue(row, col);
      }

      // 检查表头中是否存在真正的空单元格：非合并单元格或合并起始单元格必须有值
      // 这强制要求表头范围内不含空单元格（仅允许合并导致的占位空值）
      if (!title) {
        throw new Error(
          `无效表头：在第 ${row + 1} 行，第 ${col + 1
          } 列发现空单元格，且该单元格不属于任何合并区域。表头不应包含真正的空单元格。`
        );
      }

      let colObj: {
        title: string;
        children?: any[];
        start: number;
        width: number;
      } = { title, start: col, width: colspan };

      // 如果不是纵向合并且当前不是最后一行表头，则初始化 children
      if (rowspan === 1 && row < headerEndRowIndex) {
        colObj.children = [];
      }
      currentLevel.push(colObj);
      col += colspan;
    }

    if (row > headerStartRowIndex) {
      // 将当前层级挂载到上一层级的 children 属性下
      for (let p of prevLevel) {
        if (p.children) {
          p.children = currentLevel.filter(
            (c) => c.start >= p.start && c.start < p.start + p.width
          );
        }
      }
      // 验证子节点的总宽度是否与父节点匹配
      for (let p of prevLevel) {
        if (p.children) {
          const childSum = p.children.reduce(
            (sum: number, ch: any) => sum + ch.width,
            0
          );
          if (childSum !== p.width) {
            throw new Error("无效表头结构：子节点与父节点不能构成树形结构");
          }
        }
      }
    } else {
      headers = currentLevel;
    }
    prevLevel = currentLevel;
  }

  // 验证顶层节点是否覆盖了所有列
  const topSum = headers.reduce((sum: number, h: any) => sum + h.width, 0);
  if (topSum !== maxCols) {
    throw new Error("无效表头结构：顶层节点未覆盖所有列");
  }

  // 清洗表头：移除内部使用的 start 和 width 属性
  const cleanHeaders = (level: any[]): any[] => {
    return level.map((h) => {
      const cleaned: any = { title: h.title };
      if (h.children && h.children.length > 0) {
        cleaned["children"] = cleanHeaders(h.children);
      }
      return cleaned;
    });
  };
  headers = cleanHeaders(headers);

  // 为扁平化表头构建网格（展开合并单元格）
  let headerGrid: string[][] = Array.from({ length: numHeaderRows }, () =>
    Array(maxCols).fill("")
  );
  for (let ri = 0; ri < numHeaderRows; ri++) {
    let row = headerStartRowIndex + ri;
    for (let c = 0; c < maxCols; c++) {
      headerGrid[ri][c] = getEffectiveValue(row, c);
    }
  }

  // 按列的垂直路径构建扁平化表头
  const flattenedHeaders: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    let path: string[] = [];
    let lastTitle = "";
    for (let ri = 0; ri < numHeaderRows; ri++) {
      let title = headerGrid[ri][c];
      // 避免纵向合并产生的重复名称
      if (title && title !== lastTitle) {
        path.push(title);
        lastTitle = title;
      }
    }
    flattenedHeaders.push(path.join("-") || "");
  }

  // 检查扁平化表头是否有重复值
  const headerSet = new Set<string>();
  const duplicateHeaders = new Set<string>();
  for (const header of flattenedHeaders) {
    if (headerSet.has(header)) {
      duplicateHeaders.add(header);
    } else {
      headerSet.add(header);
    }
  }

  if (duplicateHeaders.size > 0) {
    const duplicateList = Array.from(duplicateHeaders).join(", ");
    throw new Error(
      `无效表头：发现重复的表头名称 [${duplicateList}]。请确保所有表头列的组合路径都是唯一的。`
    );
  }

  // 构建数据行，根据标识位处理合并单元格
  const dataStartRow = headerEndRowIndex + 1;
  const dataRows: any[][] = [];
  for (let r = dataStartRow; r < rows.length; r++) {
    const row: any[] = [];
    for (let c = 0; c < maxCols; c++) {
      let val;
      if (isHandingMergedCells) {
        // 填充合并单元格的值
        val = getEffectiveValue(r, c);
      } else {
        // 获取原始值
        val = getCellValue(r, c);
      }
      row.push(val);
    }
    dataRows.push(row);
  }

  // 校验：必须包含数据行
  if (dataRows.length === 0) {
    throw new Error("表格仅包含表头，请添加数据行。如确需上传，可手动增加“序号”列等并填写至少一行。");
  }

  return [headers, flattenedHeaders, dataRows];
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

  // 校验：结束行必须大于起始行
  if (headerEndRowIndex.value < headerStartRowIndex.value) {
    ElMessage.error("结束行必须大于起始行");
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
    // const { headers, dataRows } = await parseFileToStore(selectedFile.value as File);
    const zeroBasedStartRow = headerStartRowIndex.value - 1;
    const zeroBasedEndRow = headerEndRowIndex.value - 1;

    const [_headers, flattenedHeaders, dataRows] = await parseFile(
      selectedFile.value,
      zeroBasedStartRow,
      zeroBasedEndRow,
      isHandingMergedCells.value
    );

    let headers = flattenedHeaders;

    // console.log(flattenedHeaders, dataRows);

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

    // // 校验5：localStorage容量检查
    // const dataSize = calculateDataSize(headers, dataRows);
    // const estimatedSize = dataSize * 2; // 乘以3作为安全系数

    // if (estimatedSize > 30 * 1024 * 1024) {
    //   ElMessage.error(`表格数据过大，本地存储空间不足，请删除无用任务后再试。`);
    //   stopUpload(uploadInterval);
    //   return;
    // }

    // --- 校验逻辑结束 ---

    // 只有所有校验通过，才继续后续流程
    // ... 模拟网络请求延迟
    await new Promise(resolve => setTimeout(resolve, 100));

    clearInterval(uploadInterval);
    uploadProgress.value = 100;

    const clientTaskId = generateTaskId(selectedFile.value as File);
    store.createTask(clientTaskId, selectedFile.value?.name || "");
    store.setUploadedData(clientTaskId, headers, dataRows);

    const saveSuccess = await saveState(store.$state);
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
    ElMessage.error(e.message);
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

.options-section {
  margin-top: 20px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;

  .option-item {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .row-range {
    display: flex;
    align-items: center;

    span {
      margin: 0 10px;
      color: #606266;
    }
  }

  .form-tip {
    font-size: 14px; // 稍微调小一点通常更美观
    color: #909399;
    margin-left: 10px; // 调整为在输入框下方显示时的间距
    line-height: 1.4;
  }

  // 修复el-divider文字背景色问题
  :deep(.el-divider__text) {
    background-color: #f5f7fa;
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
