<template>
  <div class="table-filling-root">
    <!-- 任务信息展示区 -->
    <div class="task-info-section">
      <div class="task-header">
        <h2>{{ taskInfo.taskName || '表格填报任务' }}</h2>
        <div class="task-meta">
          <span class="task-id">任务ID: {{ taskInfo.taskId }}</span>
          <span class="deadline">截止日期: {{ formatDate(taskInfo.taskDeadline) }}</span>
          <el-tag :type="getDeadlineStatus()" size="small">
            {{ getDeadlineText() }}
          </el-tag>
        </div>
      </div>
    </div>

    <!-- 表格填报区 -->
    <div class="table-section">
      <div class="table-container" ref="tableContainer">
        <hot-table
          v-if="tableData.length > 0"
          :data="tableData"
          :columns="hotColumns"
          :settings="hotSettings"
          @afterChange="handleAfterChange"
          @afterRowMove="handleAfterRowMove"
          @afterCreateRow="handleAfterCreateRow"
          @afterRemoveRow="handleAfterRemoveRow"
        ></hot-table>
        <div v-else class="empty-table">
          <el-empty description="暂无表格数据" />
        </div>
      </div>

      <!-- 错误提示区 -->
      <div v-if="validationErrors.length > 0" class="validation-errors">
        <el-alert
          v-for="(error, index) in validationErrors"
          :key="index"
          :title="error"
          type="error"
          show-icon
          closable
          @close="validationErrors.splice(index, 1)"
        />
      </div>
    </div>

    <!-- 操作按钮区 -->
    <div class="action-buttons">
      <el-button type="warning" @click="handleSaveDraft">
        暂存
      </el-button>
      <el-button type="default" @click="handleClose">
        关闭
      </el-button>
      <el-button type="primary" @click="handleSubmit" :disabled="!canSubmit">
        提交
      </el-button>
      <el-button v-if="submitted" type="danger" @click="handleWithdraw">
        撤回
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, ElAlert, ElEmpty, ElTag } from 'element-plus';
import { useTaskStore } from '../stores/task';
import { HotTable } from '@handsontable/vue3';
import 'handsontable/dist/handsontable.full.css';

// 导入API
import { getTaskFillingData, saveDraft, submitTable, withdrawTable } from '../api/task';

const router = useRouter();
const route = useRoute();
const store = useTaskStore();

// 任务信息
const taskInfo = reactive({
  taskId: '',
  taskName: '',
  taskDeadline: null
});

// 表格数据
const tableData = ref([]);
const originalHeaders = ref([]);
const permissions = ref({ row: {}, columns: [] });
const tableContainer = ref(null);

// 验证错误
const validationErrors = ref([]);
const submitted = ref(false);

// 从URL参数获取链接码
const linkCode = computed(() => route.query.link as string);

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

// 获取截止日期状态
const getDeadlineStatus = () => {
  if (!taskInfo.taskDeadline) return 'info';
  const now = new Date();
  const deadline = new Date(taskInfo.taskDeadline);
  const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'danger';
  if (diffDays <= 3) return 'warning';
  return 'success';
};

// 获取截止日期文本
const getDeadlineText = () => {
  if (!taskInfo.taskDeadline) return '无截止日期';
  const now = new Date();
  const deadline = new Date(taskInfo.taskDeadline);
  const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return '已过期';
  if (diffDays === 0) return '今日截止';
  return `剩余${diffDays}天`;
};

// 计算是否可以提交
const canSubmit = computed(() => {
  if (!tableData.value || tableData.value.length === 0) return false;
  if (validationErrors.value.length > 0) return false;
  if (submitted.value) return false;
  return true;
});

// 配置Handsontable列
const hotColumns = computed(() => {
  if (!originalHeaders.value.length || !permissions.value.columns.length) return [];
  
  return originalHeaders.value.map((header, index) => {
    const columnPerm = permissions.value.columns.find(col => col.label === header) || {};
    return {
      data: index,
      title: header,
      readOnly: !columnPerm.editable,
      validator: columnPerm.validation ? (value, callback) => validateCell(value, columnPerm.validation, callback) : undefined
    };
  });
});

