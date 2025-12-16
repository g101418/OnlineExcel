<template>
    <div class="table-filling-root">
        <!-- 任务信息 -->
        <div class="task-info-section">
            <component :is="headingLevel" class="task-title">{{ taskInfo.taskName || '表格填报任务' }}</component>
            <div class="meta">
                <p v-if="taskInfo.taskName"><strong>任务名称：</strong>{{ taskInfo.taskName }}</p>
                <p>
                    <strong>任务编号：</strong>
                    <el-tooltip content="点击复制任务编号" placement="top">
                        <span class="copy-clickable" @click="copyTaskId(taskInfo.taskId)">{{ taskInfo.taskId }}</span>
                    </el-tooltip>
                </p>
                <p>
                    <strong>截止日期：</strong>
                    {{ formatDate(taskInfo.taskDeadline) }}
                </p>
                <p>
                    <strong>状态：</strong>
                    <el-tag :type="getDeadlineStatus()" size="small">
                        {{ getDeadlineText() }}
                    </el-tag>
                </p>
            </div>
            <el-divider v-if="showDivider" />
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
import { ref, reactive, computed, nextTick } from 'vue'
// ElementPlus
import { ElMessage, ElTooltip, ElDivider } from 'element-plus'
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

// 任务信息配置
const headingLevel = ref<'h1' | 'h2'>('h2')
const showDivider = ref(true)

// 复制任务编号功能
const copyTaskId = async (textToCopy: string) => {
    if (!textToCopy) return

    try {
        await navigator.clipboard.writeText(textToCopy)
        ElMessage.success({
            message: "任务编号已成功复制到剪贴板！",
            duration: 1000,
        })
    } catch (err) {
        const textarea = document.createElement("textarea")
        textarea.value = textToCopy
        textarea.style.position = "fixed"
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        try {
            const success = document.execCommand("copy")
            if (success) {
                ElMessage.success({
                    message: "任务编号已成功复制到剪贴板！",
                    duration: 1000,
                })
            } else {
                throw new Error("execCommand failed")
            }
        } finally {
            document.body.removeChild(textarea)
        }
    }
}

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

