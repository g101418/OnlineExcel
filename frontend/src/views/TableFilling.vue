<template>
    <div class="table-filling-root">
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
                    <strong>填表说明：</strong>
                    <el-tooltip placement="top" effect="light">
                        <template #content>
                            <div style="white-space: pre-wrap;">{{ taskInfo.formDescription || '暂无填表说明' }}</div>
                        </template>
                        <el-icon class="permission-icon">
                            <InfoFilled />
                        </el-icon>
                    </el-tooltip>
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

        <div class="table-section">
            <div class="table-wrapper">
                <HotTable ref="hotTableRef" :key="tableKey" :settings="hotSettings" />
            </div>

            <div v-if="validationErrorCount > 0" class="mt10">
                <el-alert :title="`当前有 ${validationErrorCount} 处填写错误`" type="error" show-icon :closable="false"
                    :fit-content="true" center :title-size="16" />
            </div>
        </div>

        <div class="action-buttons">
            <el-button v-if="taskInfo.fillingStatus === 'in_progress' || taskInfo.fillingStatus === 'returned'"
                @click="handleSaveDraft" :disabled="overdueInfo.isOverdue && !overdueInfo.overduePermission">
                暂存
            </el-button>
            <el-button v-if="taskInfo.fillingStatus === 'in_progress' || taskInfo.fillingStatus === 'returned'"
                @click="handleRestore" :disabled="overdueInfo.isOverdue && !overdueInfo.overduePermission">
                还原表格
            </el-button>
            <el-button v-if="taskInfo.fillingStatus === 'submitted'" type="warning" @click="handleWithdraw">
                撤回
            </el-button>
            <el-button v-else-if="taskInfo.fillingStatus === 'in_progress' || taskInfo.fillingStatus === 'returned'"
                type="primary" :disabled="!canSubmit || (overdueInfo.isOverdue && !overdueInfo.overduePermission)"
                @click="handleSubmit">
                提交
            </el-button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElTooltip, ElDivider, ElMessageBox } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import { HotTable } from '@handsontable/vue3'
import { registerAllModules } from 'handsontable/registry'
import { zhCN, registerLanguageDictionary } from 'handsontable/i18n'
import 'handsontable/dist/handsontable.full.css'
import { getTaskFillingData, saveDraft, submitTable, withdrawTable, restoreTable, checkSubTaskOverdue } from '../api/task'

registerAllModules()
registerLanguageDictionary(zhCN)

const route = useRoute()
const router = useRouter()
const linkCode = computed(() => route.query.link as string || '')

const hotTableRef = ref<any>(null)
const taskInfo = reactive({
    taskId: '',
    taskName: '',
    taskDeadline: '',
    fillingStatus: '',
    formDescription: ''
})
const overdueInfo = reactive({
    isOverdue: false,
    overduePermission: false
})
const headingLevel = ref<'h1' | 'h2'>('h2')
const showDivider = ref(true)

// ======================
// 核心状态
// ======================
const originalHeaders = ref<string[]>([])
const tableData = ref<any[][]>([])
const permissions = reactive({
    row: {
        addable: false,
        deletable: false,
        sortable: false
    },
    columns: []
})
const tableKey = ref(0)
const errors = ref<{ [key: string]: string }>({})
const validationErrorCount = computed(() => Object.keys(errors.value).length)

