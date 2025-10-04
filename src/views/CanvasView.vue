<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useLayers } from "../composables/useLayer";
import LayerItem from "../components/LayerItem.vue";

// 畫布縮放與平移狀態
const canvasScale = ref(1);
const canvasOffset = ref({ x: 0, y: 0 });
const minScale = 0.2;
const maxScale = 5;

// 引用畫布區域 DOM 元素，用於導出
const canvasAreaRef = ref<HTMLElement | null>(null);
// 導出狀態
const isExporting = ref(false);

const {
  layers,
  focusedLayerId,
  updateLayerPosition,
  addLayer,
  setFocus,
  bringToFront,
  sendToBack,
  moveLayerUp,
  moveLayerDown,
  setKeyboardMoving,
  contentBounds,
  deleteLayer,
} = useLayers();

// --- 滾輪縮放 ---
const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey) return; // 保留瀏覽器縮放
  if (!canvasAreaRef.value) return;
  // 僅在canvas區域內觸發
  e.preventDefault();
  const scaleStep = 0.1;
  const prevScale = canvasScale.value;
  const nextScale = Math.max(
    minScale,
    Math.min(maxScale, prevScale + (e.deltaY < 0 ? scaleStep : -scaleStep))
  );
  if (nextScale === prevScale) return;

  // 以滑鼠為中心縮放
  const rect = canvasAreaRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  canvasOffset.value.x =
    (canvasOffset.value.x - mouseX) * (nextScale / prevScale) + mouseX;
  canvasOffset.value.y =
    (canvasOffset.value.y - mouseY) * (nextScale / prevScale) + mouseY;
  canvasScale.value = nextScale;
};

// --- 中鍵拖曳平移 ---
let isMiddleDragging = false;
let lastDrag = { x: 0, y: 0 };

const handleMouseDown = (e: MouseEvent) => {
  if (e.button === 1) {
    isMiddleDragging = true;
    lastDrag = { x: e.clientX, y: e.clientY };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    e.preventDefault();
  }
};
const handleMouseMove = (e: MouseEvent) => {
  if (!isMiddleDragging) return;
  canvasOffset.value.x += e.clientX - lastDrag.x;
  canvasOffset.value.y += e.clientY - lastDrag.y;
  lastDrag = { x: e.clientX, y: e.clientY };
};
const handleMouseUp = (e: MouseEvent) => {
  if (e.button === 1) {
    isMiddleDragging = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }
};

// --- 貼上圖片處理（考慮縮放與平移） ---

const handlePaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && item.type.indexOf("image") !== -1) {
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const url = e.target?.result as string;

          const img = new Image();
          img.onload = () => {
            // 使用圖片的原始尺寸作為圖層尺寸
            const width = img.width;
            const height = img.height;

            // 將圖片貼在畫布中央（考慮目前縮放與平移）
            if (canvasAreaRef.value) {
              const rect = canvasAreaRef.value.getBoundingClientRect();
              const centerX = rect.width / 2;
              const centerY = rect.height / 2;
              // 反推實際座標
              const x =
                (centerX - canvasOffset.value.x) / canvasScale.value -
                width / 2;
              const y =
                (centerY - canvasOffset.value.y) / canvasScale.value -
                height / 2;
              addLayer(url, width, height, x, y);
            } else {
              addLayer(url, width, height);
            }
          };
          img.src = url;
        };
        reader.readAsDataURL(file);
        event.preventDefault();
      }
    }
  }
};

// --- 圖片導出處理 (Export) ---