// 表格数据
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
        { label: '销售数量', editable: true, required: true, validation: { type: 'number', min: 1, max: 1000, isInteger: true } },
        { label: '销售金额', editable: true, validation: { type: 'number', min: 0, max: 100000 } },
        {
            label: '销售日期', editable: true, validation: {
                type: 'date', min: "2025-11-30T16:00:00.000Z",
                max: "2025-12-30T16:00:00.000Z", format: "yyyy-mm-dd"
            }
        },
        { label: '客户类型', editable: true, required: true, validation: { options: ['企业', '个人'] } },
        { label: '区域', editable: true, validation: { regex: '^(华东|华南|华北|华中|东北|西北|西南)$', regexName: '大区名称' } },
        { label: '业务员手机号', editable: true, validation: { regex: '^1[3-9]\\d{9}$', regexName: '手机号' } },
        { label: '备注', editable: true, validation: { maxLength: 20 } }
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
    if (v == null || v === '') return null // 非必填且为空，跳过后续校验

    if (type === 'text' && maxLength && v.length > maxLength) return `最多允许 ${maxLength} 个字符`

    else if (type === 'number') {
        const num = Number(v)
        if (isNaN(num)) return '必须为数字'
        if (isInteger && !Number.isInteger(num)) return '必须为整数'
        if (min != null && num < min) return `不能小于 ${min}`
        if (max != null && num > max) return `不能大于 ${max}`
    }
    else if (type === 'date') {
        const { format } = validation

        // 如果指定了格式，先验证格式
        if (format) {
            let regex: RegExp
            switch (format.toLowerCase()) {
                case 'yyyy-mm-dd':
                    regex = /^\d{4}-\d{2}-\d{2}$/
                    break
                case 'yy-mm-dd':
                    regex = /^\d{2}-\d{2}-\d{2}$/
                    break
                case 'yyyy/mm/dd':
                    regex = /^\d{4}\/\d{2}\/\d{2}$/
                    break
                case 'yy/mm/dd':
                    regex = /^\d{2}\/\d{2}\/\d{2}$/
                    break
                case 'yyyy.mm.dd':
                    regex = /^\d{4}\.\d{2}\.\d{2}$/
                    break
                case 'yy.mm.dd':
                    regex = /^\d{2}\.\d{2}\.\d{2}$/
                    break
                case 'yyyy年mm月dd日':
                    regex = /^\d{4}年\d{2}月\d{2}日$/
                    break
                default:
                    return '不支持的日期格式'
            }
            if (!regex.test(v)) return `日期格式必须为 ${format}`
        }

        // 然后验证日期有效性和范围
        const d = new Date(v)
        if (isNaN(d.getTime())) return '日期格式不正确'
        if (min && d < new Date(min)) { return `不能早于 ${min}`; }
        if (max && d > new Date(max)) return `不能晚于 ${max}`
    }
    else if (type === 'options' && options && !options.includes(v)) { return `只能填写：${options.join(' / ')}` }
    else if (type === 'regex' && regex && !new RegExp(regex).test(v)) { return '格式不正确' }


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
    height: '500px',
    stretchH: 'all',
    rowHeaders: true,
    colHeaders: originalHeaders.value,
    afterGetColHeader: function (col: number, TH: HTMLElement) {
        if (col < 0 || !TH) return;
        TH.removeAttribute('title');
        if (TH.__tooltipInstance) delete TH.__tooltipInstance;
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
    manualRowMove: permissions.row.sortable,
    contextMenu: {
        items: {
            'row_above': { name: '在上方插入行', hidden: !permissions.row.addable },
            'row_below': { name: '在下方插入行', hidden: !permissions.row.addable },
            'hsep1': '---------',
            'remove_row': { name: '删除行', hidden: !permissions.row.deletable },
            'hsep2': '---------',
            'undo': { name: '撤销' },
            'redo': { name: '重做' }
        }
    },
    afterInit: function () {
        this.validateCells();
    },
    // 校验后回调：维护错误状态对象
    afterValidate: function (isValid: boolean, value: any, row: number, prop: number | string, source: string) {
        const col = typeof prop === 'string' ? this.propToCol(prop) : prop;
        const key = `${row},${col}`;

        // 如果校验通过，直接移除错误
        if (isValid) {
            if (errors.value[key]) {
                const newErrors = { ...errors.value };
                delete newErrors[key];
                errors.value = newErrors;
            }
            return;
        }

        // 如果校验不通过，获取具体错误信息
        const perm = permissions.columns[col];
        const error = getValidationError(value, perm);
        if (error) {
            errors.value = { ...errors.value, [key]: error };
        }
    },
    // ==========================================
    // 核心修复点：afterCreateRow
    // ==========================================
    afterCreateRow: function (index: number, amount: number) {
        // 1. 计算默认值
        const defaultProductName = tableData.value.length > 0 && tableData.value[0][0] ? tableData.value[0][0] : '默认产品';

        // 2. 填充数据 (setDataAtCell 本身会触发一次校验，但此时UI可能尚未准备好)
        for (let i = 0; i < amount; i++) {
            this.setDataAtCell(index + i, 0, defaultProductName);
        }

        // 3. 【修复】使用 setTimeout 将“全表校验”推迟到当前执行栈之后
        // 这确保了数据已经完全写入，且 Handsontable 内部状态已更新
        setTimeout(() => {
            // 可选：如果希望重置所有错误，可以在这里重置。
            // 但更好的做法是只依靠 validateCells 来更新状态，避免瞬间闪烁。
            // errors.value = {}; 

            // 强制刷新校验状态
            this.validateCells();
        }, 10);
    },
    afterRowMove: function () {
        // 拖拽后重新校验以校准 row 索引
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
</script>



<style scoped lang="less">
/* 页面禁止横向滚动 */
:global(body) {
    overflow-x: hidden;
}

.table-filling-root {
    padding: 10px;
}

.task-info-section {
    margin-bottom: 24px;

    .task-title {
        margin-bottom: 16px;
        font-size: 20px;
        font-weight: 600;
        color: #333;
    }

    .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 24px;
        margin-bottom: 16px;

        p {
            margin: 0;
            font-size: 14px;

            .copy-clickable {
                cursor: pointer;
                color: #409eff;

                &:hover {
                    text-decoration: underline;
                }
            }
        }
    }
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