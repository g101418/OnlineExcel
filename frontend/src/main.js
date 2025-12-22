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

const app = createApp(App)
const pinia = createPinia()

app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.use(pinia)

app.use(VxeUIBase).use(VxeUITable)

app.mount('#app')
