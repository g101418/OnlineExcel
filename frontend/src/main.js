import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { createPinia } from 'pinia'


import VxeUIBase from 'vxe-pc-ui'
import 'vxe-pc-ui/es/style.css'

import VxeUITable from 'vxe-table'
import 'vxe-table/es/style.css'

// 导入任务存储
import { useTaskStore } from './stores/task'

const app = createApp(App)
const pinia = createPinia()

app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.use(pinia)

app.use(VxeUIBase).use(VxeUITable)

// 初始化存储
async function initStore() {
  const taskStore = useTaskStore()
  await taskStore.initStore()
}

// 保存初始化Promise到全局，供路由守卫使用
const storeInitPromise = initStore()
window.__storeInitPromise__ = storeInitPromise

// 先初始化存储，然后挂载应用
storeInitPromise.then(() => {
  app.mount('#app')
})
