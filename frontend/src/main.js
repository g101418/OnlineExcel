import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { createPinia } from 'pinia'

const app = createApp(App)
const pinia = createPinia()

app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.use(pinia)

app.mount('#app')
