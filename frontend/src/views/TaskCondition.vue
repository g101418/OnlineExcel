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
          <p v-if="header"><strong>拆分字段：</strong>{{ header }}</p>
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
        <el-button type="primary" @click="saveSettingsAndRelease">上传表格并发布任务</el-button>
        <el-button @click="goToTaskGeneration">返回拆分表格</el-button>
      </div>
    </div>

    <!-- 查看表格对话框 -->
    <el-dialog v-model="dialogVisible" :title="currentTable.name" width="80%">
      <el-table :data="currentTable.data" height="400" border>
        <el-table-column v-for="col in currentTable.columns" :key="col.prop" :prop="col.prop" :label="col.label"
          :width="col.width || 240" />
      </el-table>
    </el-dialog>
  </div>

  <!-- 临时权限展示区域 -->
  <div class="permission-display" v-if="false">
    <h4>当前权限设置</h4>
    <!-- 使用专门的计算属性来展示权限数据 -->
    <pre>{{ JSON.stringify(displayedPermissions, null, 2) }}</pre>
  </div>


</template>
<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { ref, reactive, onMounted, computed, watch } from "vue";
// 修改导入路径为相对路径
import PermissionSettingPanel from "../components/PermissionSettingPanel.vue";
import { useTaskStore, saveState } from "../stores/task";
import TaskInfo from "../components/TaskInfo.vue";
import SparkMD5 from "spark-md5";
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
// 从store获取当前任务数据（与PermissionSettingPanel保持一致的获取方式）
const currentTask = computed(() => {
  if (!taskId.value) return null;
  return store.tasks.find(task => task.taskId === taskId.value);
});
const fileName = computed(() => currentTask.value?.fileName || '');
const split = computed(() => currentTask.value?.split || false);
const header = computed(() => currentTask.value?.header || '');
const splitData = computed(() => currentTask.value?.splitData || []);

// 专门用于权限展示的计算属性，添加详细日志
const displayedPermissions = computed(() => {
  // 直接通过taskId查找任务，不依赖store.currentTask getter
  const task = store.tasks.find(t => t.taskId === taskId.value);

  // 如果找到任务且有权限，使用该权限
  if (task) {
    // 确保任务有完整的权限结构
    if (!task.permissions) {
      task.permissions = getDefaultPermissions();
    }

    // 确保权限结构完整
    if (!task.permissions.row) {
      task.permissions.row = { addable: false, deletable: false, sortable: false };
    }
    if (!task.permissions.columns) {
      task.permissions.columns = [];
    }

    return task.permissions;
  }

  // 如果没有找到任务，返回默认权限
  return getDefaultPermissions();
});

// 拆分表格相关数据
const splitTables = ref([]);
const dialogVisible = ref(false);
const currentTable = ref({});

// 任务表单数据
const taskForm = reactive({
  taskName: '',
  taskDeadline: null,
  formDescription: ''
});

