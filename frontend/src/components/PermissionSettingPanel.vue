<template>
  <div class="permission-setting-panel">
    <h3>权限设置</h3>

    <div class="setting-section">
      <h4>全表权限设置</h4>
      <div class="table-permissions">
        <div class="permission-item">
          <label>
            <el-checkbox v-model="rowPermissions.addable" />
            允许新增行
          </label>
        </div>
        <div class="permission-item">
          <label>
            <el-checkbox v-model="rowPermissions.deletable" />
            允许删除行
          </label>
        </div>
        <div class="permission-item">
          <label>
            <el-checkbox v-model="rowPermissions.sortable" />
            允许调整行顺序
          </label>
        </div>
        <!-- 以下为仅展示用的列权限设置 -->
        <div class="permission-item">
          <label>
            <el-checkbox disabled :checked="false" />
            允许新增列
          </label>
        </div>
        <div class="permission-item">
          <label>
            <el-checkbox disabled :checked="false" />
            允许删除列
          </label>
        </div>
        <div class="permission-item">
          <label>
            <el-checkbox disabled :checked="false" />
            允许调整列顺序
          </label>
        </div>
      </div>
    </div>

    <div class="setting-section">
      <h4>列权限设置</h4>
      <div v-for="(col, index) in localColumns" :key="index" class="column-setting">
        <div class="column-basic-permissions">
          <label>
            <strong>{{ col.label }} </strong>
            <el-checkbox v-model="col.editable" :disabled="split && header && col.label === header" />
            可编辑
          </label>
          <label class="required-option">
            <el-checkbox v-model="col.required" :disabled="split && header && col.label === header" />
            必填
          </label>
        </div>

        <div v-if="col.editable" class="validation-rules">
          <el-select v-model="col.validation.type" @change="updateValidation(col)" style="width: 100%; margin-bottom: 10px;">
            <el-option label="无验证" value="" />
            <el-option label="数字" value="number" />
            <el-option label="日期" value="date" />
            <el-option label="文本" value="text" />
            <el-option label="选项" value="options" />
            <el-option label="自定义正则" value="regex" />
          </el-select>

          <div v-if="col.validation.type === 'number'" class="number-validation">
            <input
              type="number"
              v-model.number="col.validation.min"
              placeholder="最小值"
            />
            <input
              type="number"
              v-model.number="col.validation.max"
              placeholder="最大值"
            />
            <label class="integer-option">
              <el-checkbox v-model="col.validation.isInteger" />
              整数
            </label>
          </div>

          <div v-if="col.validation.type === 'date'" class="date-validation">
            <div class="date-format">
              <label style="line-height: 32px; white-space: nowrap; width: 70px;">日期格式：</label>
              <el-select v-model="col.validation.format" size="small" style="width: 150px;">
                <el-option label="无限制" value="" />
                <el-option label="yyyy-mm-dd" value="yyyy-mm-dd" />
                <el-option label="yy-mm-dd" value="yy-mm-dd" />
                <el-option label="yyyy/mm/dd" value="yyyy/mm/dd" />
                <el-option label="yy/mm/dd" value="yy/mm/dd" />
                <el-option label="yyyy.mm.dd" value="yyyy.mm.dd" />
                <el-option label="yy.mm.dd" value="yy.mm.dd" />
              </el-select>
            </div>
            <div class="date-range">
              <label style="line-height: 32px; white-space: nowrap; width: 90px; margin-right: 5px;">限定日期范围：</label>
              <el-date-picker
                v-model="col.validation.min"
                type="date"
                placeholder="开始日期"
                size="small"
                style="flex: 1; min-width: 120px;"
              />
              <el-date-picker
                v-model="col.validation.max"
                type="date"
                placeholder="结束日期"
                size="small"
                style="flex: 1; min-width: 120px;"
              />
            </div>
          </div>

          <div v-if="col.validation.type === 'text'" class="text-validation">
            <input
              type="number"
              v-model.number="col.validation.maxLength"
              placeholder="最大长度"
            />
          </div>

          <div v-if="col.validation.type === 'options'" class="options-validation">
            <el-input-tag
              v-model="col.validation.options"
              placeholder="请输入选项，回车确认（可输入多个选项）"
            />
          </div>

          <div v-if="col.validation.type === 'regex'" class="regex-validation">
            <div class="regex-presets">
              <label>常用正则：</label>
              <el-select v-model="col.validation.regexName" @change="selectRegexPreset(col)" style="width: 100%;">
                <el-option label="选择预设" value="" />
                <el-option label="手机号" value="phone" />
                <el-option label="身份证号" value="idcard" />
                <el-option label="邮箱" value="email" />
                <el-option label="网址" value="url" />
              </el-select>
            </div>
            <div class="regex-custom">
              <label>自定义正则表达式：</label>
              <input
                type="text"
                v-model="col.validation.regex"
                placeholder="输入正则表达式"
              />
            </div>
          </div>
        </div>
      </div>
    </div>


  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useTaskStore } from "../stores/task";