// 配置Handsontable设置
const hotSettings = computed(() => {
  const rowPerm = permissions.value.row || {};
  
  return {
    height: 500,
    width: '100%',
    colHeaders: originalHeaders.value,
    rowHeaders: true,
    contextMenu: true,
    manualRowResize: true,
    manualColumnResize: true,
    allowInsertRow: rowPerm.addable,
    allowRemoveRow: rowPerm.deletable,
    allowRowReorder: rowPerm.sortable,
    minRows: 5,
    maxRows: rowPerm.addable ? undefined : tableData.value.length,
    stretchH: 'all',
    language: 'zh-CN',
    licenseKey: 'non-commercial-and-evaluation'
  };
});

// 单元格验证
const validateCell = (value, validation, callback) => {
  if (!validation) {
    callback(true);
    return;
  }

  const { type, min, max, maxLength, options, isInteger, regex, regexName } = validation;
  const cellValue = String(value || '');

  // 必填验证
  if (validation.required && !cellValue.trim()) {
    callback(false);
    return;
  }

  // 最大长度验证
  if (maxLength && cellValue.length > maxLength) {
    callback(false);
    return;
  }

  // 数值验证
  if (type === 'number' && cellValue) {
    const numValue = Number(cellValue);
    if (isNaN(numValue)) {
      callback(false);
      return;
    }
    if (min !== null && numValue < min) {
      callback(false);
      return;
    }
    if (max !== null && numValue > max) {
      callback(false);
      return;
    }
    if (isInteger && !Number.isInteger(numValue)) {
      callback(false);
      return;
    }
  }

  // 日期验证
  if (type === 'date' && cellValue) {
    const date = new Date(cellValue);
    if (isNaN(date.getTime())) {
      callback(false);
      return;
    }
  }

  // 选项验证
  if (options && options.split(',').length > 0 && cellValue) {
    const validOptions = options.split(',').map(opt => opt.trim());
    if (!validOptions.includes(cellValue.trim())) {
      callback(false);
      return;
    }
  }

  // 正则验证
  if (regex && cellValue) {
    const regexPattern = new RegExp(regex);
    if (!regexPattern.test(cellValue)) {
      callback(false);
      return;
    }
  }

  callback(true);
};

// 处理单元格值变化
const handleAfterChange = (changes, source) => {
  if (!changes || changes.length === 0) return;
  
  // 清除相关行的验证错误
  changes.forEach(([row, col, oldValue, newValue]) => {
    const header = originalHeaders.value[col];
    const columnPerm = permissions.value.columns.find(col => col.label === header) || {};
    
    if (columnPerm.validation && columnPerm.validation.required) {
      // 检查是否必填项为空
      if (!newValue || newValue.toString().trim() === '') {
        validationErrors.value.push(`第${row + 1}行，${header}字段为必填项`);
      } else {
        // 移除已修复的错误
        const errorIndex = validationErrors.value.findIndex(err => 
          err.includes(`第${row + 1}行`) && err.includes(header)
        );
        if (errorIndex > -1) {
          validationErrors.value.splice(errorIndex, 1);
        }
      }
    }
  });
};

// 处理行移动
const handleAfterRowMove = (rows, target) => {
  if (!permissions.value.row.sortable) {
    ElMessage.warning('不允许调整行顺序');
    return;
  }
  ElMessage.success('行顺序已调整');
};

// 处理创建新行
const handleAfterCreateRow = (index, amount) => {
  if (!permissions.value.row.addable) {
    ElMessage.warning('不允许新增行');
    return;
  }
  ElMessage.success('已新增行');
};

// 处理删除行
const handleAfterRemoveRow = (index, amount) => {
  if (!permissions.value.row.deletable) {
    ElMessage.warning('不允许删除行');
    return;
  }
  ElMessage.success('已删除行');
};

