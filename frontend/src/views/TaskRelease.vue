<template>
  <div class="task-release-root">
    <TaskInfo
      title="发布任务"
      :taskId="taskId"
      :fileName="fileName"
    />
    
    <!-- 显示表格列表 -->
    <div v-if="splitTables.length > 0" class="tables-container">
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
              <span class="copy-clickable" @click="copyLink(scope.row.link)">{{ shortenLink(scope.row.link) }}</span>
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
import { getTaskReleaseData, withdrawTask } from "../api/task";

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
const loading = ref(false);

// 计算属性：为表格添加链接和状态（从服务端获取）
const splitTablesWithLinks = computed(() => {
  return splitTables.value;
});

// 链接简写函数：简化显示的链接，保持复制使用完整链接
const shortenLink = (fullLink) => {
  if (!fullLink) return '';
  try {
    // 解析URL获取协议和域名部分
    const url = new URL(fullLink);
    // 提取查询参数中的link值
    const linkParam = url.searchParams.get('link') || '';
    // 返回简化格式：协议://...link=xxx
    return `${url.protocol}//...link=${linkParam}`;
  } catch (error) {
    // 解析失败时返回原链接
    return fullLink;
  }
};

// 复制链接
const copyLink = async (link) => {
  try {
    await navigator.clipboard.writeText(link);
    ElMessage.success({
      message: "链接已成功复制到剪贴板！",
      duration: 1000,
    });
  } catch (err) {
    // 兼容方案
    const textarea = document.createElement("textarea");
    textarea.value = link;
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
  const linksText = splitTablesWithLinks.value.map(table => `${table.name}\t${table.link}`).join("\n");
  
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

// 返回条件设置页面（撤回任务）
const goToTaskCondition = async () => {
  try {
    // 调用API撤回任务
    await withdrawTask(taskId.value);
    
    // 设置进度为条件设置页面
    store.progress = 'condition';
    
    // 导航到条件设置页面
    router.push({
      path: "/task-condition",
      query: { taskId: taskId.value }
    });
    
    ElMessage.success("任务已撤回并返回条件设置页面");
  } catch (error) {
    console.error("撤回任务失败:", error);
    ElMessage.error("撤回任务失败，请稍后重试");
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
    
    // 调用API从服务端获取数据
    const response = await getTaskReleaseData(taskId.value);
    
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
          link: `http://${window.location.hostname}:3000/fill?link=${linkCode}`,
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
    ElMessage.error("获取表格数据失败，请稍后重试");
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  // 设置进度为任务发布页面
  store.progress = 'release';
  
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