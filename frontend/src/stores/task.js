import { defineStore } from 'pinia'

// 状态持久化相关常量
const STORAGE_KEY = 'online-excel-task'
const MAX_LOCAL_STORAGE_SIZE = 4 * 1024 * 1024 // 4MB，与文件上传限制保持一致

// 检查localStorage是否有足够空间
const hasEnoughStorage = (data) => {
  try {
    const dataSize = new Blob([JSON.stringify(data)]).size
    // 预留10%的空间用于其他数据
    return dataSize < MAX_LOCAL_STORAGE_SIZE * 0.9
  } catch (error) {
    console.error('Storage size check failed:', error)
    return false
  }
}

// 从本地存储加载状态
const loadState = () => {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY)
    return savedState ? JSON.parse(savedState) : null
  } catch (error) {
    console.error('Failed to load state from localStorage:', error)
    return null
  }
}

// 保存状态到本地存储
export const saveState = (state) => {
  try {
    const stateToSave = {
      taskId: state.taskId,
      fileName: state.fileName,
      taskName: state.taskName,
      taskDeadline: state.taskDeadline,
      uploadedHeaders: state.uploadedHeaders,
      uploadedData: state.uploadedData,
      splitEnabled: state.splitEnabled,
      selectedHeader: state.selectedHeader,
      split: state.split,
      header: state.header,
      splitData: state.splitData,
      tableLinks: state.tableLinks,
      permissions: state.permissions,
      permissionPanelCollapsed: state.permissionPanelCollapsed,
      progress: state.progress
    }
    
    // 检查存储空间
    if (!hasEnoughStorage(stateToSave)) {
      console.warn('LocalStorage space exceeded, state not saved')
      return false
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    return true
  } catch (error) {
    console.error('Failed to save state to localStorage:', error)
    return false
  }
}

import { permissionDict, applyPermissionsToTable, getDefaultPermissions } from '../hooks/tablePermission';

export const useTaskStore = defineStore('task', {
  state: () => {
    // 从本地存储加载状态，如果没有则使用默认状态
    const savedState = loadState()
    return savedState || {
      // 任务信息
      taskId: '',
      fileName: '',
      taskName: '',
      taskDeadline: null,
      
      // 上传的数据
      uploadedHeaders: [],
      uploadedData: [],
      
      // 拆分相关信息
      splitEnabled: false,
      selectedHeader: '',
      split: false,
      header: '',
      
      // 拆分后的表格数据
      splitData: [],
      
      // 生成的表格链接
      tableLinks: [],
      
      // 权限设置
      permissions: getDefaultPermissions(),
      
      // 面板折叠状态
      permissionPanelCollapsed: false,
      
      // 处理进度状态
      // 可选值: 'generation' (在任务生成页), 'condition' (在条件设置页), 'release' (在任务发布页)
      progress: 'generation'
    }
  },
  
  getters: {
    // 获取任务是否存在
    hasTask: (state) => !!state.taskId,
    
    // 获取是否有上传数据
    hasUploadedData: (state) => state.uploadedData.length > 0,
    
    // 获取拆分后的表格数量
    splitTablesCount: (state) => state.splitData.length,
    
    // 获取列权限设置
    columnPermissions: (state) => state.permissions.columns
  },
  
  actions: {
    // 设置任务信息
    setTaskInfo(taskId, fileName) {
      this.taskId = taskId
      this.fileName = fileName
      // 保存状态到本地存储
      saveState(this.$state)
    },
    
    // 设置上传的数据
    setUploadedData(headers, data) {
      this.uploadedHeaders = headers
      this.uploadedData = data
      // 保存状态到本地存储
      saveState(this.$state)
    },
    
    // 清除上传的数据
    clearUploadedData() {
      this.uploadedHeaders = []
      this.uploadedData = []
      // 保存状态到本地存储
      saveState(this.$state)
    },
    
    // 设置拆分相关信息
    setSplitInfo(splitEnabled, selectedHeader = '') {
      this.splitEnabled = splitEnabled
      this.selectedHeader = selectedHeader
      // 保存状态到本地存储
      saveState(this.$state)
    },
    
    // 执行表格拆分
    doSplit() {
      if (!this.selectedHeader || this.uploadedData.length === 0) return
      
      // 找到选择的表头对应的索引
      const headerIndex = this.uploadedHeaders.indexOf(this.selectedHeader)
      if (headerIndex === -1) return
      
      // 按照选择的字段对数据进行分组
      const groupedData = {}
      this.uploadedData.forEach(row => {
        const key = row[headerIndex] // 使用索引获取值
        if (!groupedData[key]) {
          groupedData[key] = []
        }
        groupedData[key].push(row)
      })
      
      // 将分组后的数据转换为拆分后的表格格式
      this.splitData = Object.keys(groupedData).map(key => ({
        sheetName: `${this.selectedHeader}_${key}`,
        data: groupedData[key],
        headers: this.uploadedHeaders
      }))
      
      this.split = true
      this.header = this.selectedHeader
      // 保存状态到本地存储
      saveState(this.$state)
    },
    
    // 设置列权限
    setColumnPermissions(columns) {
      this.permissions.columns = columns
      // 保存状态到本地存储
      saveState(this.$state)
    },
    
    // 为特定表格应用权限设置
    applyPermissionsToTable(tableData, columns) {
      return applyPermissionsToTable(tableData, columns, this.permissions)
    },
    
    // 设置表格链接
    setTableLinks(links) {
      this.tableLinks = links
      // 保存状态到本地存储
      saveState(this.$state)
    },
    
    // 设置任务名称
    setTaskName(taskName) {
      this.taskName = taskName
      // 保存状态到本地存储
      saveState(this.$state)
    },
    
    // 设置任务截止日期
    setTaskDeadline(taskDeadline) {
      this.taskDeadline = taskDeadline
      // 保存状态到本地存储
      saveState(this.$state)
    },
    
    // 清除所有任务数据
    clearAll() {
      this.taskId = ''
      this.fileName = ''
      this.taskName = ''
      this.taskDeadline = null
      this.uploadedHeaders = []
      this.uploadedData = []
      this.splitEnabled = false
      this.selectedHeader = ''
      this.split = false
      this.header = ''
      this.splitData = []
      this.tableLinks = []
      this.permissions = getDefaultPermissions()
      this.progress = 'generation'
      // 清除本地存储中的数据
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.error('Failed to clear state from localStorage:', error)
      }
    }
  }
})