// 获取服务端数据
const fetchTaskData = async () => {
  if (!linkCode.value) {
    ElMessage.error('无效的任务链接');
    router.push('/');
    return;
  }

  try {
    // TODO: 调用服务端API获取任务数据
    // const response = await getTaskFillingData(linkCode.value);
    
    // 模拟数据
    const response = {
      taskId: linkCode.value,
      taskName: '销售数据填报任务',
      taskDeadline: '2025-12-31T23:59:59',
      tableData: [
        ['产品名称', '销售数量', '销售金额', '销售日期', '客户类型'],
        ['产品A', 100, 5000, '2025-12-01', '企业'],
        ['产品B', 200, 8000, '2025-12-02', '个人'],
        ['产品C', 150, 6000, '2025-12-03', '企业'],
        ['产品D', 300, 12000, '2025-12-04', '个人']
      ],
      permissions: {
        row: {
          addable: true,
          deletable: true,
          sortable: true
        },
        columns: [
          { label: '产品名称', editable: true, validation: { required: true, maxLength: 50 } },
          { label: '销售数量', editable: true, validation: { required: true, type: 'number', min: 1, isInteger: true } },
          { label: '销售金额', editable: true, validation: { required: true, type: 'number', min: 0 } },
          { label: '销售日期', editable: true, validation: { required: true, type: 'date' } },
          { label: '客户类型', editable: true, validation: { required: true, options: '企业,个人,政府' } }
        ]
      }
    };

    // 更新任务信息
    taskInfo.taskId = response.taskId;
    taskInfo.taskName = response.taskName;
    taskInfo.taskDeadline = response.taskDeadline;

    // 更新表格数据
    if (response.tableData && response.tableData.length > 0) {
      // 提取表头
      originalHeaders.value = response.tableData[0];
      // 设置表格数据（排除表头）
      tableData.value = response.tableData.slice(1);
    }

    // 更新权限设置
    permissions.value = response.permissions || { row: {}, columns: [] };

  } catch (error) {
    console.error('获取任务数据失败:', error);
    ElMessage.error('获取任务数据失败，请稍后重试');
    router.push('/');
  }
};

// 暂存功能
const handleSaveDraft = async () => {
  try {
    // TODO: 调用服务端API保存草稿
    // await saveDraft(linkCode.value, tableData.value);
    
    ElMessage.success('表格已暂存');
  } catch (error) {
    console.error('暂存失败:', error);
    ElMessage.error('暂存失败，请稍后重试');
  }
};

// 关闭功能
const handleClose = () => {
  router.push('/');
};

// 提交功能
const handleSubmit = async () => {
  if (!canSubmit.value) return;

  try {
    // TODO: 调用服务端API提交表格
    // await submitTable(linkCode.value, tableData.value);
    
    submitted.value = true;
    ElMessage.success('表格已提交');
  } catch (error) {
    console.error('提交失败:', error);
    ElMessage.error('提交失败，请稍后重试');
  }
};

// 撤回功能
const handleWithdraw = async () => {
  try {
    // TODO: 调用服务端API撤回表格
    // await withdrawTable(linkCode.value);
    
    submitted.value = false;
    ElMessage.success('表格已撤回，可以继续编辑');
  } catch (error) {
    console.error('撤回失败:', error);
    ElMessage.error('撤回失败，请稍后重试');
  }
};



// 页面挂载时获取数据
onMounted(() => {
  fetchTaskData();
});
</script>

<style scoped lang="less">
.table-filling-root {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: 'Arial', sans-serif;
}

.task-info-section {
  background-color: #f5f7fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 15px;
}

.task-header h2 {
  margin: 0;
  color: #303133;
  font-size: 24px;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.task-id {
  color: #606266;
  font-weight: 500;
}

.deadline {
  color: #606266;
}

.table-section {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.table-container {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
}

.empty-table {
  padding: 50px 0;
  text-align: center;
}

.validation-errors {
  margin-top: 15px;
  max-height: 200px;
  overflow-y: auto;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

/* Handsontable 样式调整 */
:deep(.ht_master) {
  border: none;
}

:deep(.ht_clone_top) {
  border-bottom: 1px solid #ebeef5;
}

:deep(.ht_clone_left) {
  border-right: 1px solid #ebeef5;
}

:deep(.ht_core) {
  font-size: 14px;
}

:deep(.htHeader) {
  background-color: #f5f7fa;
  font-weight: 500;
  color: #303133;
}

:deep(.htInvalid) {
  background-color: rgba(255, 76, 76, 0.1);
  border: 1px solid #f56c6c !important;
}

:deep(.htContextMenu) {
  z-index: 1000;
}
</style>