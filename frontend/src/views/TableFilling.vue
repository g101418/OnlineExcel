<template>
    <div class="table-filling-root">
        <!-- 任务信息 -->
        <div class="task-info-section">
            <div class="task-header">
                <h2>{{ taskInfo.taskName || '表格填报任务' }}</h2>
                <div class="task-meta">
                    <span>任务ID：{{ taskInfo.taskId }}</span>
                    <span>截止日期：{{ formatDate(taskInfo.taskDeadline) }}</span>
                    <el-tag :type="getDeadlineStatus()" size="small">
                        {{ getDeadlineText() }}
                    </el-tag>
                </div>
            </div>
        </div>
        <!-- 表格区域 -->
        <div class="table-section">
            <!-- 表格 -->
            <div class="table-wrapper">
                <HotTable ref="hotTableRef" :key="originalHeaders.length" :settings="hotSettings" />
            </div>
            <!-- 校验汇总 -->
            <div v-if="validationErrorCount > 0" class="mt10">
                <el-alert :title="`当前有 ${validationErrorCount} 处填写错误`" type="error" show-icon :closable="false"
                    :fit-content="true" center :title-size="16" />
            </div>
        </div>
        <!-- 操作按钮 -->
        <div class="action-buttons">
            <el-button>暂存</el-button>
            <el-button type="primary" :disabled="!canSubmit">提交</el-button>
        </div>
    </div>
</template>
<script setup lang="ts">
import { ref, reactive, computed, nextTick, watch } from 'vue'
// ElementPlus
import { ElTooltip, ElMessage, ElIcon } from 'element-plus'
import { Tooltip } from 'element-plus/es/components/tooltip/index'
import { WarningFilled } from '@element-plus/icons-vue'
// Handsontable
import { HotTable } from '@handsontable/vue3'
import { registerAllModules } from 'handsontable/registry'
import { zhCN, registerLanguageDictionary } from 'handsontable/i18n'
import 'handsontable/dist/handsontable.full.css'
// ======================
// Handsontable 初始化
// ======================
registerAllModules()
registerLanguageDictionary(zhCN)
// ======================
// 基础状态
// ======================
const hotTableRef = ref<any>(null)
const taskInfo = reactive({
    taskId: '12345678',
    taskName: '销售数据填报任务',
    taskDeadline: '2025-12-31T23:59:59'
})
// 表头
const originalHeaders = ref<string[]>([
    '产品名称',
    '销售数量',
    '销售金额',
    '销售日期',
    '客户类型',
    '区域',
    '业务员手机号',
    '备注'
])
// 表格数据（不含表头）
const tableData = ref<any[][]>([
    ['产品A', 100, 5000, '2025-12-01', '企业', '华东', '13800138000', ''],
    ['产品B', 200, 8000, '2025-12-02', '个人', '华北', '13900139000', '重点客户'],
    ['产品C', 50, 3000, '2025-12-03', '企业', '华南', '13700137000', ''],
    ['产品D', 20, 1200, '2025-12-04', '个人', '西南', '13600136000', '试用'],
    ['产品E', 500, 25000, '2025-12-05', '企业', '东北', '13500135000', '年度合同'],
    ['产品F', 10, 800, '2025-12-06', '个人', '西北', '13400134000', ''],
    ['产品G', 999, 99999, '2025-12-07', '企业', '华中', '13300133000', '超额']
])
// ======================
// 权限与校验规则
// ======================
const permissions = {
    row: {
        addable: true,
        deletable: true,
        sortable: true
    },
    columns: [
        { label: '产品名称', editable: false, required: true },
        {
            label: '销售数量',
            editable: true,
            required: true,
            validation: { type: 'number', min: 1, max: 1000, isInteger: true }
        },
        {
            label: '销售金额',
            editable: true,
            validation: { type: 'number', min: 0, max: 100000 }
        },
        {
            label: '销售日期',
            editable: true,
            validation: {
                type: 'date',
                min: '2025-12-01',
                max: '2025-12-31'
            }
        },
        {
            label: '客户类型',
            editable: true,
            required: true,
            validation: { options: ['企业', '个人'] }
        },
        {
            label: '区域',
            editable: true,
            validation: {
                regex: '^(华东|华南|华北|华中|东北|西北|西南)$',
                regexName: '大区名称'
            }
        },
        {
            label: '业务员手机号',
            editable: true,
            validation: {
                regex: '^1[3-9]\\d{9}$',
                regexName: '手机号'
            }
        },
        {
            label: '备注',
            editable: true,
            validation: { maxLength: 20 }
        }
    ]
}