import { getDefaultPermissions } from "../hooks/tablePermission";

// 定义 props
const props = defineProps<{
  columns?: Array<any>;
}>();

// 导入 store
const store = useTaskStore();

// 导入路由
import { useRoute } from 'vue-router';
const route = useRoute();

// 从路由获取taskId
const taskId = computed(() => route.query.taskId as string);

// 从 store 获取数据
const currentTask = computed(() => {
  if (!taskId.value) return null;
  return store.getTask(taskId.value);
});
const uploadedHeaders = computed(() => currentTask.value?.uploadedHeaders || []);
const split = computed(() => currentTask.value?.split || false);
const header = computed(() => currentTask.value?.header || '');
const storePermissions = computed(() => currentTask.value?.permissions);

// 权限设置相关数据
const localColumns = ref([]);
const rowPermissions = ref({ addable: false, deletable: false, sortable: false });

// 常用正则表达式预设
const regexPresets = ref({
  phone: { pattern: /^1[3-9]\d{9}$/, name: '手机号' },
  idcard: { pattern: /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/, name: '身份证号' },
  email: { pattern: /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/, name: '邮箱' },
  url: { pattern: /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/, name: '网址' }
});

// 初始化列数据
const initColumns = () => {
  // 确保taskId存在
  if (!taskId.value) return;
  
  // 确保store中存在当前任务的权限对象
  if (currentTask.value && !currentTask.value.permissions) {
    store.savePermissions(taskId.value, getDefaultPermissions());
  }
  
  // 无论是拆分表还是非拆分表，都使用完整的上传表头列表
  if (uploadedHeaders.value.length > 0) {
    localColumns.value = uploadedHeaders.value.map((h, index) => {
      // 检查是否是拆分字段列
      const isSplitColumn = split.value && header.value && h === header.value;
      
      return {
        label: h,
        prop: h,
        // 默认拆分表的拆分字段列不允许编辑；默认非拆分表的第一列不允许编辑
        editable: !(isSplitColumn || (!split.value && index === 0)),
        required: false,
        validation: {
            type: "",
            min: null,
            max: null,
            maxLength: null,
            options: [],
            isInteger: false,
            regex: "",
            regexName: "",
            format: "" // 设置默认日期格式为无限制（空字符串）
          },
      };
    });
  }
  
  // 如果store中有权限设置，应用到columns
  if (currentTask.value?.permissions?.columns?.length > 0) {
    // 确保options是数组类型
    localColumns.value = currentTask.value.permissions.columns.map(column => {
      if (column.validation && column.validation.type === 'options') {
        // 如果options是字符串类型，转换为数组
        if (typeof column.validation.options === 'string') {
          column.validation.options = column.validation.options
            ? column.validation.options.split(',').map(opt => opt.trim())
            : [];
        } else if (!Array.isArray(column.validation.options)) {
          // 如果不是字符串也不是数组，设为空数组
          column.validation.options = [];
        }
      }
      return column;
    });
  } else if (localColumns.value.length > 0 && currentTask.value) {
    // 如果没有已有的权限设置，将默认的列权限保存到store
    store.setColumnPermissions(taskId.value, localColumns.value);
  }
};

// 更新验证规则
const updateValidation = (column: any) => {
  // 重置验证规则，保留类型和必填属性
  column.validation = {
    type: column.validation.type,
    min: null,
    max: null,
    maxLength: null,
    options: [],
    isInteger: false,
    regex: "",
    regexName: "",
    format: "", // 重置日期格式为默认值（无限制）
  };
};