const exportCanvas = async () => {
  // 1. 檢查元素和 html2canvas 是否可用
  if (!canvasAreaRef.value) {
    console.error("Canvas area not found.");
    return;
  }

  const h2c = (window as any).html2canvas;
  if (typeof h2c !== "function") {
    console.error("導出失敗：html2canvas 函式庫尚未載入。");
    return;
  }

  // 檢查是否有內容
  const bounds = contentBounds.value;
  if (layers.value.length === 0 || bounds.width <= 0 || bounds.height <= 0) {
    console.warn("畫布上沒有可導出的內容。");
    return;
  }

  // 2. 執行導出
  isExporting.value = true;
  setFocus(null);

  // 這裡宣告在 try 外
  const contentEl = canvasAreaRef.value.querySelector(
    ".canvas-content"
  ) as HTMLElement;
  const oldTransform = contentEl ? contentEl.style.transform : "";

  try {
    if (contentEl) contentEl.style.transform = "none";

    const canvas = await h2c(contentEl, {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.width,
      height: bounds.height,
      scrollX: -bounds.minX,
      scrollY: -bounds.minY,
      ignoreElements: (element: Element) => {
        return element.classList.contains("focus-indicator");
      },
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#333",
    });

    // 3. 轉換為 WebP 格式 (品質 90%)
    const dataURL = canvas.toDataURL("image/webp", 0.9);

    // 4. 觸發下載
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `vue-collage-export-${Date.now()}.webp`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log("圖片導出成功 (WEBP 格式)");
  } catch (error) {
    console.error("Export failed:", error);
    console.error(
      "圖片導出失敗：請確保所有圖片都允許跨域存取，或改用本機貼上圖片。"
    );
  } finally {
    // 這裡就能正確還原
    if (contentEl) contentEl.style.transform = oldTransform;
    isExporting.value = false;
  }
};

// --- 鍵盤事件處理 ---

// 用來追蹤目前是否有 WASD/方向鍵被按下，避免重複設定狀態
const pressedKeys = new Set<string>();

const handleKeydown = (event: KeyboardEvent) => {
  const id = focusedLayerId.value;

  // --- 1. 處理刪除鍵 (Delete / Backspace) ---
  if (event.key === "Delete" || event.key === "Backspace") {
    if (id) {
      deleteLayer(id);
    }
    event.preventDefault(); // 防止瀏覽器預設行為
    return; // 處理完刪除後立即退出
  }

  if (!id) return;

  // 定義 WASD 鍵作為位置移動鍵
  const isPositionalMoveKey = ["KeyW", "KeyA", "KeyS", "KeyD"].includes(
    event.code
  );

  if (isPositionalMoveKey) {
    // --- 1. WASD 定位移動 (Positional Movement) ---
    // Shift 鍵按下為 10px (快速移動)，否則為 1px (精細移動)
    const moveStep = event.shiftKey ? 10 : 1;
    let moved = false;

    if (event.code === "KeyW") {
      updateLayerPosition(id, 0, -moveStep);
      moved = true;
    } else if (event.code === "KeyS") {
      updateLayerPosition(id, 0, moveStep);
      moved = true;
    } else if (event.code === "KeyA") {
      updateLayerPosition(id, -moveStep, 0);
      moved = true;
    } else if (event.code === "KeyD") {
      updateLayerPosition(id, moveStep, 0);
      moved = true;
    }

    // 設定鍵盤移動狀態 (只在第一次按下時設定)
    if (moved) {
      if (!pressedKeys.has(event.code)) {
        setKeyboardMoving(true);
        pressedKeys.add(event.code);
      }
      event.preventDefault(); // 阻止頁面滾動
    }
  } else if (["ArrowUp", "ArrowDown"].includes(event.code)) {
    // --- 2. ArrowUp/Down 調整層級 (Z-Index) ---
    // 嚴格檢查，排除其他修飾鍵，除非是 Alt (用於置頂/置底)

    if (event.altKey) {
      // Alt + Up/Down: 置頂/置底
      if (event.code === "ArrowUp") {
        bringToFront(id);
      } else if (event.code === "ArrowDown") {
        sendToBack(id);
      }
    } else if (!event.shiftKey && !event.ctrlKey) {
      // 單純 Up/Down: 上/下一層
      if (event.code === "ArrowUp") {
        moveLayerUp(id);
      } else if (event.code === "ArrowDown") {
        moveLayerDown(id);
      }
    }
    event.preventDefault(); // 阻止頁面滾動/預設行為
  } else if (event.altKey && ["KeyF", "KeyB"].includes(event.code)) {
    // --- 3. 額外的 Alt + F/B 置頂置底快捷鍵 ---
    if (event.code === "KeyF") {
      bringToFront(id);
    } else if (event.code === "KeyB") {
      sendToBack(id);
    }
    event.preventDefault();
  }
};