// ======================
// 校验状态
// ======================
const errors = ref<{ [key: string]: string }>({})
const validationErrorCount = computed(() => Object.keys(errors.value).length)
// ======================
// 核心校验逻辑
// ======================
function getValidationError(value: any, perm: any): string | null {
    if (!perm) return null
    const v = value == null ? '' : String(value).trim()
    const { required, validation = {} } = perm
    const { type, min, max, isInteger, options, regex, maxLength } = validation
    if (required && v === '') return '该字段为必填项'
    // 只有当值为null或undefined时才跳过验证，空字符串、0、false等需要继续验证
    if (v == null) return null
    if (maxLength && v.length > maxLength) {
        return `最多允许 ${maxLength} 个字符`
    }
    if (type === 'number') {
        const num = Number(v)
        if (isNaN(num)) return '必须为数字'
        if (isInteger && !Number.isInteger(num)) return '必须为整数'
        if (min != null && num < min) return `不能小于 ${min}`
        if (max != null && num > max) return `不能大于 ${max}`
    }
    if (type === 'date') {
        const d = new Date(v)
        if (isNaN(d.getTime())) return '日期格式不正确'
        if (min && d < new Date(min)) return `不能早于 ${min}`
        if (max && d > new Date(max)) return `不能晚于 ${max}`
    }
    if (options && !options.includes(v)) {
        return `只能填写：${options.join(' / ')}`
    }
    if (regex && !new RegExp(regex).test(v)) {
        return '格式不正确'
    }
    return null
}
// ======================
// Handsontable 配置
// ======================
const hotSettings = computed(() => ({
    licenseKey: 'non-commercial-and-evaluation',
    language: zhCN.languageCode,
    data: tableData.value,
    width: '100%',
    height: '500px', // 之前修复的高度设置
    stretchH: 'all', // 列宽拉伸填满表格
    rowHeaders: true,
    colHeaders: originalHeaders.value, // 改回原样，只显示标签
    afterGetColHeader: function (col: number, TH: HTMLElement) {
        if (col < 0 || !TH) return; // 跳过行头或其他无效列
        // 删除所有tooltip相关代码
        TH.removeAttribute('title');
        if (TH.__tooltipInstance) {
            delete TH.__tooltipInstance;
        }
    },
    minRows: 0,
    rowHeights: 36,
    autoWrapRow: true,
    autoWrapCol: true,
    className: 'htCenter',
    columns: originalHeaders.value.map((_, colIndex) => {
        const perm = permissions.columns[colIndex]
        return {
            data: colIndex,
            readOnly: !perm.editable,
            validator: function (value: any, callback: Function) {
                const error = getValidationError(value, perm);
                callback(error === null);
            }
        }
    }),
    comments: true,
    copyPaste: true,
    manualRowMove: permissions.row.sortable, // 启用行拖拽功能
    contextMenu: {
        items: {
            'row_above': {
                name: '在上方插入行',
                hidden: !permissions.row.addable // 根据权限控制是否显示插入行选项
            },
            'row_below': {
                name: '在下方插入行',
                hidden: !permissions.row.addable // 根据权限控制是否显示插入行选项
            },
            'hsep1': '---------',
            'remove_row': {
                name: '删除行',
                hidden: !permissions.row.deletable // 根据权限控制是否显示删除行选项
            },
            'hsep2': '---------',
            'undo': {
                name: '撤销'
            },
            'redo': {
                name: '重做'
            }
        }
    },
    afterInit: function () {
        this.validateCells();
    },
    afterValidate: function (isValid: boolean, value: any, row: number, prop: number | string, source: string) {
        const col = typeof prop === 'string' ? this.propToCol(prop) : prop;
        const key = `${row},${col}`;
        const perm = permissions.columns[col];
        if (!isValid) {
            const error = getValidationError(value, perm);
            if (error) {
                errors.value = { ...errors.value, [key]: error };
            }
        } else {
            const newErrors = { ...errors.value };
            delete newErrors[key];
            errors.value = newErrors;
        }
    },
    afterCreateRow: function () {
        errors.value = {};
        this.validateCells();
    },
    afterRowMove: function () {
        errors.value = {};
        this.validateCells();
    },
    afterRemoveRow: function () {
        errors.value = {};
        this.validateCells();
    }
}))
// ======================
// 业务辅助
// ======================
const canSubmit = computed(() => validationErrorCount.value === 0)
const formatDate = (d: string) => new Date(d).toLocaleString()
const getDeadlineStatus = () => 'success'
const getDeadlineText = () => '进行中'
const getRowOperationText = () => '允许新增行，允许拖拽排序'
// 生成列权限的用户友好提示
const generateColumnPermissionText = (columnPerm: any) => {
    if (!columnPerm) return '';
    const { editable, required, label, validation = {} } = columnPerm;
    const { type, min, max, maxLength, options, isInteger, regex, regexName, dateMin, dateMax, format } = validation;
    const permissionTexts: string[] = [];
    // 编辑权限
    permissionTexts.push(editable ? '可编辑' : '只读');
    // 必填状态
    if (required) {
        permissionTexts.push('必填');
    }
    // 验证规则
    const validationTexts: string[] = [];
    // 数据类型
    if (type) {
        switch (type) {
            case 'number':
                validationTexts.push('数值类型');
                if (min !== null) {
                    validationTexts.push(`最小值: ${min}`);
                }
                if (max !== null) {
                    validationTexts.push(`最大值: ${max}`);
                }
                if (isInteger) {
                    validationTexts.push('必须为整数');
                }
                break;
            case 'date':
                validationTexts.push('日期类型');
                if (format) {
                    validationTexts.push(`格式: ${format}`);
                }
                // 优先使用dateMin/dateMax（用户提供的JSON格式），如果不存在则使用min/max
                let effectiveMinDate = dateMin || min;
                let effectiveMaxDate = dateMax || max;
                if (effectiveMinDate && effectiveMaxDate) {
                    const minDateStr = new Date(effectiveMinDate).toLocaleDateString('zh-CN');
                    const maxDateStr = new Date(effectiveMaxDate).toLocaleDateString('zh-CN');
                    validationTexts.push(`日期范围: ${minDateStr} ~ ${maxDateStr}`);
                } else if (effectiveMinDate) {
                    const minDateStr = new Date(effectiveMinDate).toLocaleDateString('zh-CN');
                    validationTexts.push(`最早日期: ${minDateStr}`);
                } else if (effectiveMaxDate) {
                    const maxDateStr = new Date(effectiveMaxDate).toLocaleDateString('zh-CN');
                    validationTexts.push(`最晚日期: ${maxDateStr}`);
                }
                break;
            case 'regex':
                validationTexts.push('特定格式');
                // 处理各种正则表达式名称
                if (regexName) {
                    const regexNameMap: { [key: string]: string } = {
                        'phone': '手机号码格式',
                        'email': '电子邮箱格式',
                        'idcard': '身份证号码格式',
                        'date': '日期格式',
                        'number': '数字格式'
                    };
                    validationTexts.push(regexNameMap[regexName] || regexName);
                } else {
                    validationTexts.push('请输入符合格式的内容');
                }
                break;
        }
    }
    // 最大长度
    if (maxLength) {
        validationTexts.push(`最大长度: ${maxLength}`);
    }
    // 选项限制
    if (options && options.length > 0) {
        validationTexts.push(`可选值: ${options.join('、')}`);
    }
    if (validationTexts.length > 0) {
        permissionTexts.push(validationTexts.join('; '));
    }
    return permissionTexts.join('; ');
};
</script>
<style scoped lang="less">
/* 页面禁止横向滚动 */
:global(body) {
    overflow-x: hidden;
}

.table-filling-root {
    padding: 20px;
}

.table-section {
    margin-top: 20px;
}

.table-wrapper {
    width: 100%;
    overflow-x: hidden; // ⭐ 页面不横滚
}

/* Handsontable 内部允许横向滚动 */
:deep(.handsontable) {
    overflow-x: auto;
}

.help-list {
    padding-left: 20px;

    li {
        margin-bottom: 4px;
    }
}

.mt10 {
    margin-top: 10px;
}

.action-buttons {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
</style>