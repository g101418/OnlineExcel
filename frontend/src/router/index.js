import { createWebHistory, createRouter } from "vue-router";

import Home from "../views/Home.vue";
import TaskGeneration from "../views/TaskGeneration.vue";
import TaskCondition from "../views/TaskCondition.vue";
import TaskRelease from "../views/TaskRelease.vue";


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

export default router;