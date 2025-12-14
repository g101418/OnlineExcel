<template>
  <div class="outer-container">
    <Header />
    <div class="view">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import Header from "./components/Header.vue";
</script>

<style scoped>
.outer-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
.app-header {
  flex: 0 0 auto;
  width: 100%;
  height: 72px;
  box-sizing: border-box;
}
.view {
  flex: 1 1 auto;
  width: 85%;
  margin: 0 auto;
  padding: 0;
  min-height: 0; /* 确保内容过多时能正常滚动 */
}
</style>
