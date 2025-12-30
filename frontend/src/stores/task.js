import { defineStore } from 'pinia'
import localforage from 'localforage'

// 状态持久化相关常量
const STORAGE_KEY = 'online-excel-task'

// 配置localforage
localforage.config({
  name: 'OnlineExcel',
  storeName: 'taskStore',
  description: '存储OnlineExcel应用的任务数据'
})

// 从本地存储加载状态
const loadState = async () => {
  try {
    const savedState = await localforage.getItem(STORAGE_KEY)
    if (savedState) {
      // 如果是旧格式（单任务），转换为新格式（多任务）
      if (savedState.taskId && !savedState.tasks) {
        // 确保单个任务有完整的permissions对象
        if (!savedState.permissions) {
          savedState.permissions = getDefaultPermissions()
        }
        return {
          tasks: [savedState]
        }
      }
      // 确保所有任务都有完整的permissions对象
      if (savedState.tasks) {
        savedState.tasks = savedState.tasks.map(task => {
          if (!task.permissions) {
            task.permissions = getDefaultPermissions()
          }
          return task
        })
      }
      // 移除旧的currentTaskId字段
      if (savedState.currentTaskId) {
        delete savedState.currentTaskId
      }
      return savedState
    }
    return null
  } catch (error) {
    console.error('Failed to load state from IndexedDB:', error)
    return null
  }
}

// 保存状态到本地存储 - 优化版：减少不必要的深拷贝
export const saveState = async (state) => {
  try {
    // 只保存必要的任务数据，移除临时或不必要的字段
    const stateToSave = {
      tasks: state.tasks.map(task => {
        // 浅拷贝任务对象，避免修改原始数据
        const savedTask = { ...task };
        
        // 移除可能导致序列化问题或占用大量空间的字段
        // 如果有临时数据字段，可以在这里移除
        
        return savedTask;
      })
    };
    
    await localforage.setItem(STORAGE_KEY, stateToSave);
    return true;
  } catch (error) {
    // 如果发生DataCloneError，再尝试深拷贝
    if (error.name === 'DataCloneError') {
      try {
        const stateToSave = {
          tasks: JSON.parse(JSON.stringify(state.tasks))
        };
        await localforage.setItem(STORAGE_KEY, stateToSave);
        return true;
      } catch (retryError) {
        console.error('Failed to save state to IndexedDB (even with serialization):', retryError);
        return false;
      }
    }
    console.error('Failed to save state to IndexedDB:', error);
    return false;
  }
}

import { permissionDict, applyPermissionsToTable, getDefaultPermissions } from '../hooks/tablePermission';

export const useTaskStore = defineStore('task', {
  state: () => ({
    // 任务列表，每个任务包含完整的任务数据结构
    tasks: [],
    // 初始化标志
    isInitialized: false
  }),
  
  getters: {
    // 获取所有历史任务
    allTasks: (state) => state.tasks
  },
  
  actions: {
    async initStore() {
      const savedState = await loadState()
      if (savedState) {
        this.$patch(savedState)
      }
      // 设置初始化完成标志
      this.isInitialized = true
    },
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
      formDescription: '',
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
      

      
      // 处理进度状态
      progress: 'generation'
    }
    this.tasks.push(newTask)
  }
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
      }
    },
    
    // 清除上传的数据
    clearUploadedData(taskId) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.uploadedHeaders = []
        task.uploadedData = []
      }
    },
    
    // 设置拆分相关信息
    setSplitInfo(taskId, splitEnabled, selectedHeader = '') {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.splitEnabled = splitEnabled
        task.selectedHeader = selectedHeader
        
        // 当关闭拆分时，清除所有与拆分类的相关字段
        if (!splitEnabled) {
          task.split = false
          task.header = ''
          task.splitData = []
        }
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
      }
    },
    
    // 保存完整的权限设置
    savePermissions(taskId, permissions) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.permissions = permissions
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
      }
    },
    
    // 设置任务名称
    setTaskName(taskId, taskName) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.taskName = taskName
      }
    },
    
    // 设置任务截止日期
    setTaskDeadline(taskId, taskDeadline) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.taskDeadline = taskDeadline
      }
    },
    
    // 设置填表说明
    setFormDescription(taskId, formDescription) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.formDescription = formDescription
      }
    },
    
    // 设置进度状态
    setProgress(taskId, progress) {
      const task = this.tasks.find(task => task.taskId === taskId)
      if (task) {
        task.progress = progress
      }
    },
    
    // 删除任务
    deleteTask(taskId) {
      const taskIndex = this.tasks.findIndex(task => task.taskId === taskId)
      if (taskIndex !== -1) {
        this.tasks.splice(taskIndex, 1)
        return true
      }
      return false
    },
    
    // 清除所有任务数据
    async clearAll() {
      this.tasks = []
      // 清除本地存储中的数据
      try {
        await localforage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.error('Failed to clear state from IndexedDB:', error)
      }
    }
  }
})
