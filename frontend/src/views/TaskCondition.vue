<template>
  <div class="task-condition-root">
    <TaskInfo
      title="设定条件"
      :taskId="taskId"
      :fileName="fileName"
      :showDivider="true"
      @task-validity-change="handleTaskValidityChange"
    />
    <!-- 只有当任务有效时，才显示内容 -->
    <div v-if="isTaskValid" class="info">
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
      <div class="permission-panel" v-if="columns.length > 0">
        <PermissionSettingPanel
          :columns="columns"
          :row-permissions="rowPermissions"
          :cell-permissions="cellPermissions"
        />
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
        <el-table-column
          v-for="col in currentTable.columns"
          :key="col.prop"
          :prop="col.prop"
          :label="col.label"
          :width="col.width || 120"
        />
      </el-table>
    </el-dialog>
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

// 权限设置相关数据
const columns = ref([]);
const rowPermissions = computed(() => store.permissions.row);
const cellPermissions = computed(() => store.permissions.cell);
const columnPermissions = computed(() => store.permissions.columns);

// 任务有效性状态（由TaskInfo组件传递）
const isTaskValid = ref(true);

// 处理任务有效性变化
const handleTaskValidityChange = (valid: boolean) => {
  isTaskValid.value = valid;
};

// 初始化列数据
const initColumns = () => {
  if (split.value && header.value) {
    // 如果是拆分任务，基于拆分字段创建列
    const headers = header.value.split(",").map((h) => h.trim());
    columns.value = headers.map((h, index) => ({
      label: h,
      prop: `col${index}`,
      editable: true,
      validation: {
        type: "",
        min: null,
        max: null,
        maxLength: null,
        options: "",
      },
    }));
  } else if (fileName.value) {
    // 如果不是拆分任务，根据文件名模拟一些默认列
    columns.value = [
      {
        label: "ID",
        prop: "id",
        editable: true,
        validation: {
          type: "number",
          min: null,
          max: null,
          maxLength: null,
          options: "",
        },
      },
      {
        label: "名称",
        prop: "name",
        editable: true,
        validation: {
          type: "text",
          min: null,
          max: null,
          maxLength: 50,
          options: "",
        },
      },
      {
        label: "状态",
        prop: "status",
        editable: true,
        validation: {
          type: "options",
          min: null,
          max: null,
          maxLength: null,
          options: "启用,禁用",
        },
      },
    ];
  }
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
  
  // 保存当前的列权限设置
  store.setColumnPermissions(columns.value);
  
  router.push({
    path: "/task-generation",
    query: { taskId: taskId.value }
  });
};

const goHome = () => router.push({ path: "/" });

const saveSettings = async () => {
  try {
    // 保存权限设置到store
    store.setColumnPermissions(columns.value);
    
    // 生成表格链接
    const generateTableLink = (table, index) => {
      const dateStr = new Date().toISOString().slice(0, 19).replace(/-/g, "").replace(/[T:]/g, "");
      const tableIdentifier = `${table.name || `table_${index}`}:${table.rowCount}:${index}`;
      const metaStr = `${dateStr}:${taskId.value}:${tableIdentifier}`;
      const linkHash = SparkMD5.hash(metaStr).slice(0, 28);
      return `${window.location.origin}/process-table?link=${linkHash}`;
    };
    
    // 为所有表格生成链接并保存到store
    const tableLinks = splitTables.value.map((table, index) => ({
      name: table.name,
      link: generateTableLink(table, index)
    }));
    store.setTableLinks(tableLinks);
    
    // 准备发送到服务端的数据
    const taskData = {
      taskId: taskId.value,
      fileName: fileName.value,
      split: split.value,
      header: header.value,
      columns: columns.value,
      rowPermissions: rowPermissions.value,
      cellPermissions: cellPermissions.value,
      tableLinks: tableLinks,
      splitTables: splitTables.value
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
  // 直接初始化数据，路由参数与store的一致性已由TaskInfo组件检查
  initColumns();
  fetchSplitTables();
  
  // 如果store中有权限设置，应用到columns
  if (store.permissions.columns.length > 0) {
    columns.value = store.permissions.columns;
  }
});

// 监听路由参数变化，手动修改URL时更新页面
watch(
  () => route.query,
  (newQuery) => {
    // 当路由参数变化时，重新初始化数据
    // 路由参数与store的一致性已由TaskInfo组件检查
    initColumns();
    fetchSplitTables();
    
    // 如果store中有权限设置，应用到columns
    if (store.permissions.columns.length > 0) {
      columns.value = store.permissions.columns;
    }
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
</style>