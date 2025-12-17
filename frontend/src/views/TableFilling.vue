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
                    <el-tag :type="getFillingStatusType()" size="small">
                        {{ getFillingStatusText() }}
                    </el-tag>
                </p>
                <p>
                    <strong>权限说明：</strong>
                    <el-tooltip placement="top" effect="light">
                        <template #content>
                            <div v-html="permissionTooltipContent"></div>
                        </template>
                        <el-icon class="permission-icon">
                            <InfoFilled />
                        </el-icon>
                    </el-tooltip>
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
            <!-- 暂存按钮：只有在填报中或已退回状态才显示 -->
            <el-button v-if="taskInfo.fillingStatus === 'in_progress' || taskInfo.fillingStatus === 'returned'"
                @click="handleSaveDraft">
                暂存
            </el-button>

            <!-- 还原按钮：只有在填报中或已退回状态才可用，与暂存按钮显示逻辑一致 -->
            <el-button v-if="taskInfo.fillingStatus === 'in_progress' || taskInfo.fillingStatus === 'returned'"
                @click="handleRestore">
                还原表格
            </el-button>

            <!-- 提交/撤回按钮：根据状态动态切换 -->
            <el-button v-if="taskInfo.fillingStatus === 'submitted'" type="warning" @click="handleWithdraw">
                撤回
            </el-button>
            <el-button v-else-if="taskInfo.fillingStatus === 'in_progress' || taskInfo.fillingStatus === 'returned'"
                type="primary" :disabled="!canSubmit" @click="handleSubmit">
                提交
            </el-button>
        </div>
    </div>
</template>


<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
// ElementPlus
import { ElMessage, ElTooltip, ElDivider } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
// Handsontable
import { HotTable } from '@handsontable/vue3'
import { registerAllModules } from 'handsontable/registry'
import { zhCN, registerLanguageDictionary } from 'handsontable/i18n'
import 'handsontable/dist/handsontable.full.css'
// API
import { getTaskFillingData, saveDraft, submitTable, withdrawTable, restoreTable } from '../api/task'

// ======================
// Handsontable 初始化
// ======================
registerAllModules()
registerLanguageDictionary(zhCN)

// ======================
// 路由获取linkCode
// ======================
const route = useRoute()
const router = useRouter()
const linkCode = computed(() => route.query.link as string || '')

