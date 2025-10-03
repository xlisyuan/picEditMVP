<script setup lang="ts">
import { defineProps, computed, watch } from 'vue';
import { useLayers } from '../composables/useLayer';
import type { Layer } from '../composables/useLayer'; // 修正：使用 import type 導入 Layer 介面

const props = defineProps<{
  layer: Layer;
}>();

// 引入所有必要的狀態和操作函式
const { 
  focusedLayerId, 
  setFocus, 
  updateLayerPosition, 
  draggingLayerId, 
  setDragging,
  isKeyboardMoving // <-- 關鍵：導入鍵盤移動狀態
} = useLayers();

// 判斷當前圖層是否為焦點
const isFocused = computed(() => focusedLayerId.value === props.layer.id);

// 計算屬性：判斷當前圖層是否正在被拖曳 (滑鼠)
const isDragging = computed(() => draggingLayerId.value === props.layer.id);

// 計算屬性：判斷圖層是否處於任何移動狀態 (滑鼠拖曳 或 鍵盤移動)
const isMoving = computed(() => isDragging.value || isKeyboardMoving.value); // <-- 結合兩種狀態

// --- 拖曳邏輯 ---
// --- 替換 startDrag 函式：確保只有被選中的圖層才能被拖曳 ---
const startDrag = (event: MouseEvent) => {
    // 檢查點擊的目標是否在圖層元素內部，以確保不是點擊邊緣的拖曳手柄
    setFocus(props.layer.id);
    event.preventDefault();

    let lastX = event.clientX;
    let lastY = event.clientY;
    let moved = false; 
    const threshold = 5; 

    // 只有當前圖層被選中時，才設置拖曳狀態
    // 雖然 setFocus 已經執行，但這裡的檢查是確保邏輯清晰
    if (focusedLayerId.value !== props.layer.id) {
        return; // 應該不會發生，但作為防禦性編程
    }

    setDragging(props.layer.id);

    const onDragging = (moveEvent: MouseEvent) => {
        // 確保我們拖曳的是當前焦點圖層
        if (focusedLayerId.value !== props.layer.id) {
            return stopDrag(); // 如果焦點被某種方式切換了，立即停止拖曳
        }

        const deltaX = moveEvent.clientX - lastX;
        const deltaY = moveEvent.clientY - lastY;

        // 只有移動超過閾值才視為真正的拖曳
        if (!moved && (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold)) {
            moved = true;
        }

        // 真正移動時才更新位置
        if (moved) {
            updateLayerPosition(props.layer.id, deltaX, deltaY);
        }

        lastX = moveEvent.clientX;
        lastY = moveEvent.clientY;
    };

    const stopDrag = () => {
        document.removeEventListener('mousemove', onDragging);
        document.removeEventListener('mouseup', stopDrag);
        
        // 停止拖曳狀態
        setDragging(null);
        
        // 如果滑鼠沒有移動超過閾值，則不會有位置歪掉的問題
    };

    document.addEventListener('mousemove', onDragging);
    document.addEventListener('mouseup', stopDrag);
};
</script>

<template>
  <div 
    class="layer-item"
    :class="{ 
        'is-focused': isFocused, 
        'is-moving': isMoving // <-- 使用 isMoving 來套用半透明效果
    }" 
    :style="{ 
      left: `${layer.x}px`, 
      top: `${layer.y}px`, 
      zIndex: layer.zIndex,
      width: `${layer.width}px`,
      height: `${layer.height}px`,
    }"
    @mousedown="startDrag"
  >
    <!-- 圖片內容 -->
    <img :src="layer.url" alt="圖層內容" class="layer-image" />
    <!-- Focus 指示器 -->
    <div v-if="isFocused" class="focus-indicator"></div>
  </div>
</template>

<style scoped>
.layer-item {
  position: absolute;
  cursor: grab;
  transition: opacity 0.1s; /* 只保留 opacity 過渡效果 */
  user-select: none;
  border-radius: 0; /* 移除圓角以利拼接 */
  box-sizing: border-box; 
}

.layer-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none; /* 讓點擊事件穿透圖片 */
}

/* 焦點狀態 */
.is-focused {
  /* 為了拼接目的，僅保留一個極細的邊框來標示焦點，但不使用陰影 */
  /* border: 1px solid #42b883;  */
  cursor: grabbing;
}

/* 統一的移動狀態樣式 (包含鍵盤和滑鼠拖曳) */
.layer-item.is-moving { 
    /* 測試用樣式，用於確認狀態啟用 */
    /* border: 1px solid red;  */
    opacity: 0.7 !important; /* 應用半透明效果 */
    cursor: grabbing; 
}

.focus-indicator {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    box-shadow: 0 0 0 2px #42b883; 
}
</style>
