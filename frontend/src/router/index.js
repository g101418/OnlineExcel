import { createWebHistory, createRouter } from "vue-router";

import Home from "../views/Home.vue";
import TaskGeneration from "../views/TaskGeneration.vue";
import TaskCondition from "../views/TaskCondition.vue";
import TaskRelease from "../views/TaskRelease.vue";
import ErrorPage from "../views/ErrorPage.vue";
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
    {
        path: "/error",
        name: "Error",
        component: ErrorPage,
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
    
    // 检查是否有taskId参数
    const taskId = to.query.taskId;
    
    if (taskId) {
        // 找到对应的任务
        const task = taskStore.tasks.find(t => t.taskId === taskId);
        
        if (!task) {
            // 任务不存在，跳转到错误页面
            next({ name: 'Error' });
            return;
        }
        
        // 严格控制TaskGeneration和TaskCondition页面的访问
        if (to.name === 'TaskGeneration' && task.progress !== 'generation') {
            // 当前任务进度不是generation，不允许访问TaskGeneration页面
            if (task.progress === 'condition') {
                next({ name: 'TaskCondition', query: { taskId } });
            } else if (task.progress === 'release') {
                next({ name: 'TaskRelease', query: { taskId } });
            } else {
                next({ name: 'Error' });
            }
            return;
        }
        
        if (to.name === 'TaskCondition' && task.progress !== 'condition') {
            // 当前任务进度不是condition，不允许访问TaskCondition页面
            if (task.progress === 'generation') {
                next({ name: 'TaskGeneration', query: { taskId } });
            } else if (task.progress === 'release') {
                next({ name: 'TaskRelease', query: { taskId } });
            } else {
                next({ name: 'Error' });
            }
            return;
        }
        
        // 检查进度状态和当前路由
        if (task && task.progress === 'release' && (to.name === 'TaskGeneration' || to.name === 'TaskCondition')) {
            // 如果进度为release，且当前要跳转到generation或condition，则重定向到release
            next({ name: 'TaskRelease', query: { taskId } });
        } else {
            // 其他情况正常跳转
            next();
        }
    } else {
        // 没有taskId参数，正常跳转
        next();
    }
});

export default router;