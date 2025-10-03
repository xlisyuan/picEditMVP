<script setup lang="ts">
import CanvasView from './views/CanvasView.vue'; 
</script>

<template>
  <div id="app-root">
    <header class="app-header">
      <h1>🚀 Vue Canvas Editor</h1>
      <p>貼上圖片 (Ctrl+V) 後，使用 WASD/拖曳 位移, 上/下鍵 移動圖層。</p>
    </header>
    <CanvasView />
  </div>
</template>

<style>
/* 這裡放全域樣式 */
#app{
  width: 100%;
}
#app-root {
  font-family: 'Inter', Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 0;
  padding: 0;
  min-height: 100vh;
  background-color: #eee;
}

.app-header {
  padding: 20px;
  border-bottom: 1px solid #ccc;
  margin-bottom: 20px;
}

.app-header h1 {
  font-size: 1.8rem;
  font-weight: 700;
  color: #34495e;
}

.app-header p {
  font-size: 0.9rem;
  color: #7f8c8d;
  margin-top: 5px;
}
</style>