const handleKeyup = (event: KeyboardEvent) => {
  // 移除已放開的鍵
  if (pressedKeys.has(event.code)) {
    pressedKeys.delete(event.code);
  }

  // 只有 WASD 才需要追蹤狀態，因為它們是唯一的位置移動鍵
  const isAnyMoveKeyStillPressed = ["KeyW", "KeyA", "KeyS", "KeyD"].some(
    (code) => pressedKeys.has(code)
  );

  if (!isAnyMoveKeyStillPressed) {
    setKeyboardMoving(false);
  }
};

// --- 監聽器設置 ---

onMounted(() => {
  // 確保 html2canvas 函式庫載入
  const script = document.createElement("script");
  script.src =
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
  document.head.appendChild(script);

  document.addEventListener("paste", handlePaste);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keyup", handleKeyup);
  if (canvasAreaRef.value) {
    canvasAreaRef.value.addEventListener("wheel", handleWheel, {
      passive: false,
    });
    canvasAreaRef.value.addEventListener("mousedown", handleMouseDown);
  }
});
onUnmounted(() => {
  document.removeEventListener("paste", handlePaste);
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("keyup", handleKeyup);
  if (canvasAreaRef.value) {
    canvasAreaRef.value.removeEventListener("wheel", handleWheel);
    canvasAreaRef.value.removeEventListener("mousedown", handleMouseDown);
  }
});

// 點擊畫布空白處時，清除焦點
const handleClickCanvas = (event: MouseEvent) => {
  // 檢查點擊目標是否為畫布容器本身 (canvas-area)
  if (event.target === event.currentTarget) {
    setFocus(null); // 取消所有圖層的焦點
  }
};
</script>

<template>
  <div class="app-wrapper">
    <div class="controls">
      <!-- 導出按鈕 -->
      <button
        @click="exportCanvas"
        :disabled="isExporting || layers.length === 0"
        :class="{ 'export-button': true, exporting: isExporting }"
      >
        {{ isExporting ? "導出中..." : "🖼️ 導出為 WEBP (內容邊界)" }}
      </button>

      <div class="instructions">
        位置移動: Shift + WASD (單次移動 10px) | 上下圖層: Alt + ↑/↓ (置頂/置底) | delete 刪除圖層
      </div>
    </div>

    <div class="canvas-container">
      <!-- 綁定 ref="canvasAreaRef" 以供導出函式使用 -->
      <div
        class="canvas-area"
        ref="canvasAreaRef"
        @click="handleClickCanvas"
        style="overflow: hidden; position: relative"
      >
        <div
          class="canvas-content"
          :style="{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            position: 'absolute',
            left: 0,
            top: 0,
          }"
        >
          <!-- 在 canvas-content 最前面加一個透明底層 -->
          <div
            style="
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              height: 100%;
              z-index: 0;
            "
            @click="handleClickCanvas"
          ></div>

          <!-- 渲染所有圖層 -->
          <LayerItem
            v-for="layer in layers"
            :key="layer.id"
            :layer="layer"
            :scale="canvasScale"
            @click.stop
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 佈局修正：將間距設置在 app-wrapper 上，避免內部元素寬度溢出 */
.app-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 20px; /* 整體邊距 */
}

.controls {
  padding: 0 0 15px 0; /* 移除水平 padding，只保留底部間距 */
  width: 100%;
  text-align: left;
  display: flex;
  gap: 10px;
  align-items: center;
}

.export-button {
  padding: 10px 15px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s, opacity 0.2s;
}

.export-button:hover:not(:disabled) {
  background-color: #2980b9;
}

.export-button:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
  opacity: 0.7;
}

/* 樣式修正：還原 instructions 的背景色 */
.instructions {
  font-size: 0.85rem;
  color: #666;
  background-color: #ccc;
  padding: 8px;
  border-radius: 6px;
  flex-grow: 1;
}

/* 樣式修正：確保 canvas-container 響應式並使用正確的背景色 */
.canvas-container {
  position: relative;
  width: 100%; /* 確保填滿 app-wrapper 內部的寬度 */
  height: 80vh; /* 保持固定高度 */
  overflow: hidden;
  background-color: #333;
  border-radius: 12px;
  margin: 0; /* 移除所有邊距，防止與 app-wrapper 的 padding 衝突造成跑版 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.canvas-area {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
