import { createWebHistory, createRouter } from "vue-router";

import Home from "../views/Home.vue";
import TaskGeneration from "../views/TaskGeneration.vue";
import TaskCondition from "../views/TaskCondition.vue";
import TaskRelease from "../views/TaskRelease.vue";
import ErrorPage from "../views/ErrorPage.vue";
import TableFilling from "../views/TableFilling.vue";
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
    {
        path: "/table-filling",
        name: "TableFilling",
        component: TableFilling,
    },
];


const router = createRouter({
    history: createWebHistory(),
    routes,
});

// 等待store初始化完成的函数
const waitForStoreInit = async (taskStore) => {
    // 如果已经初始化，直接返回
    if (taskStore.isInitialized) return;
    
    // 检查是否已经有初始化Promise
    if (window.__storeInitPromise__) {
        await window.__storeInitPromise__;
        return;
    }
    
    // 否则使用轮询方式，但设置最大等待时间
    return new Promise((resolve, reject) => {
        let checkCount = 0;
        const maxChecks = 50; // 最大检查50次，共5秒
        
        const checkInit = () => {
            checkCount++;
            if (taskStore.isInitialized) {
                resolve();
            } else if (checkCount >= maxChecks) {
                console.warn('Store初始化超时，继续导航');
                resolve(); // 超时后仍继续导航，避免无限等待
            } else {
                // 每100毫秒检查一次
                setTimeout(checkInit, 100);
            }
        };
        checkInit();
    });
};

// 添加路由导航守卫
router.beforeEach(async (to, from, next) => {
    // 特殊处理TableFilling页面，直接允许访问
    if (to.name === 'TableFilling') {
        next();
        return;
    }
    
    // 获取task store
    const taskStore = useTaskStore();
    
    // 等待store初始化完成
    await waitForStoreInit(taskStore);
    
    // 检查是否有taskId参数
    const taskId = to.query.taskId;
    
    if (taskId) {
        // 找到对应的任务
        const task = taskStore.tasks.find(t => t.taskId === taskId);
        
        // 特殊处理TaskRelease页面，允许访问即使本地没有任务信息
        if (!task && to.name !== 'TaskRelease' && to.name !== 'TableFilling') {
            // 任务不存在且不是访问TaskRelease页面，跳转到错误页面
            next({ name: 'Error' });
            return;
        }
        
        // 严格控制TaskGeneration和TaskCondition页面的访问
        if (task && to.name === 'TaskGeneration' && task.progress !== 'generation') {
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
        
        if (task && to.name === 'TaskCondition' && task.progress !== 'condition') {
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