// 选择正则表达式预设
const selectRegexPreset = (column: any) => {
  if (column.validation.regexName && regexPresets.value[column.validation.regexName]) {
    column.validation.regex = regexPresets.value[column.validation.regexName].pattern.source;
  } else {
    column.validation.regex = "";
  }
};

// 监听 columns 变化
watch(() => props.columns, (newColumns) => {
  if (newColumns && newColumns.length > 0) {
    localColumns.value = newColumns;
  }
}, { deep: true });

// 监听权限设置变化，自动保存到 store
watch(() => localColumns.value, (newColumns) => {
  if (newColumns && newColumns.length > 0) {
    store.setColumnPermissions(taskId.value, newColumns);
  }
}, { deep: true });

// 监听currentTask.permissions变化，初始化本地rowPermissions
watch(() => currentTask.value?.permissions, (newPermissions) => {
  if (newPermissions?.row) {
    // 只有当store中的rowPermissions与本地不同时才更新，避免递归
    const isDifferent = JSON.stringify(newPermissions.row) !== JSON.stringify(rowPermissions.value);
    if (isDifferent) {
      rowPermissions.value = { ...newPermissions.row };
    }
  }
}, { deep: true, immediate: true });

// 监听行权限变化，自动保存到 store
watch(() => rowPermissions.value, (newRowPermissions) => {
  if (newRowPermissions) {
    // 检查是否与store中的值相同，避免递归
    const storeRowPermissions = currentTask.value?.permissions?.row || {};
    if (JSON.stringify(newRowPermissions) !== JSON.stringify(storeRowPermissions)) {
      store.setRowPermissions(taskId.value, newRowPermissions);
    }
  }
}, { deep: true });

// 组件挂载时初始化
onMounted(() => {
  initColumns();
});
</script>

<style scoped>
.permission-setting-panel {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f9f9f9;
  margin-bottom: 0;
}

.setting-section {
  margin-bottom: 20px;
}

.setting-section h4 {
  margin-top: 0;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
  font-size: 16px;
}

/* 全表权限样式 */
.table-permissions {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 10px 0;
}

.permission-item label {
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 14px;
}

/* 列设置样式 */
.column-setting {
  margin: 12px 0;
  padding: 12px;
  background: white;
  border-radius: 4px;
  border: 1px solid #eee;
}

.column-basic-permissions {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 10px;
}

.column-basic-permissions label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.required-option {
  font-weight: normal;
  color: #666;
}

/* 验证规则样式 */
.validation-rules {
  margin-top: 10px;
  padding: 10px;
  background: #f0f0f0;
  border-radius: 4px;
}

.validation-rules select {
  width: 100%;
  margin-bottom: 10px;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.number-validation,
.text-validation,
.options-validation {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.date-validation {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
  width: 100%;
  box-sizing: border-box;
}

.date-validation .date-format {
  display: flex;
  align-items: center;
  gap: 10px;
  vertical-align: center;
  width: 250px;
  flex-shrink: 0;
}

.date-validation .date-range {
  display: flex;
  align-items: center;
  gap: 10px;
  vertical-align: center;
  flex: 1;
  min-width: 250px;
  overflow: hidden;
}

.number-validation input,
.text-validation input,
.options-validation input {
  flex: 1;
  min-width: 120px;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

/* el-select 组件已经有内置样式，不需要额外的padding和border设置 */
.date-validation .el-select {
  min-width: 120px;
}

.integer-option {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 10px;
  font-size: 14px;
}

/* 日期格式选择器样式 */
.date-format {
  display: flex;
  align-items: center;
  gap: 10px;
}


.date-format .el-select {
  min-width: 150px;
}

/* 正则表达式验证样式 */
.regex-validation {
  margin-top: 10px;
}

.regex-presets,
.regex-custom {
  margin-bottom: 10px;
}

.regex-presets label,
.regex-custom label {
  display: block;
  margin-bottom: 5px;
  font-size: 14px;
  font-weight: bold;
}

.regex-presets select,
.regex-custom input {
  width: 100%;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
</style>
