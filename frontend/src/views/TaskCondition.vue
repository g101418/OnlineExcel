<template>
  <div class="task-condition-root">
    <TaskInfo title="设定条件" :showDivider="true" @task-validity-change="handleTaskValidityChange" />
    <!-- 只有当任务有效时，才显示内容 -->
    <div v-if="isTaskValid" class="info">
      <!-- 任务名称输入框 -->
      <div class="task-name-input">
        <h3>任务信息</h3>
        <el-form :model="taskForm" label-width="115px" style="margin-bottom: 20px;">
          <el-row :gutter="20">
            <el-col :span="14">
              <el-form-item label="任务名称" prop="taskName"
                :rules="[{ required: true, message: '请输入任务名称', trigger: ['blur', 'submit'] }, { max: 30, message: '任务名称最长30个字', trigger: ['blur', 'submit'] }]">
                <el-input v-model="taskForm.taskName" placeholder="请输入任务名称" maxlength="30" show-word-limit />
              </el-form-item>
            </el-col>
            <el-col :span="10">
              <el-form-item label="任务截止日期" prop="taskDeadline"
                :rules="[{ required: true, message: '请选择任务截止日期', trigger: ['blur', 'change'] }]">
                <el-date-picker v-model="taskForm.taskDeadline" type="datetime" placeholder="请选择日期时间"
                  :disabledDate="disabledDate" style="width: 80%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row>
            <el-col :span="24">
              <el-form-item label="填表说明" prop="formDescription"
                :rules="[{ max: 1000, message: '填表说明最长1000字', trigger: ['blur', 'submit'] }]">
                <el-input v-model="taskForm.formDescription" placeholder="请输入填表说明（选填）" maxlength="1000" show-word-limit
                  type="textarea" :autosize="{ minRows: 1, maxRows: 5 }" style="width: 70%" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </div>

      <!-- 显示拆分后的表格列表 -->
      <div v-if="splitTables.length > 0" class="split-tables-list">
        <div class="table-header">
          <h3>拆分后的表格</h3>
          <p v-if="currentTaskData?.selectedHeader"><strong>拆分字段：</strong>{{ currentTaskData.selectedHeader }}</p>
        </div>
        <el-table :data="splitTables" style="width: 100%">
          <el-table-column type="index" label="序号" width="80" />
          <el-table-column prop="name" label="表格名称" width="180" />
          <el-table-column prop="rowCount" label="行数" width="180" />
          <el-table-column label="操作">
            <template #default="scope">
              <el-button @click="viewTable(scope.row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 添加权限设置面板 -->
      <div class="permission-panel">
        <PermissionSettingPanel />
      </div>

      <!-- 添加操作按钮 -->
      <div class="actions">
        <el-button @click="saveTemporarySettings">暂存设置</el-button>
        <el-button type="info" @click="goToTaskGeneration">返回拆分表格</el-button>
        <el-button type="primary" @click="saveSettingsAndRelease">上传表格并发布任务</el-button>
      </div>
    </div>

    <!-- 查看表格对话框 -->
    <el-dialog v-model="dialogVisible" :title="currentTable.name" width="80%">
      <div style="height: 65vh;">
      <!-- 使用vxe-table的虚拟滚动优化大数据渲染 -->
      <vxe-table border show-overflow show-header-overflow show-footer-overflow max-height="100%"
        :column-config="{ resizable: true }"
        :virtual-y-config="{ enabled: true, gt: 100 }"
        :pagination-config="{ pageSize: 200 }"
        :data="currentTable.data">
        <vxe-column v-for="col in currentTable.columns" :key="col.field" :field="col.field" :title="col.title" min-width="120"></vxe-column>
      </vxe-table>
      </div>
    </el-dialog>
  </div>


</template>
<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { ref, reactive, onMounted, computed, watch, shallowRef } from "vue";
// 修改导入路径为相对路径
import PermissionSettingPanel from "../components/PermissionSettingPanel.vue";
import { useTaskStore, saveState } from "../stores/task";
import TaskInfo from "../components/TaskInfo.vue";
import { ElMessage } from "element-plus";
// 导入API
import { saveTaskSettings, getTaskData } from "../api/task";
// 导入默认权限函数和空验证函数
import { getDefaultPermissions, getEmptyValidation } from "../hooks/tablePermission";

const router = useRouter();
const route = useRoute();
const store = useTaskStore();

// 从路由query获取taskId
const taskId = computed(() => route.query.taskId as string);