// ======================
// 基础状态
// ======================
const hotTableRef = ref<any>(null)
const taskInfo = reactive({
    taskId: '',
    taskName: '',
    taskDeadline: '',
    fillingStatus: ''
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
const originalHeaders = ref<string[]>([])
// 表格数据
const tableData = ref<any[][]>([])
// 权限与校验规则
const permissions = reactive({
    row: {
        addable: false,
        deletable: false,
        sortable: false
    },
    columns: []
})

// 权限提示内容
const permissionTooltipContent = computed(() => {
    let content = '<div style="max-width: 400px;">'
    content += '<h4 style="margin-top: 0; margin-bottom: 8px; font-size: 14px;">列权限设置：</h4>'
    content += '<ul style="margin: 0; padding-left: 20px;">'

    // 如果originalHeaders或permissions.columns为空，显示相应提示
    if (originalHeaders.value.length === 0) {
        content += '<li>暂无列权限信息</li>'
    } else {
        originalHeaders.value.forEach((header, index) => {
            const colPermission = permissions.columns[index] || {}
            content += `<li><strong>${header}：</strong>`

            // 显示列权限信息
            const permissionsList = []

            // 基本权限
            if (!colPermission.editable) permissionsList.push('不可编辑')
            if (colPermission.editable) permissionsList.push('可编辑')
            if (colPermission.required) permissionsList.push('必填')

            // 验证规则
            const validation = colPermission.validation
            if (validation) {
                // 类型转换
                let typeText = ''
                switch (validation.type) {
                    case 'text': typeText = '文本'; break
                    case 'number': typeText = validation.isInteger ? '整数' : '数字'; break
                    case 'date': typeText = '日期'; break
                    case 'options': typeText = '选项'; break
                    case 'regex':
                        if (validation.regexName === '手机号') {
                            typeText = '手机号'
                        } else if (validation.regexName) {
                            typeText = validation.regexName
                        } else {
                            typeText = '规定样式'
                        }
                        break
                    default: typeText = validation.type
                }

                if (typeText) permissionsList.push(`类型：${typeText}`)

                // 范围限制
                if (validation.min !== null && validation.max !== null) {
                    if (validation.type === 'date') {
                        permissionsList.push(`日期范围：${validation.min} 至 ${validation.max}`)
                    } else {
                        permissionsList.push(`数值范围：${validation.min} 至 ${validation.max}`)
                    }
                } else if (validation.min !== null) {
                    if (validation.type === 'date') {
                        permissionsList.push(`日期最小值：${validation.min}`)
                    } else {
                        permissionsList.push(`最小值：${validation.min}`)
                    }
                } else if (validation.max !== null) {
                    if (validation.type === 'date') {
                        permissionsList.push(`日期最大值：${validation.max}`)
                    } else {
                        permissionsList.push(`最大值：${validation.max}`)
                    }
                }

                // 最大长度
                if (validation.maxLength) {
                    permissionsList.push(`最大长度：${validation.maxLength}`)
                }

                // 选项
                if (validation.options && Array.isArray(validation.options) && validation.options.length > 0) {
                    permissionsList.push(`选项：${validation.options.join(' / ')}`)
                }

                // 日期格式
                if (validation.format && validation.type === 'date') {
                    permissionsList.push(`日期格式：${validation.format}`)
                }
            }

            if (permissionsList.length > 0) {
                content += permissionsList.join('，')
            } else {
                content += '仅可读'
            }

            content += '</li>'
        })
    }

    content += '</ul>'

    // 显示行权限信息
    content += '<h4 style="margin-top: 12px; margin-bottom: 8px; font-size: 14px;">行权限设置：</h4>'
    content += '<ul style="margin: 0; padding-left: 20px;">'
    if (permissions.row.addable) content += '<li>可添加行</li>'
    if (permissions.row.deletable) content += '<li>可删除行</li>'
    if (permissions.row.sortable) content += '<li>可调整行顺序</li>'
    if (!permissions.row.addable && !permissions.row.deletable && !permissions.row.sortable) {
        content += '<li>行不可编辑</li>'
    }
    content += '</ul>'

    content += '</div>'
    return content
})

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
        if (min && d < new Date(min)) { return `不能早于 ${new Date(min).toLocaleDateString()}`; }
        if (max && d > new Date(max)) return `不能晚于 ${new Date(max).toLocaleDateString()}`
    }
    else if (type === 'options' && options && !options.includes(v)) { return `只能填写：${options.join(' / ')}` }
    else if (type === 'regex' && regex && !new RegExp(regex).test(v)) { return '格式不正确' }

    return null
}

// ======================
// 获取表格数据
// ======================
const fetchTableData = async () => {
    if (!linkCode.value) {
        ElMessage.error('缺少必要的链接参数')
        // 缺少必要参数时跳转到错误页面
        router.push('/error')
        return
    }

    try {
        const response = await getTaskFillingData(linkCode.value)

        // 如果响应为空或缺少必要数据，跳转到错误页面
        if (!response || !response.headers || !response.tableData) {
            router.push('/error')
            return
        }

        // 设置任务信息
        taskInfo.taskId = response.taskId || ''
        taskInfo.taskName = response.taskName || ''
        taskInfo.taskDeadline = response.taskDeadline || ''
        taskInfo.fillingStatus = response.fillingStatus || ''

        // 设置表格数据
        originalHeaders.value = response.headers || []
        tableData.value = response.tableData || []

        // 设置权限与校验规则
        permissions.row = response.permissions?.row || {
            addable: false,
            deletable: false,
            sortable: false
        }
        permissions.columns = response.permissions?.columns || []

        ElMessage.success('表格数据加载成功')
    } catch (error) {
        console.error('获取表格数据失败:', error)
        // 所有错误情况下都跳转到错误页面
        router.push('/error')
    }
}

// ======================
// 暂存表格数据
// ======================
const handleSaveDraft = async () => {
    if (!linkCode.value) {
        ElMessage.error('缺少必要的链接参数')
        return
    }

    try {
        const hot = hotTableRef.value.hotInstance
        const currentData = hot.getData()

        await saveDraft(linkCode.value, currentData)
        ElMessage.success('表格数据暂存成功')
    } catch (error) {
        console.error('暂存表格数据失败:', error)
        ElMessage.error('表格数据暂存失败，请重试')
    }
}

