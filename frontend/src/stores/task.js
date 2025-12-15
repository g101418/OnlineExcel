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
          tasks: [parsedState]
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
      // 移除旧的currentTaskId字段
      if (parsedState.currentTaskId) {
        delete parsedState.currentTaskId
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
      tasks: state.tasks
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
      tasks: []
    }
  },
  
  getters: {
    // 获取所有历史任务
    allTasks: (state) => state.tasks
  },
  
  actions: {
    // 创建新任务
createTask(taskId, fileName) {
  // 检查是否已存在相同ID的任务
  const existingTaskIndex = this.tasks.findIndex(task => task.taskId === taskId)
  const now = new Date().toLocaleString('zh-CN')
  if (existingTaskIndex !== -1) {
    // 如果存在，确保现有任务有默认权限
    if (!this.tasks[existingTaskIndex].permissions) {
      this.tasks[existingTaskIndex].permissions = getDefaultPermissions()
    }
    // 更新任务时间
    this.tasks[existingTaskIndex].updateTime = now
  } else {
    // 创建新任务
    const newTask = {
      // 任务信息
      taskId,
      fileName,
      taskName: '',
      taskDeadline: null,
      updateTime: now,
      
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
  }
  // 保存状态到本地存储
  saveState(this.$state)
},
    

    
    // 获取任务
    getTask(taskId) {
      return this.tasks.find(task => task.taskId === taskId)
    },
    
    // 设置上传的数据
    setUploadedData(taskId, headers, data) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.uploadedHeaders = headers
        task.uploadedData = data
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 清除上传的数据
    clearUploadedData(taskId) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.uploadedHeaders = []
        task.uploadedData = []
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 设置拆分相关信息
    setSplitInfo(taskId, splitEnabled, selectedHeader = '') {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.splitEnabled = splitEnabled
        task.selectedHeader = selectedHeader
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 执行表格拆分
    doSplit(taskId) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (!task || !task.selectedHeader || task.uploadedData.length === 0) return
      
      // 找到选择的表头对应的索引
      const headerIndex = task.uploadedHeaders.indexOf(task.selectedHeader)
      if (headerIndex === -1) return
      
      // 按照选择的字段对数据进行分组
      const groupedData = {}
      task.uploadedData.forEach(row => {
        const key = row[headerIndex] // 使用索引获取值
        if (!groupedData[key]) {
          groupedData[key] = []
        }
        groupedData[key].push(row)
      })
      
      // 将分组后的数据转换为拆分后的表格格式
      task.splitData = Object.keys(groupedData).map(key => ({
        sheetName: `${task.selectedHeader}_${key}`,
        data: groupedData[key],
        headers: task.uploadedHeaders
      }))
      
      task.split = true
      task.header = task.selectedHeader
      // 保存状态到本地存储
      saveState(this.$state)
    },
    
    // 设置列权限
    setColumnPermissions(taskId, columns) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        // 确保permissions对象存在且完整
        if (!task.permissions) {
          task.permissions = getDefaultPermissions()
        }
        task.permissions.columns = columns
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 保存完整的权限设置
    savePermissions(taskId, permissions) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.permissions = permissions
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 设置行权限
    setRowPermissions(taskId, rowPermissions) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        // 确保permissions对象存在且完整
        if (!task.permissions) {
          task.permissions = getDefaultPermissions()
        }
        task.permissions.row = rowPermissions
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 为特定表格应用权限设置
    applyPermissionsToTable(taskId, tableData, columns) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        return applyPermissionsToTable(tableData, columns, task.permissions)
      }
      return tableData
    },
    
    // 设置表格链接
    setTableLinks(taskId, links) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.tableLinks = links
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 设置任务名称
    setTaskName(taskId, taskName) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.taskName = taskName
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 设置任务截止日期
    setTaskDeadline(taskId, taskDeadline) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.taskDeadline = taskDeadline
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 设置进度状态
    setProgress(taskId, progress) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.progress = progress
        // 保存状态到本地存储
        saveState(this.$state)
      }
    },
    
    // 删除任务
    deleteTask(taskId) {
      const taskIndex = this.tasks.findIndex(task => task.taskId === taskId)
      if (taskIndex !== -1) {
        this.tasks.splice(taskIndex, 1)
        // 保存状态到本地存储
        saveState(this.$state)
        return true
      }
      return false
    },
    
    // 清除所有任务数据
    clearAll() {
      this.tasks = []
      // 清除本地存储中的数据
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.error('Failed to clear state from localStorage:', error)
      }
    }
  }
})