// 本地变量存储当前任务数据
let currentTaskData = null;

// 拆分表格相关数据
const splitTables = shallowRef([]);
const dialogVisible = ref(false);
const currentTable = shallowRef({});

// 任务表单数据 - 直接存储在本地，仅在点击按钮时保存到store
const taskForm = reactive({
  taskName: '',
  taskDeadline: null,
  formDescription: ''
});

// 监听taskId变化，初始化任务数据
watch(
  () => taskId.value,
  () => {
    if (taskId.value) {
      const task = store.tasks.find(t => t.taskId === taskId.value);
      if (task) {
        currentTaskData = task;
        
        // 初始化表单数据
        taskForm.taskName = task.taskName || '';
        taskForm.taskDeadline = task.taskDeadline || null;
        taskForm.formDescription = task.formDescription || '';
      }
    }
  },
  { immediate: true }
);

// 日期禁用规则：从第二天开始，最长3周
const disabledDate = (time: Date) => {
  // 计算今天和3周后的日期
  const today = new Date();
  const nextDay = new Date(today);
  nextDay.setDate(today.getDate()); // 从当天开始
  nextDay.setHours(0, 0, 0, 0);

  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 21); // 最长3周（21天）
  maxDate.setHours(23, 59, 59, 999);

  // 禁用今天及之前的日期，以及3周之后的日期
  return time.getTime() < nextDay.getTime() || time.getTime() > maxDate.getTime();
};

// 任务有效性状态（由TaskInfo组件传递）
const isTaskValid = ref(true);

// 处理任务有效性变化
const handleTaskValidityChange = (valid: boolean) => {
  isTaskValid.value = valid;
};

// 任务信息验证
const validateTaskInfo = () => {
  if (!taskForm.taskName.trim()) {
    ElMessage.warning('请输入任务名称');
    return false;
  }
  if (!taskForm.taskDeadline) {
    ElMessage.warning('请选择任务截止日期');
    return false;
  }
  return true;
};



// 获取拆分表格数据 - 优化版：减少不必要的数据转换和数组操作
const fetchSplitTables = () => {
  try {
    // 确保currentTaskData存在
    if (!currentTaskData) {
      splitTables.value = [];
      return;
    }

    // 不拆分的情况：直接使用完整数据作为一个表格
    if (!currentTaskData.splitEnabled) {
      const headers = currentTaskData.uploadedHeaders;
      const data = currentTaskData.uploadedData;

      if (headers.length > 0 && data.length > 0) {
        // 将二维数组转换为对象数组，以便vxe-table正确显示
        const objectData = data.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          return obj;
        });

        splitTables.value = [{
          name: currentTaskData.fileName || "未命名表格",
          rowCount: data.length,
          data: objectData,
          // 只生成必要的列配置
          columns: headers.map(header => ({
            field: header, // 使用field而不是prop，更适合vxe-table
            title: header,
            minWidth: 120
          }))
        }];
      } else {
        splitTables.value = [];
      }
      return;
    }

    // 拆分的情况：使用拆分后的数据
    if (!currentTaskData.selectedHeader) {
      splitTables.value = [];
      return;
    }

    // 从currentTask获取真实的拆分数据
    if (currentTaskData.splitData && currentTaskData.splitData.length > 0) {
      // 将二维数组转换为对象数组，以便vxe-table正确显示
      splitTables.value = currentTaskData.splitData.map(item => {
        const headers = item.headers;
        const data = item.data;
        
        // 将二维数组转换为对象数组
        const objectData = data.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          return obj;
        });
        
        return {
          name: item.sheetName,
          rowCount: data.length,
          data: objectData,
          // 只生成必要的列配置
          columns: headers.map(colHeader => ({
            field: colHeader,
            title: colHeader,
            minWidth: 120
          }))
        };
      });
    } else {
      splitTables.value = [];
    }
  } catch (error) {
    console.error("获取拆分表格数据失败:", error);
    splitTables.value = []; // 出错时设为空数组
  }
};

const viewTable = (table) => {
  currentTable.value = table;
  dialogVisible.value = true;
};