// ======================
// 提交表格数据
// ======================
const handleSubmit = async () => {
    if (!linkCode.value) {
        ElMessage.error('缺少必要的链接参数')
        return
    }

    try {
        const hot = hotTableRef.value.hotInstance
        const currentData = hot.getData()

        await submitTable(linkCode.value, currentData)
        ElMessage.success('表格数据提交成功')

        // 提交成功后重新获取最新的任务数据，确保状态更新
        await fetchTableData()
    } catch (error) {
        console.error('提交表格数据失败:', error)
        ElMessage.error('表格数据提交失败，请重试')
    }
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
    minRows: tableData.value.length > 0 ? tableData.value.length : 1,
    rowHeights: 36,
    autoWrapRow: true,
    autoWrapCol: true,
    className: 'htCenter',
    columns: originalHeaders.value.length > 0 ? originalHeaders.value.map((_, colIndex) => {
        const perm = permissions.columns[colIndex]
        return {
            data: colIndex,
            readOnly: !perm?.editable,
            validator: function (value: any, callback: Function) {
                const error = getValidationError(value, perm);
                callback(error === null);
            }
        }
    }) : [],
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
    // 核心修复点：afterCreateRow
    afterCreateRow: function (index: number, amount: number) {
        // 1. 填充禁止修改列的默认值（使用第一行对应列的值）
        for (let i = 0; i < amount; i++) {
            permissions.columns.forEach((perm, colIndex) => {
                // 对于禁止修改的列，使用第一行对应列的值作为默认值
                if (!perm?.editable && tableData.value.length > 0) {
                    const defaultValue = tableData.value[0][colIndex];
                    this.setDataAtCell(index + i, colIndex, defaultValue);
                }
            });
        }

        // 2. 使用 setTimeout 将“全表校验”推迟到当前执行栈之后
        // 这确保了数据已经完全写入，且 Handsontable 内部状态已更新
        setTimeout(() => {
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

const formatDate = (d: string) => {
    if (!d) return ''
    return new Date(d).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })
}

const getDeadlineStatus = () => {
    if (!taskInfo.taskDeadline) return 'success'
    const now = new Date()
    const deadline = new Date(taskInfo.taskDeadline)
    const diffDays = (deadline.getTime() - now.getTime()) / (1000 * 3600 * 24)

    if (diffDays < 0) return 'danger' // 已过期
    if (diffDays < 3) return 'warning' // 即将过期
    return 'success' // 正常
}

const getDeadlineText = () => {
    if (!taskInfo.taskDeadline) return '进行中'
    const now = new Date()
    const deadline = new Date(taskInfo.taskDeadline)

    if (now > deadline) return '已过期'
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 3600 * 24))

    if (diffDays === 0) return '今天截止'
    if (diffDays === 1) return '明天截止'
    return `剩余${diffDays}天`
}

// 获取填报状态的标签类型
const getFillingStatusType = () => {
    if (taskInfo.fillingStatus === 'submitted') {
        return 'success'
    } else if (taskInfo.fillingStatus === 'returned') {
        return 'danger'
    } else {
        return 'warning'
    }
}

// 获取填报状态的文本
const getFillingStatusText = () => {
    if (taskInfo.fillingStatus === 'submitted') {
        return '已提交'
    } else if (taskInfo.fillingStatus === 'returned') {
        return '已退回'
    } else {
        return '填报中'
    }
}

// ======================
// 撤回表格提交
// ======================
const handleWithdraw = async () => {
    if (!linkCode.value) {
        ElMessage.error('缺少必要的链接参数')
        return
    }

    try {
        await withdrawTable(linkCode.value)
        ElMessage.success('表格提交已撤回')
        // 更新本地状态
        taskInfo.fillingStatus = 'in_progress'
    } catch (error) {
        console.error('撤回表格提交失败:', error)
        ElMessage.error('表格提交撤回失败，请重试')
    }
}

// ======================
// 还原表格数据
// ======================
const handleRestore = async () => {
    if (!linkCode.value) {
        ElMessage.error('缺少必要的链接参数')
        return
    }

    try {
        await restoreTable(linkCode.value)
        ElMessage.success('表格数据已成功还原')
        // 刷新表格数据
        await fetchTableData()
    } catch (error) {
        console.error('还原表格数据失败:', error)
        ElMessage.error('表格数据还原失败，请重试')
    }
}

// ======================
// 初始化
// ======================
onMounted(() => {
    fetchTableData()
})
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

            .permission-icon {
                cursor: pointer;
                color: #409eff;
                margin-left: 4px;
                font-size: 16px;
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