<script setup lang="ts">
import { defineProps, computed } from 'vue';
import { useLayers } from '../composables/useLayer';
import type { Layer } from '../composables/useLayer';

const props = defineProps<{
  layer: Layer;
  scale?: number; // 新增：接收 canvasScale
}>();

const {
  focusedLayerId,
  setFocus,
  updateLayerPosition,
  draggingLayerId,
  setDragging,
  isKeyboardMoving
} = useLayers();

// 判斷當前圖層是否為焦點
const isFocused = computed(() => focusedLayerId.value === props.layer.id);

// 計算屬性：判斷當前圖層是否正在被拖曳 (滑鼠)
const isDragging = computed(() => draggingLayerId.value === props.layer.id);

// 計算屬性：判斷圖層是否處於任何移動狀態 (滑鼠拖曳 或 鍵盤移動)
const isMoving = computed(() => isDragging.value || isKeyboardMoving.value); // <-- 結合兩種狀態

// --- 拖曳邏輯（考慮縮放） ---
const startDrag = (event: MouseEvent) => {
  setFocus(props.layer.id);
  event.preventDefault();

  let lastX = event.clientX;
  let lastY = event.clientY;

  if (focusedLayerId.value !== props.layer.id) {
    return;
  }

  setDragging(props.layer.id);

  // 立即進行一次位置更新（避免延遲）
  // 這裡 delta 為 0，僅為一致性，實際拖曳時才會有移動
  updateLayerPosition(props.layer.id, 0, 0);

  const onDragging = (moveEvent: MouseEvent) => {
    if (focusedLayerId.value !== props.layer.id) {
      return stopDrag();
    }

    // 拖曳時考慮縮放
    const scale = props.scale ?? 1;
    const deltaX = (moveEvent.clientX - lastX) / scale;
    const deltaY = (moveEvent.clientY - lastY) / scale;

    updateLayerPosition(props.layer.id, deltaX, deltaY);

    lastX = moveEvent.clientX;
    lastY = moveEvent.clientY;
  };

  const stopDrag = () => {
    document.removeEventListener('mousemove', onDragging);
    document.removeEventListener('mouseup', stopDrag);
    setDragging(null);
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
        'is-moving': isMoving
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
    <img :src="layer.url" alt="圖層內容" class="layer-image" />
    <div v-if="isFocused" class="focus-indicator"></div>
  </div>
</template>

<style scoped>
.layer-item {
  position: absolute;
  cursor: grab;
  transition: opacity 0.1s;
  user-select: none;
  border-radius: 0;
  box-sizing: border-box;
}

.layer-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.is-focused {
  cursor: grabbing;
}

.layer-item.is-moving {
    opacity: 0.7 !important;
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