const goToTaskGeneration = async () => {
  try {
    // 检查当前任务状态是否为condition
    if (currentTaskData?.progress !== 'condition') {
      // 不强行修改条件，直接跳转到对应页面，由目标页面的逻辑处理
      router.push({
        path: "/task-generation",
        query: { taskId: taskId.value }
      });
      return;
    }

    // 如果当前是从release环节返回，获取最新任务数据并更新Pinia store
    if (currentTaskData?.progress === 'release') {
      const taskData = await getTaskData(taskId.value);
      store.setUploadedData(taskId.value, taskData.uploadedHeaders, taskData.uploadedData);
      store.setSplitInfo(taskId.value, taskData.splitEnabled, taskData.selectedHeader);
      // 更新其他必要的任务信息
      if (taskData.taskName) store.setTaskName(taskId.value, taskData.taskName);
      if (taskData.taskDeadline) store.setTaskDeadline(taskId.value, taskData.taskDeadline);
      // 更新本地任务数据
      currentTaskData = taskData;
    }

    // 重置进度为任务生成页面（只有在当前状态是condition时才执行）
    store.setProgress(taskId.value, 'generation');

    router.push({
      path: "/task-generation",
      query: { taskId: taskId.value }
    });
  } catch (error) {
    console.error("返回任务生成页面失败:", error);
    ElMessage.error("返回任务生成页面失败，请稍后重试");
  }
};

const goHome = () => router.push({ path: "/" });

// 暂存设置处理函数
const saveTemporarySettings = async () => {
  try {
    // 保存当前任务表单数据到store
    store.setTaskName(taskId.value, taskForm.taskName);
    store.setTaskDeadline(taskId.value, taskForm.taskDeadline);
    store.setFormDescription(taskId.value, taskForm.formDescription);
    
    // 手动保存状态到本地存储
    await saveState(store.$state);
    ElMessage.success("设置已暂存");
  } catch (error) {
    console.error("暂存设置失败:", error);
    ElMessage.error("暂存设置失败，请稍后重试");
  }
};

const saveSettingsAndRelease = async () => {
  // 验证任务信息
  if (!validateTaskInfo()) {
    return;
  }

  try {

    // 将任务名称和截止日期保存到store
    store.setTaskName(taskId.value, taskForm.taskName);
    store.setTaskDeadline(taskId.value, taskForm.taskDeadline);

    // 更新本地store的splitData
    let updatedSplitData = [];
    if (!currentTaskData?.splitEnabled && currentTaskData?.uploadedData?.length > 0) {
      // 未拆分的情况：使用完整数据作为一个表格
      updatedSplitData = [{
        sheetName: currentTaskData.fileName || '未拆分表格',
        data: currentTaskData.uploadedData,
        headers: currentTaskData.uploadedHeaders
      }];
    } else if (currentTaskData?.splitEnabled && currentTaskData?.splitData?.length > 0) {
      // 已拆分的情况：使用现有的splitData
      updatedSplitData = currentTaskData.splitData;
    }
    // 更新store中的splitData
    if (updatedSplitData.length > 0) {
      const task = store.tasks.find(task => task.taskId === taskId.value);
      if (task) {
        task.splitData = updatedSplitData;
      }
    }

    // 更新本地store的progress状态为release
    store.setProgress(taskId.value, 'release');

    // 检查并清理不可编辑列的权限
    if (currentTaskData?.permissions?.columns) {
      // 深拷贝columns数组，避免直接修改store
      const cleanedColumns = [...currentTaskData.permissions.columns];

      // 遍历所有列，清理不可编辑列的权限
      cleanedColumns.forEach(column => {
        if (!column.editable) {
          column.validation = getEmptyValidation();
        }
      });

      // 更新store中的权限数据
      const task = store.tasks.find(task => task.taskId === taskId.value);
      if (task) {
        task.permissions.columns = cleanedColumns;
      }
    }

    // 从store获取生成好的tableLinks
    const taskFromStore = store.tasks.find(t => t.taskId === taskId.value);
    let tableLinks = taskFromStore ? taskFromStore.tableLinks : [];
    
    // 确保每个tableLink都有正确的taskName（使用当前任务表单中的任务名称）
    tableLinks = tableLinks.map(link => ({
      ...link,
      taskName: taskForm.taskName
    }));

    // 准备发送到服务端的数据
    const taskData = {
      // 任务基本信息
      taskId: taskId.value,
      fileName: currentTaskData?.fileName || '',
      taskName: taskForm.taskName,
      taskDeadline: taskForm.taskDeadline,
      formDescription: taskForm.formDescription,
      updateTime: currentTaskData?.updateTime || new Date().toISOString(),

      // 上传的数据
      uploadedHeaders: currentTaskData?.uploadedHeaders || [],
      uploadedData: currentTaskData?.uploadedData || [],

      // 拆分相关信息
      splitEnabled: currentTaskData?.splitEnabled || false,
      selectedHeader: currentTaskData?.selectedHeader || '',

      // 确保未拆分的表格也有splitData数据
      ...(!currentTaskData?.splitEnabled && currentTaskData?.uploadedData?.length > 0 && {
        splitData: [{
          sheetName: currentTaskData.fileName || '未拆分表格',
          data: currentTaskData.uploadedData,
          headers: currentTaskData.uploadedHeaders
        }]
      }),
      // 拆分后的表格数据（如果已经有拆分数据，会覆盖上面的默认值）
      ...(currentTaskData?.splitEnabled && currentTaskData?.splitData?.length > 0 && {
        splitData: currentTaskData.splitData
      }),

      // 生成的表格链接（发送包含code和name的对象数组，以便后端创建table_fillings记录）
      tableLinks: tableLinks,

      // 权限设置：从store获取最新的权限数据
      permissions: taskFromStore?.permissions || { row: {}, columns: [] },

      // 处理进度状态 - 发送到服务端时设置为release
      progress: 'release'
    };

    // 先将taskData的内容更新到本地store
    // 查找当前任务
    const currentTask = store.tasks.find(t => t.taskId === taskId.value);
    if (currentTask) {
      // 更新任务基本信息
      currentTask.taskName = taskForm.taskName;
      currentTask.taskDeadline = taskForm.taskDeadline;
      currentTask.formDescription = taskForm.formDescription;
      currentTask.updateTime = taskData.updateTime;
      currentTask.tableLinks = tableLinks;
      currentTask.progress = 'release';
      
      // 更新拆分数据
      if (taskData.splitData) {
        currentTask.splitData = taskData.splitData;
      }
      
      // 更新权限数据（如果有）
      if (taskData.permissions) {
        currentTask.permissions = taskData.permissions;
      }
    }

    // 保存更新后的状态到本地存储
    await saveState(store.$state);
    
    // 调用API保存设置到服务端
    await saveTaskSettings(taskData);

    // 跳转到任务发布页面
    router.push({
      path: "/task-release",
      query: { taskId: taskId.value }
    });

    ElMessage.success("任务设置已成功保存并提交到服务端");
  } catch (error) {
    console.error("保存任务设置失败:", error);
    // 提取后端返回的具体错误信息
    const errorMessage = error.response?.data?.error || "保存任务设置失败，请稍后重试";
    ElMessage.error(errorMessage);
  }
};

