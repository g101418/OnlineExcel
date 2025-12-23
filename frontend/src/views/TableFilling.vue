<template>
    <div class="table-filling-root">
        <div class="task-info-section">
            <FormDescriptionDialog />
            <PermissionDialog />
            <component :is="headingLevel" class="task-title">{{ taskInfo.taskName || '表格填报任务' }}</component>
            <div class="meta">
                <p v-if="taskInfo.taskName"><strong>任务名称：</strong>{{ taskInfo.taskName }}</p>
                <p>
                    <strong>任务编号：</strong>
                    <el-tooltip content="点击复制任务编号" placement="top">
                        <span class="copy-clickable" @click="copyTaskId(taskInfo.taskId)">{{ taskInfo.taskId }}</span>
                    </el-tooltip>
                </p>
                <p style="margin-left: 10px;">
                    <strong>截止时间：</strong>
                    {{ formatDate(taskInfo.taskDeadline) }}
                </p>
                <p>
                    <strong>状态：</strong>
                    <el-tag :type="getFillingStatusType()" size="small">
                        {{ getFillingStatusText() }}
                    </el-tag>
                </p>
                <p style="margin-left: 10px;">
                    <strong>填表说明：</strong>
                    <el-tooltip placement="bottom" effect="light">
                        <template #content>
                            <div class="tooltip-content" style="white-space: pre-wrap; max-height: 60vh; overflow-y: auto;">{{ taskInfo.formDescription || '暂无填表说明' }}</div>
                        </template>
                        <el-icon class="permission-icon" @click="showFormDescriptionDialog">
                            <InfoFilled />
                        </el-icon>
                    </el-tooltip>
                </p>
                <p style="margin-left: 10px;">
                    <strong>权限说明：</strong>
                    <el-tooltip placement="bottom" effect="light">
                        <template #content>
                            <div class="tooltip-content" style="max-height: 60vh; overflow-y: auto;" v-html="permissionTooltipContent"></div>
                        </template>
                        <el-icon class="permission-icon" @click="showPermissionDialog">
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
                <el-alert :title="`当前有 ${validationErrorCount} 处填写错误，请检查后重试，填写要求请见填表说明和权限说明。`" type="error" show-icon :closable="false"
                    :fit-content="true" center :title-size="16" />
            </div>
        </div>
        <div class="action-buttons">
            <el-button @click="downloadTable">
                下载表格
            </el-button>
            <el-button @click="handleSaveDraft" 
                :disabled="!(taskInfo.fillingStatus === 'in_progress' || taskInfo.fillingStatus === 'returned') || (overdueInfo.isOverdue && !overdueInfo.overduePermission)">
                暂存
            </el-button>
            <el-tooltip content="将表格恢复到初始状态。" placement="top">
                <el-button @click="handleRestore" 
                    :disabled="!(taskInfo.fillingStatus === 'in_progress' || taskInfo.fillingStatus === 'returned') || (overdueInfo.isOverdue && !overdueInfo.overduePermission)">
                    还原表格
                </el-button>
            </el-tooltip>
            <el-button v-if="false" type="warning" @click="handleWithdraw" 
                :disabled="true">
                撤回
            </el-button>
            <el-tooltip content="提交后不可修改。" placement="top">
                <el-button type="primary" 
                    :disabled="!(taskInfo.fillingStatus === 'in_progress' || taskInfo.fillingStatus === 'returned') || !canSubmit || (overdueInfo.isOverdue && !overdueInfo.overduePermission)"
                    @click="handleSubmit">
                    提交
                </el-button>
            </el-tooltip>
        </div>
    </div>
