<template>
  <el-header class="app-header">
    <div class="container">
      <router-link to="/" class="brand">
        <img :src="logo" alt="logo" class="logo" />
        <span class="app-title">在线表格填报工具</span>
      </router-link>
      <div class="header-spacer"></div>
    </div>
  </el-header>
</template>

<script setup>
import logo from "../assets/logo.png";
</script>

<style scoped>
.app-header {
  width: 100%;
  height: 72px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: #ffffff;
  border-bottom: 1px solid #e6eef6;
}

.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-spacer {
  flex: 1;
}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;
  text-decoration: none;
}

.logo {
  width: 48px;
  height: 48px;
  display: block;
}

.app-title {
  font-size: 24px;
  color: #111827;
  font-weight: 700;
}

@media (max-width: 480px) {
  .app-header {
    height: 64px;
  }

  .logo {
    width: 40px;
    height: 40px;
  }

  .app-title {
    font-size: 16px;
  }
}
</style>
