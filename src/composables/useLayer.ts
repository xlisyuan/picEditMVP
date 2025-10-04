import { ref, computed } from 'vue';
import type { Ref } from 'vue';

// 圖層的介面型別定義
export interface Layer {
	id: number;
	url: string;
	x: number;
	y: number;
	zIndex: number;
	width: number;
	height: number;
}

// 響應式狀態
const layers: Ref<Layer[]> = ref([]);
const focusedLayerId: Ref<number | null> = ref(null);
const draggingLayerId: Ref<number | null> = ref(null); 
const isKeyboardMoving: Ref<boolean> = ref(false); // <-- 新增：鍵盤移動狀態
let nextLayerId = 1;

// --- Computed 屬性 (優化計算邏輯，避免遞歸) ---

// 計算當前圖層中的最大 zIndex
const maxZIndex = computed(() => {
	if (layers.value.length === 0) return 0;
	let maxZ = -Infinity;
	for (const layer of layers.value) {
		if (layer.zIndex > maxZ) {
			maxZ = layer.zIndex;
		}
	}
	return maxZ;
});

// 計算當前圖層中的最小 zIndex
const minZIndex = computed(() => {
    if (layers.value.length === 0) return 0;
    let minZ = Infinity;
    for (const layer of layers.value) {
      if (layer.zIndex < minZ) {
        minZ = layer.zIndex;
      }
    }
    return minZ;
});

// 計算所有圖層的最小內容邊界 (Content Bounding Box)
const contentBounds = computed(() => {
    if (layers.value.length === 0) {
        return { minX: 0, minY: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const layer of layers.value) {
        minX = Math.min(minX, layer.x);
        minY = Math.min(minY, layer.y);
        maxX = Math.max(maxX, layer.x + layer.width);
        maxY = Math.max(maxY, layer.y + layer.height);
    }
    
    // 計算邊界框的寬度和高度
    const width = maxX - minX;
    const height = maxY - minY;

    return { 
        minX: minX, 
        minY: minY, 
        width: width, 
        height: height 
    };
});


// --- 核心操作函式 ---

// 新增圖層 (用於 Ctrl+V 貼上)
// 支援指定 x, y 位置
const addLayer = (
    url: string,
    width: number,
    height: number,
    x: number = 50,
    y: number = 50
) => {
    const newLayer: Layer = {
        id: nextLayerId++,
        url,
        x,
        y,
        zIndex: maxZIndex.value + 1, // 確保新圖層在最上層
        width,
        height,
    };
    layers.value.push(newLayer);
    focusedLayerId.value = newLayer.id;
}

// 更新圖層位置 (deltaX, deltaY 為位移量)
const updateLayerPosition = (id: number, deltaX: number, deltaY: number) => {
	const layer = layers.value.find(l => l.id === id);
	if (layer) {
		layer.x += deltaX;
		layer.y += deltaY;
	}
};

// 設定當前焦點 ID
const setFocus = (id: number | null) => {
	focusedLayerId.value = id;
};

// 設定拖曳狀態 ID
const setDragging = (id: number | null) => {
	draggingLayerId.value = id;
};

// 設定鍵盤移動狀態 (新增)
const setKeyboardMoving = (isMoving: boolean) => {
	isKeyboardMoving.value = isMoving;
};

const deleteLayer = (id: number) => {
    const index = layers.value.findIndex(l => l.id === id);
    if (index !== -1) {
        layers.value.splice(index, 1);
        if (focusedLayerId.value === id) {
            focusedLayerId.value = null; // 清除焦點
        }
    }
};

// --- 圖層排序函式 ---

// 置頂 (Alt + ArrowUp)
const bringToFront = (id: number) => {
	const layer = layers.value.find(l => l.id === id);
	if (layer) {
		layer.zIndex = maxZIndex.value + 1;
	}
};

// 置底 (Alt + ArrowDown)
const sendToBack = (id: number) => {
    const layer = layers.value.find(l => l.id === id);
    if (layer) {
        layer.zIndex = minZIndex.value - 1; 
    }
};

// 向上移動一層 (ArrowUp)
const moveLayerUp = (id: number) => {
    const currentLayer = layers.value.find(l => l.id === id);
    if (!currentLayer) return;

    // 獲取並排序所有唯一的 zIndex
    const zIndices = layers.value.map(l => l.zIndex).sort((a, b) => a - b);
    const uniqueZIndices = [...new Set(zIndices)];
    
    const currentIndex = uniqueZIndices.indexOf(currentLayer.zIndex);
    
    if (currentIndex < uniqueZIndices.length - 1) {
        // nextZIndex 必定存在，使用非空斷言 '!'
        const nextZIndex = uniqueZIndices[currentIndex + 1]!; 
        
        // 找到所有位於目標 zIndex 的圖層 (layersToSwap)
        const layersToSwap = layers.value.filter(l => l.zIndex === nextZIndex);
        
        // 1. 將目標層降級到當前層的 zIndex
        layersToSwap.forEach(l => {
            l.zIndex = currentLayer.zIndex;
        });

        // 2. 將當前層升級到 nextZIndex
        currentLayer.zIndex = nextZIndex; 
    }
};

// 向下移動一層 (ArrowDown)
const moveLayerDown = (id: number) => {
    const currentLayer = layers.value.find(l => l.id === id);
    if (!currentLayer) return;

    const zIndices = layers.value.map(l => l.zIndex).sort((a, b) => a - b);
    const uniqueZIndices = [...new Set(zIndices)];
    
    const currentIndex = uniqueZIndices.indexOf(currentLayer.zIndex);
    
    if (currentIndex > 0) {
        // prevZIndex 必定存在，使用非空斷言 '!'
        const prevZIndex = uniqueZIndices[currentIndex - 1]!; 
        
        // 找到所有位於目標 zIndex 的圖層 (layersToSwap)
        const layersToSwap = layers.value.filter(l => l.zIndex === prevZIndex);

        // 1. 將目標層升級到當前層的 zIndex
        layersToSwap.forEach(l => {
            l.zIndex = currentLayer.zIndex;
        });
        
        // 2. 將當前層降級到 prevZIndex
        currentLayer.zIndex = prevZIndex;
    }
};


// --- 導出函式 ---
export function useLayers() {
	return {
		layers,
		focusedLayerId,
		draggingLayerId,
		isKeyboardMoving, // <-- 導出鍵盤移動狀態
    contentBounds, // <-- 導出內容邊界
		addLayer,
		updateLayerPosition,
		setFocus,
		setDragging,
		setKeyboardMoving, // <-- 導出 Setter
		bringToFront,
		sendToBack,
		moveLayerUp,
		moveLayerDown,
    deleteLayer,
		maxZIndex,
		minZIndex
	};
}
