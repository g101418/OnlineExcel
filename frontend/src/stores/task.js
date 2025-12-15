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
    if (savedState) {
      const parsedState = JSON.parse(savedState)
      // 如果是旧格式（单任务），转换为新格式（多任务）
      if (parsedState.taskId && !parsedState.tasks) {
        // 确保单个任务有完整的permissions对象
        if (!parsedState.permissions) {
          parsedState.permissions = getDefaultPermissions()
        }
        return {
          tasks: [parsedState],
          currentTaskId: parsedState.taskId
        }
      }
      // 确保所有任务都有完整的permissions对象
      if (parsedState.tasks) {
        parsedState.tasks = parsedState.tasks.map(task => {
          if (!task.permissions) {
            task.permissions = getDefaultPermissions()
          }
          return task
        })
      }
      return parsedState
    }
    return null
  } catch (error) {
    console.error('Failed to load state from localStorage:', error)
    return null
  }
}

// 保存状态到本地存储
export const saveState = (state) => {
  try {
    const stateToSave = {
      tasks: state.tasks,
      currentTaskId: state.currentTaskId
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
      // 任务列表，每个任务包含完整的任务数据结构
      tasks: [],
      // 当前活动任务的ID
      currentTaskId: ''
    }
  },
  
  getters: {
    // 获取当前任务
    currentTask: (state) => state.tasks.find(task => task.taskId === state.currentTaskId),
    
    // 获取任务是否存在
    hasTask: (state) => !!state.currentTaskId,
    
    // 获取是否有上传数据
    hasUploadedData: (state) => {
      const currentTask = state.tasks.find(task => task.taskId === state.currentTaskId)
      return currentTask ? currentTask.uploadedData.length > 0 : false
    },
    
    // 获取拆分后的表格数量
    splitTablesCount: (state) => {
      const currentTask = state.tasks.find(task => task.taskId === state.currentTaskId)
      return currentTask ? currentTask.splitData.length : 0
    },
    
    // 获取列权限设置
    columnPermissions: (state) => {
      const currentTask = state.tasks.find(task => task.taskId === state.currentTaskId)
      return currentTask ? currentTask.permissions.columns : []
    },
    
    // 获取所有历史任务
    allTasks: (state) => state.tasks
  },
  
  actions: {
    // 创建新任务
createTask(taskId, fileName) {
  // 检查是否已存在相同ID的任务
  const existingTaskIndex = this.tasks.findIndex(task => task.taskId === taskId)
  if (existingTaskIndex !== -1) {
    // 如果存在，更新为当前任务
    this.currentTaskId = taskId
    // 确保现有任务有默认权限
    if (!this.tasks[existingTaskIndex].permissions) {
      this.tasks[existingTaskIndex].permissions = getDefaultPermissions()
    }
  } else {
    // 创建新任务
    const newTask = {
      // 任务信息
      taskId,
      fileName,
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
      progress: 'generation'
    }
    this.tasks.push(newTask)
    this.currentTaskId = taskId
  }
  // 保存状态到本地存储
  saveState(this.$state)
},
    
    // 设置当前任务
    setCurrentTask(taskId) {
      this.currentTaskId = taskId
      saveState(this.$state)
    },
    
    // 获取任务
    getTask(taskId) {
      return this.tasks.find(task => task.taskId === taskId)
    },
    
    // 设置上传的数据
    setUploadedData(headers, data) {
      const currentTask = this.tasks.find(task => task.taskId === this.currentTaskId)
      if (currentTask) {
        currentTask.uploadedHeaders = headers
        currentTask.uploadedData = data
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 清除上传的数据
    clearUploadedData() {
      const currentTask = this.tasks.find(task => task.taskId === this.currentTaskId)
      if (currentTask) {
        currentTask.uploadedHeaders = []
        currentTask.uploadedData = []
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 设置拆分相关信息
    setSplitInfo(splitEnabled, selectedHeader = '') {
      const currentTask = this.tasks.find(task => task.taskId === this.currentTaskId)
      if (currentTask) {
        currentTask.splitEnabled = splitEnabled
        currentTask.selectedHeader = selectedHeader
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 执行表格拆分
    doSplit() {
      const currentTask = this.tasks.find(task => task.taskId === this.currentTaskId)
      if (!currentTask || !currentTask.selectedHeader || currentTask.uploadedData.length === 0) return
      
      // 找到选择的表头对应的索引
      const headerIndex = currentTask.uploadedHeaders.indexOf(currentTask.selectedHeader)
      if (headerIndex === -1) return
      
      // 按照选择的字段对数据进行分组
      const groupedData = {}
      currentTask.uploadedData.forEach(row => {
        const key = row[headerIndex] // 使用索引获取值
        if (!groupedData[key]) {
          groupedData[key] = []
        }
        groupedData[key].push(row)
      })
      
      // 将分组后的数据转换为拆分后的表格格式
      currentTask.splitData = Object.keys(groupedData).map(key => ({
        sheetName: `${currentTask.selectedHeader}_${key}`,
        data: groupedData[key],
        headers: currentTask.uploadedHeaders
      }))
      
      currentTask.split = true
      currentTask.header = currentTask.selectedHeader
      // 保存状态到本地存储
      saveState(this.$state)
    },
    
    // 设置列权限
    setColumnPermissions(columns) {
      const currentTask = this.tasks.find(task => task.taskId === this.currentTaskId)
      if (currentTask) {
        // 确保permissions对象存在且完整
        if (!currentTask.permissions) {
          currentTask.permissions = getDefaultPermissions()
        }
        currentTask.permissions.columns = columns
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 保存完整的权限设置
    savePermissions(permissions) {
      const currentTask = this.tasks.find(task => task.taskId === this.currentTaskId)
      if (currentTask) {
        currentTask.permissions = permissions
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 设置行权限
    setRowPermissions(rowPermissions) {
      const currentTask = this.tasks.find(task => task.taskId === this.currentTaskId)
      if (currentTask) {
        // 确保permissions对象存在且完整
        if (!currentTask.permissions) {
          currentTask.permissions = getDefaultPermissions()
        }
        currentTask.permissions.row = rowPermissions
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 为特定表格应用权限设置
    applyPermissionsToTable(tableData, columns) {
      const currentTask = this.tasks.find(task => task.taskId === this.currentTaskId)
      if (currentTask) {
        return applyPermissionsToTable(tableData, columns, currentTask.permissions)
      }
      return tableData
    },
    
    // 设置表格链接
    setTableLinks(links) {
      const currentTask = this.tasks.find(task => task.taskId === this.currentTaskId)
      if (currentTask) {
        currentTask.tableLinks = links
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 设置任务名称
    setTaskName(taskName) {
      const currentTask = this.tasks.find(task => task.taskId === this.currentTaskId)
      if (currentTask) {
        currentTask.taskName = taskName
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 设置任务截止日期
    setTaskDeadline(taskDeadline) {
      const currentTask = this.tasks.find(task => task.taskId === this.currentTaskId)
      if (currentTask) {
        currentTask.taskDeadline = taskDeadline
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 设置进度状态
    setProgress(progress) {
      const currentTask = this.tasks.find(task => task.taskId === this.currentTaskId)
      if (currentTask) {
        currentTask.progress = progress
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 删除任务
    deleteTask(taskId) {
      const taskIndex = this.tasks.findIndex(task => task.taskId === taskId)
      if (taskIndex !== -1) {
        this.tasks.splice(taskIndex, 1)
        // 如果删除的是当前任务，清除currentTaskId
        if (this.currentTaskId === taskId) {
          this.currentTaskId = ''
        }
        // 保存状态到本地存储
        saveState(this.$state)
        return true
      }
      return false
    },
    
    // 清除所有任务数据
    clearAll() {
      this.tasks = []
      this.currentTaskId = ''
      // 清除本地存储中的数据
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.error('Failed to clear state from localStorage:', error)
      }
    }
  }
})
