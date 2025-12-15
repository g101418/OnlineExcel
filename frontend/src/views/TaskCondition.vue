<template>
  <div class="task-condition-root">
    <TaskInfo title="设定条件" :taskId="taskId" :fileName="fileName" :showDivider="true"
      @task-validity-change="handleTaskValidityChange" />
    <!-- 只有当任务有效时，才显示内容 -->
    <div v-if="isTaskValid" class="info">
      <!-- 任务名称输入框 -->
      <div class="task-name-input">
        <h3>任务信息</h3>
        <el-form :model="taskForm" label-width="115px" style="margin-bottom: 20px;">
          <el-row :gutter="20">
            <el-col :span="14">
              <el-form-item label="任务名称" prop="taskName" :rules="[{ required: true, message: '请输入任务名称', trigger: ['blur', 'submit'] }]">
                <el-input v-model="taskForm.taskName" placeholder="请输入任务名称" @blur="validateTaskName" />
              </el-form-item>
            </el-col>
            <el-col :span="10">
              <el-form-item label="任务截止日期" prop="taskDeadline" :rules="[{ required: true, message: '请选择任务截止日期', trigger: ['blur', 'change'] }]">
                <el-date-picker
                  v-model="taskForm.taskDeadline"
                  type="datetime"
                  placeholder="请选择日期时间"
                  :disabledDate="disabledDate"
                  style="width: 80%"
                />
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
        <el-button type="primary" @click="saveSettings">保存设置并发布</el-button>
        <el-button @click="goToTaskGeneration">返回生成表格</el-button>
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
  <div class="permission-display">
    <h4>当前权限设置</h4>
    <pre>{{ JSON.stringify(store.permissions, null, 2) }}</pre>
  </div>


</template>
<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { ref, reactive, onMounted, computed, watch } from "vue";
// 修改导入路径为相对路径
import PermissionSettingPanel from "../components/PermissionSettingPanel.vue";
import { useTaskStore } from "../stores/task";
import TaskInfo from "../components/TaskInfo.vue";
import SparkMD5 from "spark-md5";
import { ElMessage } from "element-plus";
// 导入API
import { saveTaskSettings } from "../api/task";

const router = useRouter();
const route = useRoute();
const store = useTaskStore();

// 从store获取数据
const taskId = computed(() => store.taskId);
const fileName = computed(() => store.fileName);
const split = computed(() => store.split);
const header = computed(() => store.header);
const splitData = computed(() => store.splitData);

// 拆分表格相关数据
const splitTables = ref([]);
const dialogVisible = ref(false);
const currentTable = ref({});

// 任务表单数据
const taskForm = reactive({
  taskName: '',
  taskDeadline: null
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
    // 不拆分的情况：直接使用完整数据作为一个表格
    if (!split.value) {
      const headers = store.uploadedHeaders;
      const data = store.uploadedData;

      if (headers.length > 0 && data.length > 0) {
        // 将二维数组转换为对象数组
        const formattedData = data.map(row => {
          const obj = {};
          headers.forEach((hd, idx) => {
            obj[hd] = row[idx] !== undefined && row[idx] !== null ? row[idx] : "";
          });
          return obj;
        });

        splitTables.value = [{
          name: fileName.value || "未命名表格",
          rowCount: data.length,
          data: formattedData,
          columns: headers.map(header => ({
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
    if (!header.value) return;

    // 从 store 获取真实的拆分数据
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

        return {
          name: item.sheetName,
          rowCount: item.data.length,
          data: formattedData,
          columns: item.headers.map(header => ({
            prop: header, // 使用实际的表头名称作为prop
            label: header,
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



const goToTaskGeneration = () => {
  // 重置进度为任务生成页面
  store.progress = 'generation';

  router.push({
    path: "/task-generation",
    query: { taskId: taskId.value }
  });
};

const goHome = () => router.push({ path: "/" });

const saveSettings = async () => {
  // 验证任务信息
  if (!validateTaskInfo()) {
    return;
  }

  try {
    // 生成表格随机编码
    const generateTableCode = (table, index) => {
      const dateStr = new Date().toISOString().slice(0, 19).replace(/-/g, "").replace(/[T:]/g, "");
      const tableIdentifier = `${table.name || `table_${index}`}:${table.rowCount}:${index}`;
      const metaStr = `${dateStr}:${taskId.value}:${tableIdentifier}`;
      return SparkMD5.hash(metaStr).slice(0, 28);
    };

    // 为所有表格生成随机编码并保存到store
    const tableCodes = splitTables.value.map((table, index) => generateTableCode(table, index));
    // 保存到store时保留完整信息，方便前端使用
    const tableLinks = splitTables.value.map((table, index) => ({
      name: table.name,
      code: tableCodes[index],
      link: `${window.location.origin}/process-table?link=${tableCodes[index]}`
    }));
    store.setTableLinks(tableLinks);
    
    // 将任务名称和截止日期保存到store
    store.setTaskName(taskForm.taskName);
    store.setTaskDeadline(taskForm.taskDeadline);

    // 准备发送到服务端的数据
    const taskData = {
      taskId: taskId.value,
      fileName: fileName.value,
      taskName: taskForm.taskName, // 添加任务名称
      taskDeadline: taskForm.taskDeadline, // 添加任务截止日期
      tableLinks: tableCodes, // 只发送随机编码数组
      uploadedHeaders: store.uploadedHeaders,
      uploadedData: store.uploadedData,
      split: split.value,
      header: header.value,
      selectedHeader: store.selectedHeader,
      splitData: store.splitData,
      permissions: store.permissions
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
    ElMessage.error("保存任务设置失败，请稍后重试");
  }
};

onMounted(() => {
  // 设置当前进度为条件设定页面
  store.progress = 'condition';
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