onMounted(() => {
  // 根据路由query中的taskId设置当前任务
  if (taskId.value) {
    // 1. 查找当前任务
    const task = store.tasks.find(t => t.taskId === taskId.value);
    if (task) {
      // 2. 确保权限对象存在
      if (!task.permissions) {
        task.permissions = getDefaultPermissions();
      }

      // 3. 设置当前进度为条件设定页面
      store.setProgress(taskId.value, 'condition');

      // 4. 加载任务表单数据
      taskForm.taskName = task.taskName || '';
      taskForm.taskDeadline = task.taskDeadline || null;
      taskForm.formDescription = task.formDescription || '';

    } else {

    }
  }
  // 直接初始化数据，路由参数与store的一致性已由TaskInfo组件检查
  fetchSplitTables();
});

// 注：原本添加了对拆分状态变化的监听，但考虑到用户在condition页面不会修改拆分状态，
// 且每次进入condition页面都会重新调用fetchSplitTables()，所以这个监听可能是多余的
// 已保留注释作为参考


</script>

<style scoped lang="less">
.task-condition-root {
  padding: 10px;
}

.info {
  margin-top: 10px;
}

.task-name-input {
  background-color: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  border: 1px solid #e4e7ed;
}

.task-name-input h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  color: #303133;
}

.info p {
  margin: 8px 0;
}

.permission-panel {
  margin-top: 20px;
}

.actions {
  margin-top: 20px;
  text-align: center;
  margin-bottom: 0;
}

.actions .el-button {
  margin: 0 10px;
}

.split-tables-list {
  margin: 20px 0;
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

.table-header p {
  margin: 0;
  font-size: 14px;
}

/* 临时权限展示样式 */
.permission-display {
  margin-top: 30px;
  padding: 15px;
  background-color: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  font-family: monospace;
}

.permission-display h4 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 16px;
  color: #333;
}

.permission-display pre {
  margin: 0;
  padding: 10px;
  background-color: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 14px;
  color: #606266;
}
</style>