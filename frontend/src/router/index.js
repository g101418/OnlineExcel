import { createWebHistory, createRouter } from "vue-router";

import Home from "../views/Home.vue";
import TaskGeneration from "../views/TaskGeneration.vue";
import TaskCondition from "../views/TaskCondition.vue";
import TaskRelease from "../views/TaskRelease.vue";
import { useTaskStore } from "../stores/task";


const routes = [
    {
        path: "/",
        name: "Home",
        component: Home,
    },
    {
        path: "/task-generation",
        name: "TaskGeneration",
        component: TaskGeneration,
    },
    {
        path: "/task-condition",
        name: "TaskCondition",
        component: TaskCondition,
    },
    {
        path: "/task-release",
        name: "TaskRelease",
        component: TaskRelease,
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

// 添加路由导航守卫
router.beforeEach((to, from, next) => {
    // 获取task store
    const taskStore = useTaskStore();
    
    // 检查进度状态和当前路由
    if (taskStore.progress === 'release' && (to.name === 'TaskGeneration' || to.name === 'TaskCondition')) {
        // 如果进度为release，且当前要跳转到generation或condition，则重定向到release
        next({ name: 'TaskRelease' });
    } else {
        // 其他情况正常跳转
        next();
    }
});

export default router;