// 日期禁用规则：从第二天开始，最长3周
const disabledDate = (time: Date) => {
  // 计算今天和3周后的日期
  const today = new Date();
  const nextDay = new Date(today);
  nextDay.setDate(today.getDate() + 1); // 从第二天开始
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



// 获取拆分表格数据
const fetchSplitTables = async () => {
  try {
    // 确保currentTask存在
    if (!currentTask.value) {
      splitTables.value = [];
      return;
    }

    // 不拆分的情况：直接使用完整数据作为一个表格
    if (!split.value) {
      const headers = currentTask.value.uploadedHeaders;
      const data = currentTask.value.uploadedData;

      if (headers.length > 0 && data.length > 0) {
        // 将二维数组转换为对象数组
        const formattedData = data.map(row => {
          const obj = {};
          headers.forEach((hd, idx) => {
            obj[hd] = row[idx] !== undefined && row[idx] !== null ? row[idx] : "";
          });
          return obj;
        });

        // 不拆分时：默认显示所有列
        const columnsToShow = headers;

        splitTables.value = [{
          name: fileName.value || "未命名表格",
          rowCount: data.length,
          data: formattedData,
          columns: columnsToShow.map(header => ({
            prop: header,
            label: header,
            width: 120
          }))
        }];
      } else {
        splitTables.value = [];
      }
      return;
    }

    // 拆分的情况：使用拆分后的数据
    if (!header.value) {
      splitTables.value = [];
      return;
    }

    // 从currentTask获取真实的拆分数据
    if (splitData.value && splitData.value.length > 0) {
      splitTables.value = splitData.value.map(item => {
        // 将二维数组转换为对象数组
        const formattedData = item.data.map(row => {
          const obj = {};
          item.headers.forEach((hd, idx) => {
            obj[hd] = row[idx] !== undefined && row[idx] !== null ? row[idx] : "";
          });
          return obj;
        });

        // 查看表格时始终显示所有列，无论是否拆分
        const columnsToShow = item.headers;

        return {
          name: item.sheetName,
          rowCount: item.data.length,
          data: formattedData,
          columns: columnsToShow.map(colHeader => ({
            prop: colHeader, // 使用实际的表头名称作为prop
            label: colHeader,
            width: 120
          }))
        };
      });
    } else {
      // 如果没有拆分数据，则初始化为空数组
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
    // 如果当前是从release环节返回，获取最新任务数据并更新Pinia store
    if (currentTask.value?.progress === 'release') {
      const taskData = await getTaskData(taskId.value);
      store.setUploadedData(taskId.value, taskData.uploadedHeaders, taskData.uploadedData);
      store.setSplitInfo(taskId.value, taskData.splitEnabled, taskData.selectedHeader);
      // 更新其他必要的任务信息
      if (taskData.taskName) store.setTaskName(taskId.value, taskData.taskName);
      if (taskData.taskDeadline) store.setTaskDeadline(taskId.value, taskData.taskDeadline);
    }

    // 重置进度为任务生成页面
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

const saveSettingsAndRelease = async () => {
  // 验证任务信息
  if (!validateTaskInfo()) {
    return;
  }

  try {
    // 生成表格随机编码
    const generateTableCode = (table, index) => {
      const dateStr = new Date().toISOString().slice(0, 19).replace(/-/g, "").replace(/[T:]/g, "");
      const tableIdentifier = table.name || `table_${index}`;
      const metaStr = `${dateStr}:${taskId.value}:${tableIdentifier}`;
      return SparkMD5.hash(metaStr).slice(0, 28);
    };

    // 为所有表格生成随机编码并保存到store
    const tableCodes = splitTables.value.map((table, index) => generateTableCode(table, index));
    // 保存到store时保留完整信息，方便前端使用
    const tableLinks = splitTables.value.map((table, index) => ({
      name: table.name,
      code: tableCodes[index]
    }));
    store.setTableLinks(taskId.value, tableLinks);
    // 将任务名称和截止日期保存到store
    store.setTaskName(taskId.value, taskForm.taskName);
    store.setTaskDeadline(taskId.value, taskForm.taskDeadline);

    // 更新本地store的splitData
    let updatedSplitData = [];
    if (!currentTask.value?.splitEnabled && currentTask.value?.uploadedData?.length > 0) {
      // 未拆分的情况：使用完整数据作为一个表格
      updatedSplitData = [{
        sheetName: currentTask.value.fileName || '未拆分表格',
        data: currentTask.value.uploadedData,
        headers: currentTask.value.uploadedHeaders
      }];
    } else if (currentTask.value?.splitEnabled && currentTask.value?.splitData?.length > 0) {
      // 已拆分的情况：使用现有的splitData
      updatedSplitData = currentTask.value.splitData;
    }
    // 更新store中的splitData
    if (updatedSplitData.length > 0) {
      const task = store.tasks.find(task => task.taskId === taskId.value);
      if (task) {
        task.splitData = updatedSplitData;
        // 手动保存状态到本地存储
        saveState(store.$state);
      }
    }

    // 更新本地store的progress状态为release
    store.setProgress(taskId.value, 'release');

    // 检查并清理不可编辑列的权限
    if (currentTask.value?.permissions?.columns) {
      // 深拷贝columns数组，避免直接修改store
      const cleanedColumns = [...currentTask.value.permissions.columns];

      // 遍历所有列，清理不可编辑列的权限
      cleanedColumns.forEach(column => {
        if (!column.editable) {
          column.validation = getEmptyValidation();
        }
      });

      // 更新store中的权限数据
      currentTask.value.permissions.columns = cleanedColumns;
      // 保存到本地存储
      saveState(store.$state);
    }

    // 准备发送到服务端的数据
    const taskData = {
      // 任务基本信息
      taskId: taskId.value,
      fileName: fileName.value,
      taskName: taskForm.taskName,
      taskDeadline: taskForm.taskDeadline,
      formDescription: taskForm.formDescription,
      updateTime: currentTask.value?.updateTime || new Date().toISOString(),

      // 上传的数据
      uploadedHeaders: currentTask.value?.uploadedHeaders || [],
      uploadedData: currentTask.value?.uploadedData || [],

      // 拆分相关信息
      splitEnabled: currentTask.value?.splitEnabled || false,
      selectedHeader: currentTask.value?.selectedHeader || '',
      split: split.value,
      header: header.value,

      // 确保未拆分的表格也有splitData数据
      ...(!currentTask.value?.splitEnabled && currentTask.value?.uploadedData?.length > 0 && {
        splitData: [{
          sheetName: currentTask.value.fileName || '未拆分表格',
          data: currentTask.value.uploadedData,
          headers: currentTask.value.uploadedHeaders
        }]
      }),
      // 拆分后的表格数据（如果已经有拆分数据，会覆盖上面的默认值）
      ...(currentTask.value?.splitEnabled && currentTask.value?.splitData?.length > 0 && {
        splitData: currentTask.value.splitData
      }),

      // 生成的表格链接（发送包含code和name的对象数组，以便后端创建table_fillings记录）
      tableLinks: tableLinks,

      // 权限设置
      permissions: currentTask.value?.permissions || { row: {}, columns: [] },

      // 面板折叠状态
      permissionPanelCollapsed: currentTask.value?.permissionPanelCollapsed || false,

      // 处理进度状态 - 发送到服务端时设置为release
      progress: 'release'
    };

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

// 监听路由参数变化，手动修改URL时更新页面
watch(
  () => route.query,
  (newQuery) => {
    // 当路由参数变化时，重新初始化数据
    // 路由参数与store的一致性已由TaskInfo组件检查
    fetchSplitTables();
  },
  { deep: true }
);

// 监听任务名称变化，实时保存到store
watch(
  () => taskForm.taskName,
  (newName) => {
    if (taskId.value) {
      store.setTaskName(taskId.value, newName);
    }
  }
);

// 监听任务截止日期变化，实时保存到store
watch(
  () => taskForm.taskDeadline,
  (newDeadline) => {
    if (taskId.value) {
      store.setTaskDeadline(taskId.value, newDeadline);
    }
  }
);

// 监听填表说明变化，实时保存到store
watch(
  () => taskForm.formDescription,
  (newDescription) => {
    if (taskId.value) {
      store.setFormDescription(taskId.value, newDescription);
    }
  }
);
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