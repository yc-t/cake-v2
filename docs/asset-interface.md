# 花型資產介面規格

來源：`Rose.tsx` / `Hydrangea.tsx` / `Peony.tsx` / `FivePetal.tsx` / `flowerNormalize.ts` / `DragManager.tsx`（提取日：2026-07-16）

**現有程式碼已強制** = 違反時渲染錯誤、顏色失效或花位歪斜（程式不一定 crash，但行為必定錯誤）
**建議但未強制** = 違反時視覺或效能降級，程式繼續執行

---

## 1. 檔案格式與路徑

- GLB 二進位格式，路徑 `public/models/{type}.glb`，`{type}` 與 `FlowerType` 字串完全相符（大小寫敏感） — **現有程式碼已強制**（各 component 寫死 `useGLTF('/models/rose.glb')` 等）
- 新花型須同時新增三處：`types.ts` 的 `FlowerType` union、獨立 component 檔、`FlowerTray.tsx` 的 switch case；缺一則新花型不渲染 — **現有程式碼已強制**

## 2. 幾何結構

- 所有可見幾何須掛在 `THREE.Mesh` 節點；`traverse()` 只對 `instanceof THREE.Mesh` 的節點指派顏色，Lines / Points / Sprite 等節點無法受色彩控制 — **現有程式碼已強制**
- 每個 Mesh 的 `material` 屬性須是單一 `Material` 物件，不可是 `Material[]`；程式以 `child.material as THREE.MeshStandardMaterial` 處理，多材質槽 mesh 的 map 清除與顏色指派會靜默失效 — **現有程式碼已強制**（不崩潰但材質控制失效）
- 每個 Mesh 的 `geometry` 須有 `POSITION` attribute；`Box3.setFromObject` 與 density stem mode 都直接讀取頂點位置 — **現有程式碼已強制**（欠缺時 bbox 為 empty，normalizeFlower 以 fallback scale=1 輸出，花尺寸不正確）
- 模型整體須有實質 XZ 截面（`Math.max(size.x, size.z) > 0`）；全零 bbox 時 normalizeFlower 以 `|| 1` fallback，尺寸歸一化失效 — **現有程式碼已強制**（以 fallback 方式繼續執行）

## 3. 朝向

- 載入後（含所有節點 transform 套用後）花朵的「上方」須是 +Y 方向；`normalizeFlower` 以 `box.min.y` 為花底、`Math.max(size.x, size.z)` 為直徑；Y 若非垂直軸，直徑量測與花底吸附均錯誤 — **現有程式碼已強制**
- Root node rotation 為 −90° X（Sketchfab Z-up→Y-up 慣例）可正確運作：`normalizeFlower` 先呼叫 `root.updateMatrixWorld(true)` 再用 `Box3.setFromObject` 取世界座標 bbox，旋轉已展開進去 — **現有程式碼已強制**（rose / hydrangea 即此情況）
- Root node 若帶**任意複合旋轉**（非 −90° X），程式僅對節點名稱為 `'Sketchfab_model'` 或 `'GLTF_SceneRootNode'` 的節點清除旋轉（Peony 特例）；其他名稱的複合旋轉不會被清除，花方向錯誤 — **現有程式碼已強制**（節點名稱不符則修正失效，需美術預先整理 GLB）

## 4. 正規化後的原點保證

- `normalizeFlower` 執行後強制把花底（`contactY`）平移到 Y=0；呼叫方（各 component）不需額外平移 — **現有程式碼已強制**（輸出保證）
- XZ 中心偏移**不會**被 `normalizeFlower` 修正；XZ 偏心的模型正規化後仍偏心，擺上蛋糕時花相對於吸附點歪斜 — **建議但未強制**（FivePetal 程式生成有 XZ 置中；GLB 載入路徑無此步驟）

## 5. 材質

- Rose / Hydrangea：程式對 `child.material` 呼叫 `.clone()` 再清除 `map`、`metalnessMap`、`roughnessMap`，設 `metalness=0`、`roughness=0.7`；原始材質須為可 clone 的 Three.js 內建材質（MeshStandardMaterial 等） — **現有程式碼已強制**
- Peony：程式對所有 Mesh 直接換成全新 `new THREE.MeshStandardMaterial({ metalness:0, roughness:0.7 })`；原模型所有材質屬性均丟棄，原材質型別無限制 — **現有程式碼已強制**
- `normalMap`、`emissiveMap`、`aoMap` 不會被清除（rose 的 normalMap 刻意保留）；新模型若帶有不想要的 emissive / AO 貼圖，須由美術在 GLB 內移除 — **建議但未強制**
- 薄平面幾何（如花瓣）的 `side` 屬性不會被強制設定（僅 FivePetal 程式生成使用 `DoubleSide`）；單面幾何的背面在某些視角會透明 — **建議但未強制**

## 6. 換色介面

- 換色輸入為單一 `color: [number, number, number]`（線性 RGB，範圍 0–1），套用至模型內**所有** Mesh 的 `material.color.setRGB()`；無 per-mesh / per-petal 顏色槽，全模型同色 — **現有程式碼已強制**
- ADR D5 提及的 `colorInner / colorOuter` 雙色槽**尚未實作**；目前所有花型只有一個顏色輸入 — **建議但未強制**（未來擴充用，現在加額外 mesh 分組也無法利用）

## 7. 效能

- 每朵花 mesh 數建議 ≤ 30（hydrangea 現況 254 mesh，draw calls 開銷大，不重處理不建議直接使用） — **建議但未強制**
- 每朵花三角形數建議 ≤ 15,000（rose ≈ 7,400 tris 為參考基準；30 朵 rose 級 ≈ 22 萬 tris，接近 §5 效能上限） — **建議但未強制**
- 嵌入貼圖建議 ≤ 1 MB（hydrangea 貼圖 ~9 MB，首次載入壓力大） — **建議但未強制**