</template>
<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElTooltip, ElDivider, ElMessageBox, ElLoading, ElDialog } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import { HotTable } from '@handsontable/vue3'
import { registerAllModules } from 'handsontable/registry'
import { zhCN, registerLanguageDictionary } from 'handsontable/i18n'
import * as XLSX from 'xlsx'
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-classic.min.css';
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
const copyTaskId = async (textToCopy: string) => {
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
const formatDate = (d: string) => {
    if (!d) return ''
    return new Date(d).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}
const getFillingStatusType = () => {
    if (taskInfo.fillingStatus === 'submitted') return 'success'
    if (taskInfo.fillingStatus === 'returned') return 'warning'
    if (overdueInfo.isOverdue && !overdueInfo.overduePermission) return 'danger'
    return 'primary'
}
const getFillingStatusText = () => {
    if (taskInfo.fillingStatus === 'submitted') return '已提交'
    if (taskInfo.fillingStatus === 'returned') return '已退回'
    if (overdueInfo.isOverdue && !overdueInfo.overduePermission) return '已逾期'
    return '填报中'
}

// 下载表格数据
const downloadTable = async () => {
    try {
        // 显示加载状态
        const loading = ElLoading.service({
            lock: true,
            text: '正在下载表格数据，请稍候...',
            background: 'rgba(0, 0, 0, 0.7)'
        });

        // 获取当前表格数据
        const currentData = hotTableRef.value?.hotInstance?.getData() || tableData.value;
        
        if (!currentData || currentData.length === 0) {
            ElMessage.warning("该表格没有数据");
            loading.close();
            return;
        }

        // 准备导出数据：使用originalHeaders作为表头
        const exportData = [];
        const headers = originalHeaders.value;

        // 添加表头
        if (headers.length > 0) {
            exportData.push(headers);
            // 添加所有数据行
            exportData.push(...currentData);
        } else {
            // 如果没有表头，直接导出数据
            exportData.push(...currentData);
        }

        // 创建工作表
        const worksheet = XLSX.utils.aoa_to_sheet(exportData);

        // 创建工作簿并添加工作表
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

        // 生成文件名
        const exportFileName = `${taskInfo.taskName || '表格数据'}_${new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace(/[T:]/g, "_")}.xlsx`;

        // 导出文件
        XLSX.writeFile(workbook, exportFileName, { bookType: 'xlsx' });

        // 关闭加载状态
        loading.close();

        ElMessage.success("表格下载成功");
    } catch (error) {
        console.error("表格下载失败:", error);
        ElMessage.error("表格下载失败，请稍后重试");
    }
}

const formatDateSimple = (val: string | number | Date, format: string = 'yyyy-mm-dd'): string => {
    // 空值直接返回空字符串
    if (!val) return '';

    // 处理日期对象，兼容各种输入类型
    const d = new Date(val);
    // 校验日期有效性（无效日期返回原始值）
    if (isNaN(d.getTime())) return String(val);

    // 获取补零后的年、月、日
    const year = d.getFullYear().toString();
    const month = (d.getMonth() + 1).toString().padStart(2, '0'); // 月份从0开始，需+1
    const day = d.getDate().toString().padStart(2, '0');

    // 替换format中的占位符
    return format
        .replace('yyyy', year)
        .replace('mm', month)
        .replace('dd', day);
};
const permissionTooltipContent = computed(() => {
    const REGEX_LABEL_MAP: Record<string, string> = {
        'phone': '手机号',
        'idcard': '身份证号',
        'email': '邮箱',
        'url': '网址',
        'custom': '特定格式'
    }
    let content = '<div style="max-width: 450px; line-height: 1.6;">'
    content += '<h4 style="margin-top: 0; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 4px;">列填报规则：</h4>'
    content += '<ul style="margin: 0; padding-left: 20px; font-size: 13px;">'
    if (originalHeaders.value.length === 0) {
        content += '<li style="color: #999;">暂无列权限信息</li>'
    } else {
        originalHeaders.value.forEach((header, index) => {
            const colPerm = permissions.columns[index] || {}
            const rules = []
            if (!colPerm.editable) {
                rules.push('<span style="color: #f56c6c;">不可编辑</span>')
            } else {
                rules.push('可编辑')
            }
            if (colPerm.required) {
                rules.push('<span style="color: #e6a23c;">必填</span>')
            } else if (colPerm.editable) {
                rules.push('选填')
            }
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
                const minStr = formatDateSimple(v.min, v.format)
                const maxStr = formatDateSimple(v.max, v.format)
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
                const optionsStr = v.options.join(' / ')
                rules.push(`选项: [${optionsStr}]`)
            }
            else if (v.type === 'regex') {
                const label = REGEX_LABEL_MAP[v.regexName] || v.regexName || '特定格式';
                rules.push(`格式: ${label}`);
            }
            content += `<li><strong>${header}：</strong>${rules.join('；')}</li>`
        })
    }
    content += '</ul>'
    content += '<h4 style="margin-top: 12px; margin-bottom: 8px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 4px;">行操作权限：</h4>'
    content += '<ul style="margin: 0; padding-left: 20px; font-size: 13px;">'
    content += `<li style="${permissions.row.addable ? '' : 'color: #999;'}">${permissions.row.addable ? '✅ 允许' : '🚫 禁止'} 新增行</li>`
    content += `<li style="${permissions.row.deletable ? '' : 'color: #999;'}">${permissions.row.deletable ? '✅ 允许' : '🚫 禁止'} 删除行</li>`
    content += `<li style="${permissions.row.sortable ? '' : 'color: #999;'}">${permissions.row.sortable ? '✅ 允许' : '🚫 禁止'} 调整行顺序</li>`
    content += '</ul></div>'
    return content
})

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

        if (format === 'yyyy年mm月dd日') {
            const match = v.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
            if (match) { v = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`; }
            else return '日期格式不正确'
        }
        else if (format === 'yyyy-mm-dd') {
            const match = v.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (match) { v = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`; }
            else return '日期格式不正确'
        }
        else if (format === 'yyyy/mm/dd') {
            const match = v.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
            if (match) { v = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`; }
            else return '日期格式不正确'
        }
        else if (format === 'yyyy.mm.dd') {
            const match = v.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
            if (match) { v = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`; }
            else return '日期格式不正确'
        }

        const [inputYear, inputMonth, inputDay] = v.split('-').map(Number);
        const d = new Date(inputYear, inputMonth - 1, inputDay);
        if (isNaN(d.getTime())) return '日期格式不正确'

        const parsedYear = d.getFullYear(); // 本地时区的年
        const parsedMonth = d.getMonth() + 1; // 本地时区的月（还原为1-12）
        const parsedDay = d.getDate(); // 本地时区的日

        // 6. 所有条件匹配则返回Date对象，否则返回NaN
        if (!(parsedYear === inputYear && parsedMonth === inputMonth && parsedDay === inputDay))
            return '日期输入有误'

        if (min && d < new Date(min)) return `不能早于 ${new Date(min).toLocaleDateString()}`
        if (max && d > new Date(max)) return `不能晚于 ${new Date(max).toLocaleDateString()}`
    }
    else if (type === 'options' && options && !options.includes(v)) return `只能填写：${options.join(' / ')}`
    else if (type === 'regex' && regex && !new RegExp(regex).test(v)) return '格式不正确'
    return null
}
const hotSettings = computed(() => ({
    licenseKey: 'non-commercial-and-evaluation',
    language: zhCN.languageCode,
    data: tableData.value,
    width: '100%',
    height: '62vh',
    stretchH: 'all',
    rowHeaders: true,
    colHeaders: originalHeaders.value,
    minRows: 0,
    maxRows: permissions.row.addable ? undefined : Math.max(tableData.value.length, 1),
    rowHeights: 36,
    autoWrapRow: true,
    autoWrapCol: true,
    className: 'htCenter',
    themeName: 'ht-theme-classic',
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
            'add_multiple_rows': {
                name: '批量插入多行...',
                hidden: () => !permissions.row.addable,
                callback: function (key, selection) {
                    const hot = this;
                    const startRow = selection[0].start.row;
                    const executeInsert = (countStr: string) => {
                        if (!Number.isInteger(parseFloat(countStr))) {
                            ElMessage.warning('请输入整数');
                        } else {
                            const count = parseInt(countStr);
                            if (count > 0 && count <= 300) {
                                hot.alter('insert_row_below', startRow, count);
                            } else if (count <= 0) {
                                ElMessage.warning('请输入正整数');
                            } else {
                                ElMessage.warning('一次最多只能插入300行');
                            }
                        }
                        ElMessageBox.close();
                    };
                    ElMessageBox({
                        title: '批量增加行',
                        message: () => h('div', null, [
                            h('p', { style: 'margin-bottom: 10px' }, '请输入要增加的行数（最多300行）：'),
                            h('div', { class: 'quick-add-btns', style: 'display: flex; gap: 8px; margin-top: 10px' },
                                [5, 10, 20, 50, 200].map(num => h('button', {
                                    class: 'el-button el-button--small el-button--primary is-plain',
                                    onClick: (e: Event) => {
                                        e.preventDefault();
                                        executeInsert(String(num));
                                    }
                                }, `+${num} 行`))
                            )
                        ]),
                        showInput: true,
                        inputValue: '1',
                        inputPattern: /^[1-9]\d{0,1}$|^[12]\d{2}$|^300$/,
                        inputErrorMessage: '请输入1-300之间的正整数',
                        showCancelButton: true,
                        confirmButtonText: '确定',
                        cancelButtonText: '取消',
                    }).then(({ value }) => {
                        executeInsert(value);
                    }).catch(() => { });
                }
            },
            'hsep1': '---------',
            'remove_row': { name: '删除行', hidden: () => !permissions.row.deletable },
            'hsep2': '---------',
            'undo': { name: '撤销' },
            'redo': { name: '重做' }
        }
    },
    afterInit: function () {
        this.validateCells();
    },
    beforePaste: function (data: any[][], coords: any[]) {
        const hot = this;
        const startRow = coords[0].startRow;
        const totalRows = hot.countRows();
        const availableRows = totalRows - startRow;
        if (data.length > availableRows) {
            data.splice(availableRows);
            ElMessage.warning('粘贴内容超出表格行数，多余行已自动忽略，如需填写请先手动新增行。');
        }
        return true;
    },
    afterCreateRow: function (index: number, amount: number) {
        const hot = this;
        let sourceRowIndex = index > 0 ? index - 1 : (index + amount < hot.countRows() ? index + amount : -1);
        if (sourceRowIndex === -1) return;
        const sourceData = hot.getDataAtRow(sourceRowIndex);
        const changes: any[] = [];
        permissions.columns.forEach((perm, colIndex) => {
            if (perm && !perm.editable && perm.required) {
                const valueToCopy = sourceData[colIndex];
                for (let i = 0; i < amount; i++) {
                    changes.push([index + i, colIndex, valueToCopy]);
                }
            }
        });
        if (changes.length > 0) {
            hot.setDataAtCell(changes, 'auto');
        }
        setTimeout(() => {
            errors.value = {};
            hot.validateCells();
            hot.render();
        }, 1500);
    },
    afterValidate: function (isValid: boolean, value: any, row: number, prop: number | string) {
        const col = typeof prop === 'string' ? this.propToCol(prop) : prop;
        const key = `${row},${col}`;
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
        }, 1500);
    },
    afterRowMove: function () {
        const hot = this;
        errors.value = {};
        setTimeout(() => {
            hot.validateCells();
        }, 1500);
    }
}))
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
const handleSaveDraft = async () => {
    if (!linkCode.value) return;
    try {
        const hot = hotTableRef.value.hotInstance;
        await saveDraft(linkCode.value, hot.getData());
        ElMessage.success('暂存成功');
    } catch (e) { ElMessage.error('暂存失败'); }
}
const handleSubmit = async () => {
    if (!linkCode.value) return;
    const hot = hotTableRef.value.hotInstance;
    hot.validateCells(() => {
        if (validationErrorCount.value > 0) {
            ElMessageBox.alert(`当前有 ${validationErrorCount.value} 处填写错误，请修正后重试。`, '提交失败', {
                confirmButtonText: '确定',
                type: 'error'
            });
            return;
        }
        submitTable(linkCode.value, hot.getData())
            .then(() => {
                ElMessage.success('提交成功');
                fetchTableData();
            })
            .catch(() => ElMessage.error('提交失败'));
    });
}
const handleRestore = async () => {
    try {
        await restoreTable(linkCode.value);
        ElMessage.success('还原成功');
        setTimeout(() => window.location.reload(), 700);
    } catch (e) { ElMessage.error('还原失败'); }
}
const handleWithdraw = async () => {
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

// 弹出框状态
const formDescriptionDialogVisible = ref(false)
const permissionDialogVisible = ref(false)

// 显示填表说明弹出框
const showFormDescriptionDialog = () => {
    formDescriptionDialogVisible.value = true
}

// 显示权限说明弹出框
const showPermissionDialog = () => {
    permissionDialogVisible.value = true
}

onMounted(async () => {
    await fetchTableData()
    await fetchOverdueStatus()
})

// 弹出框组件
const FormDescriptionDialog = () => h(ElDialog, {
    title: '填表说明',
    modelValue: formDescriptionDialogVisible.value,
    'onUpdate:modelValue': (value) => { formDescriptionDialogVisible.value = value },
    width: '60%',
    beforeClose: (done) => {
        done()
    }
}, {
    default: () => h('div', {
        style: {
            'max-height': '60vh',
            'overflow-y': 'auto',
            'white-space': 'pre-wrap',
            'line-height': '1.6'
        }
    }, taskInfo.formDescription || '暂无填表说明'),
    footer: () => h('div', {
        style: { 'text-align': 'right' }
    })
})

// 权限说明弹出框组件
const PermissionDialog = () => h(ElDialog, {
    title: '权限说明',
    modelValue: permissionDialogVisible.value,
    'onUpdate:modelValue': (value) => { permissionDialogVisible.value = value },
    width: '60%',
    beforeClose: (done) => {
        done()
    }
}, {
    default: () => h('div', {
        style: {
            'max-height': '60vh',
            'overflow-y': 'auto',
            'line-height': '1.6'
        },
        innerHTML: permissionTooltipContent.value
    }),
    footer: () => h('div', {
        style: { 'text-align': 'right' }
    })
})
</script>
<style scoped lang="less">
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
                &:hover {
                    opacity: 0.8;
                }
            }
            
            .tooltip-content {
                max-height: 300px;
                overflow-y: auto;
            }
        }
    }
}

.table-section {
    margin-top: 20px;
}

.table-wrapper {
    width: 100%;
    overflow-x: hidden;
}

:deep(.handsontable) {
    overflow-x: auto;
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

:deep(.htContextMenu) {
    z-index: 3000 !important;
}
</style>