// ======================
// 辅助函数
// ======================
const copyTaskId = async (textToCopy: string) => { /* 保持原逻辑 */
    if (!textToCopy) return
    try {
        await navigator.clipboard.writeText(textToCopy)
        ElMessage.success({ message: "任务编号已成功复制到剪贴板！", duration: 1000 })
    } catch (err) {
        const textarea = document.createElement("textarea")
        textarea.value = textToCopy
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
        ElMessage.success({ message: "任务编号已成功复制到剪贴板！", duration: 1000 })
    }
}
const formatDate = (d: string) => { /* 保持原逻辑 */
    if (!d) return ''
    return new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
const getFillingStatusType = () => {
    if (taskInfo.fillingStatus === 'submitted') return 'success'
    if (taskInfo.fillingStatus === 'returned') return 'danger'
    return 'warning'
}
const getFillingStatusText = () => {
    if (taskInfo.fillingStatus === 'submitted') return '已提交'
    if (taskInfo.fillingStatus === 'returned') return '已退回'
    return '填报中'
}
// 辅助函数：只提取日期部分 (YYYY/MM/DD)，不显示时间
const formatDateSimple = (val: string | number | Date) => {
    if (!val) return ''
    const d = new Date(val)
    if (isNaN(d.getTime())) return val // 如果解析失败，原样返回
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const permissionTooltipContent = computed(() => {
    const REGEX_LABEL_MAP: Record<string, string> = {
        'phone': '手机号',
        'idcard': '身份证号',
        'email': '邮箱',
        'url': '网址',
        'custom': '自定义格式'
    }

    let content = '<div style="max-width: 450px; line-height: 1.6;">'

    // 1. 列权限部分
    content += '<h4 style="margin-top: 0; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 4px;">列填报规则：</h4>'
    content += '<ul style="margin: 0; padding-left: 20px; font-size: 13px;">'

    if (originalHeaders.value.length === 0) {
        content += '<li style="color: #999;">暂无列权限信息</li>'
    } else {
        originalHeaders.value.forEach((header, index) => {
            const colPerm = permissions.columns[index] || {}
            const rules = [] // 用于收集该列的所有规则

            // --- 基础权限 ---
            if (!colPerm.editable) {
                rules.push('<span style="color: #f56c6c;">不可编辑</span>') // 红色强调
            } else {
                rules.push('可编辑')
            }

            if (colPerm.required) {
                rules.push('<span style="color: #e6a23c;">必填</span>') // 橙色强调
            } else if (colPerm.editable) {
                rules.push('选填')
            }

            // --- 详细校验规则 ---
            const v = colPerm.validation || {}

            if (v.type === 'number') {
                let numDesc = v.isInteger ? '整数' : '数字'

                if (v.min != null && v.max != null) {
                    numDesc += ` (范围: ${v.min} - ${v.max})`
                } else if (v.min != null) {
                    numDesc += ` (最小 ${v.min})`
                } else if (v.max != null) {
                    numDesc += ` (最大 ${v.max})`
                }
                rules.push(numDesc)
            }
            else if (v.type === 'text') {
                if (v.maxLength) rules.push(`最多 ${v.maxLength} 字符`)
            }
            else if (v.type === 'date') {
                let dateDesc = '日期'
                if (v.format) dateDesc += ` (格式: ${v.format})`

                const minStr = formatDateSimple(v.min)
                const maxStr = formatDateSimple(v.max)

                if (minStr && maxStr) {
                    dateDesc += `，范围: ${minStr} 至 ${maxStr}`
                } else if (minStr) {
                    dateDesc += `，最早 ${minStr}`
                } else if (maxStr) {
                    dateDesc += `，最晚 ${maxStr}`
                }
                rules.push(dateDesc)
            }
            else if (v.type === 'options' && Array.isArray(v.options)) {
                // 如果选项太多，可以截断显示，防止弹窗过长
                const optionsStr = v.options.join(' / ')
                rules.push(`选项: [${optionsStr}]`)
            }
            else if (v.type === 'regex') {
                // 这里非常关键：请检查你的后台接口返回的对象中，
                // 那个 'idcard' 字符串是放在 validation.regex 还是 validation.pattern 还是其他？
                // 假设它是存在 v.regex 字段里
                const label = REGEX_LABEL_MAP[v.regexName] || v.regexName || '特定格式';

                rules.push(`格式: ${label}`);
            }

            // 组合显示
            content += `<li><strong>${header}：</strong>${rules.join('；')}</li>`
        })
    }
    content += '</ul>'

    // 2. 行权限部分
    content += '<h4 style="margin-top: 12px; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 4px;">行操作权限：</h4>'
    content += '<ul style="margin: 0; padding-left: 20px; font-size: 13px;">'
    content += `<li style="${permissions.row.addable ? '' : 'color: #999;'}">${permissions.row.addable ? '✅ 允许' : '🚫 禁止'} 新增行</li>`
    content += `<li style="${permissions.row.deletable ? '' : 'color: #999;'}">${permissions.row.deletable ? '✅ 允许' : '🚫 禁止'} 删除行</li>`
    content += `<li style="${permissions.row.sortable ? '' : 'color: #999;'}">${permissions.row.sortable ? '✅ 允许' : '🚫 禁止'} 调整行顺序</li>`
    content += '</ul></div>'

    return content
})

// ======================
// 校验逻辑
// ======================
function getValidationError(value: any, perm: any): string | null {
    if (!perm) return null
    let v = value == null ? '' : String(value).trim()
    const { required, validation = {} } = perm
    const { type, min, max, isInteger, options, regex, maxLength, format } = validation

    if (required && v === '') return '该字段为必填项'
    if (v == null || v === '') return null

    if (type === 'text' && maxLength && v.length > maxLength) return `最多允许 ${maxLength} 个字符`
    else if (type === 'number') {
        const num = Number(v)
        if (isNaN(num)) return '必须为数字'
        if (isInteger && !Number.isInteger(num)) return '必须为整数'
        if (min != null && num < min) return `不能小于 ${min}`
        if (max != null && num > max) return `不能大于 ${max}`
    }
    else if (type === 'date') {
        // 简单的日期格式修正
        if (format === 'yyyy年mm月dd日') {
            const match = v.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
            if (match) v = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
        const d = new Date(v)
        if (isNaN(d.getTime())) return '日期格式不正确'
        if (min && d < new Date(min)) return `不能早于 ${new Date(min).toLocaleDateString()}`
        if (max && d > new Date(max)) return `不能晚于 ${new Date(max).toLocaleDateString()}`
    }
    else if (type === 'options' && options && !options.includes(v)) return `只能填写：${options.join(' / ')}`
    else if (type === 'regex' && regex && !new RegExp(regex).test(v)) return '格式不正确'
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

    // 1. 基础行数限制
    minRows: 1,
    // 2. 权限控制：如果没权限新增，锁死 maxRows；如果有权限，设为 undefined (由下方 beforePaste 控制粘贴不扩展)
    maxRows: permissions.row.addable ? undefined : Math.max(tableData.value.length, 1),

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
    copyPaste: {
        pasteMode: 'overwrite'
    },
    manualRowMove: permissions.row.sortable,

    contextMenu: {
        items: {
            'row_above': { name: '在上方插入单行', hidden: () => !permissions.row.addable },
            'row_below': { name: '在下方插入单行', hidden: () => !permissions.row.addable },
            // --- 新增：批量插入行 ---
            'add_multiple_rows': {
                name: '批量插入多行...',
                hidden: () => !permissions.row.addable,
                callback: function (key, selection) {
                    const hot = this;
                    const startRow = selection[0].start.row;

                    // 统一定义执行逻辑，避免重复代码
                    const executeInsert = (countStr: string) => {
                        const count = parseInt(countStr);
                        if (count > 0) {
                            hot.alter('insert_row_below', startRow, count);
                            // 这里不需要写填充逻辑，因为 alter 会自动触发 afterCreateRow 钩子
                        }
                        ElMessageBox.close(); // 执行完后关闭弹窗
                    };

                    ElMessageBox({
                        title: '批量增加行',
                        message: () => h('div', null, [
                            h('p', { style: 'margin-bottom: 10px' }, '请输入要增加的行数：'),
                            h('div', { class: 'quick-add-btns', style: 'display: flex; gap: 8px; margin-top: 10px' },
                                [5, 10, 20, 50].map(num => h('button', {
                                    class: 'el-button el-button--small el-button--primary is-plain',
                                    // ⭐ 关键修复：点击按钮直接执行逻辑，绕过输入框状态同步问题
                                    onClick: (e: Event) => {
                                        e.preventDefault();
                                        executeInsert(String(num));
                                    }
                                }, `+${num} 行`))
                            )
                        ]),
                        showInput: true,
                        inputValue: '1',
                        inputPattern: /^[1-9]\d*$/,
                        inputErrorMessage: '请输入大于0的正整数',
                        showCancelButton: true,
                        confirmButtonText: '确定',
                        cancelButtonText: '取消',
                    }).then(({ value }) => {
                        // 这里的 value 是输入框里手动输入的数字
                        executeInsert(value);
                    }).catch(() => { });
                }
            },
            'hsep1': '---------',
            'remove_row': { name: '删除行', hidden: () => !permissions.row.deletable },
            // ... 其他菜单项 ...
        }
    },

    afterInit: function () {
        this.validateCells();
    },

    // 【核心修复 1】在此拦截粘贴，物理禁止粘贴自动扩展行
    beforePaste: function (data: any[][], coords: any[]) {
        const hot = this;
        // 只有在允许新增行时才需要手动拦截（因为不允许时 maxRows 已经拦截了）
        // 但为了逻辑统一，我们可以总是执行这个检查

        const startRow = coords[0].startRow;
        const totalRows = hot.countRows();
        const availableRows = totalRows - startRow;

        // 如果粘贴的数据行数 > 剩余可用行数
        if (data.length > availableRows) {
            // 直接截断数据数组，只保留能放得下的部分
            // splice 会修改原数组，Handsontable 接收到的将是截断后的数据
            data.splice(availableRows);

            // 可选：提示用户
            ElMessage.warning('粘贴内容超出表格行数，多余行已自动忽略，如需填写请先手动新增行。');
        }

        // 返回 true 继续执行粘贴（使用的是被裁切后的 data）
        return true;
    },

    // 核心修复后的 afterCreateRow (增强兼容性)
    afterCreateRow: function (index: number, amount: number) {
        const hot = this;
        // 1. 确定参考行：优先取新行上方的行
        let sourceRowIndex = index > 0 ? index - 1 : (index + amount < hot.countRows() ? index + amount : -1);
        if (sourceRowIndex === -1) return;

        const sourceData = hot.getDataAtRow(sourceRowIndex);
        const changes: any[] = [];

        // 2. 遍历列权限，找出不可编辑的列进行拷贝
        permissions.columns.forEach((perm, colIndex) => {
            if (perm && !perm.editable) {
                const valueToCopy = sourceData[colIndex];
                for (let i = 0; i < amount; i++) {
                    changes.push([index + i, colIndex, valueToCopy]);
                }
            }
        });

        if (changes.length > 0) {
            setTimeout(() => {
                // 使用 'auto' 源，避免死循环
                hot.setDataAtCell(changes, 'auto');

                // 3. 清理错误状态并重新校验新行
                for (let i = 0; i < amount; i++) {
                    const row = index + i;
                    permissions.columns.forEach((_, col) => {
                        delete errors.value[`${row},${col}`];
                    });
                    // 逐行异步校验，确保红框消失
                    hot.validateRow(row, () => { });
                }
            }, 50);
        }
    },

    afterValidate: function (isValid: boolean, value: any, row: number, prop: number | string) {
        const col = typeof prop === 'string' ? this.propToCol(prop) : prop;
        const key = `${row},${col}`;

        // 使用 shallow copy 触发 Vue 响应式更新
        if (isValid) {
            if (key in errors.value) {
                const newErrors = { ...errors.value };
                delete newErrors[key];
                errors.value = newErrors;
            }
        } else {
            const perm = permissions.columns[col];
            const errorMsg = getValidationError(value, perm);
            if (errorMsg) {
                // 只有当错误信息确实变化时才更新，减少渲染压力
                if (errors.value[key] !== errorMsg) {
                    errors.value = { ...errors.value, [key]: errorMsg };
                }
            }
        }
    },

    afterRemoveRow: function () {
        const hot = this;
        errors.value = {};
        setTimeout(() => {
            hot.validateCells();
        }, 50);
    },

    afterRowMove: function () {
        const hot = this;
        errors.value = {};
        setTimeout(() => {
            hot.validateCells();
        }, 50);
    }
}))

// ======================
// 监听权限 (作为热更新的补充)
// ======================
watch(() => permissions.row, (newRowPermissions) => {
    const hotInstance = hotTableRef.value?.hotInstance
    if (hotInstance) {
        hotInstance.updateSettings({
            contextMenu: {
                items: {
                    'row_above': { name: '在上方插入行', hidden: () => !newRowPermissions.addable },
                    'row_below': { name: '在下方插入行', hidden: () => !newRowPermissions.addable },
                    'hsep1': '---------',
                    'remove_row': { name: '删除行', hidden: () => !newRowPermissions.deletable },
                    'hsep2': '---------',
                    'undo': { name: '撤销' },
                    'redo': { name: '重做' }
                }
            },
            manualRowMove: newRowPermissions.sortable
        })
    }
}, { deep: true })

// ======================
// API交互 (保持不变)
// ======================
const fetchTableData = async () => {
    if (!linkCode.value) { router.push('/error'); return }
    try {
        const response = await getTaskFillingData(linkCode.value)
        if (!response || !response.headers || !response.tableData) { router.push('/error'); return }

        taskInfo.taskId = response.taskId || ''
        taskInfo.taskName = response.taskName || ''
        taskInfo.taskDeadline = response.taskDeadline || ''
        taskInfo.fillingStatus = response.fillingStatus || ''
        taskInfo.formDescription = response.formDescription || ''

        originalHeaders.value = response.headers || []
        tableData.value = response.tableData || []

        const rowPermissions = response.permissions?.row || { addable: false, deletable: false, sortable: false }
        permissions.row.addable = rowPermissions.addable
        permissions.row.deletable = rowPermissions.deletable
        permissions.row.sortable = rowPermissions.sortable
        permissions.columns = response.permissions?.columns || []

        tableKey.value++
    } catch (error) {
        router.push('/error')
    }
}

const handleSaveDraft = async () => { /* ...保持原样... */
    if (!linkCode.value) return;
    try {
        const hot = hotTableRef.value.hotInstance;
        await saveDraft(linkCode.value, hot.getData());
        ElMessage.success('暂存成功');
    } catch (e) { ElMessage.error('暂存失败'); }
}

const handleSubmit = async () => { /* ...保持原样... */
    if (!linkCode.value) return;
    try {
        const hot = hotTableRef.value.hotInstance;
        await submitTable(linkCode.value, hot.getData());
        ElMessage.success('提交成功');
        await fetchTableData();
    } catch (e) { ElMessage.error('提交失败'); }
}

const handleRestore = async () => { /* ...保持原样... */
    try {
        await restoreTable(linkCode.value);
        ElMessage.success('还原成功');
        setTimeout(() => window.location.reload(), 700);
    } catch (e) { ElMessage.error('还原失败'); }
}
const handleWithdraw = async () => { /* ...保持原样... */
    try {
        await withdrawTable(linkCode.value);
        ElMessage.success('撤回成功');
        taskInfo.fillingStatus = 'in_progress';
    } catch (e) { ElMessage.error('撤回失败'); }
}

const fetchOverdueStatus = async () => {
    if (!linkCode.value) return
    try {
        const response = await checkSubTaskOverdue(linkCode.value)
        overdueInfo.isOverdue = response.status === 'overdue'
        overdueInfo.overduePermission = response.overdue_permission
    } catch (error) { console.error(error) }
}

const canSubmit = computed(() => validationErrorCount.value === 0)

onMounted(async () => {
    await fetchTableData()
    await fetchOverdueStatus()
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

:deep(.quick-add-btns) {
    .el-button {
        margin-right: 8px;
        padding: 5px 12px;
    }
}

/* 确保 Handsontable 弹出菜单不被遮挡 */
:deep(.htContextMenu) {
    z-index: 3000 !important;
}
</style>