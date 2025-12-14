<template>
  <div class="permission-setting-panel">
    <h3>权限设置</h3>

    <div class="setting-section">
      <h4>列权限设置</h4>
      <div v-for="(col, index) in columns" :key="index" class="column-setting">
        <label>
          <input type="checkbox" v-model="col.editable" />
          {{ col.label }} 可编辑
        </label>

        <div v-if="col.editable" class="validation-rules">
          <select v-model="col.validation.type" @change="updateValidation(col)">
            <option value="">无验证</option>
            <option value="number">数字</option>
            <option value="date">日期</option>
            <option value="text">文本</option>
            <option value="options">选项</option>
          </select>

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
          </div>

          <div v-if="col.validation.type === 'date'" class="date-validation">
            <input type="date" v-model="col.validation.min" placeholder="开始日期" />
            <input type="date" v-model="col.validation.max" placeholder="结束日期" />
          </div>

          <div v-if="col.validation.type === 'text'" class="text-validation">
            <input
              type="number"
              v-model.number="col.validation.maxLength"
              placeholder="最大长度"
            />
          </div>

          <div v-if="col.validation.type === 'options'" class="options-validation">
            <input
              type="text"
              v-model="col.validation.options"
              placeholder="选项(逗号分隔)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="setting-section">
      <h4>行权限设置</h4>
      <div class="row-setting">
        <label>
          <input type="checkbox" v-model="rowPermissions.editable" />
          所有行可编辑
        </label>
      </div>
    </div>

    <div class="setting-section">
      <h4>单元格权限设置</h4>
      <div class="cell-setting">
        <label>
          <input type="checkbox" v-model="cellPermissions.editable" />
          启用单元格级权限
        </label>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "PermissionSettingPanel",
  props: {
    columns: {
      type: Array,
      required: true,
    },
    rowPermissions: {
      type: Object,
      required: true,
    },
    cellPermissions: {
      type: Object,
      required: true,
    },
  },
  methods: {
    updateValidation(column) {
      // 重置验证规则
      column.validation = {
        type: column.validation.type,
        min: null,
        max: null,
        maxLength: null,
        options: "",
      };
    },
  },
};
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
  margin-bottom: 15px;
}

.setting-section h4 {
  margin-top: 0;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
  font-size: 16px;
}

.column-setting {
  margin: 8px 0;
  padding: 8px;
  background: white;
  border-radius: 4px;
  border: 1px solid #eee;
}

.column-setting label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
}

.validation-rules {
  margin-top: 8px;
  padding: 8px;
  background: #f0f0f0;
  border-radius: 4px;
}

.validation-rules select {
  width: 100%;
  margin-bottom: 10px;
}

.number-validation,
.date-validation,
.text-validation,
.options-validation {
  display: flex;
  gap: 10px;
}

.number-validation input,
.text-validation input {
  flex: 1;
  padding: 5px;
}

.date-validation input {
  flex: 1;
}

.options-validation input {
  width: 100%;
  padding: 5px;
}
</style>
