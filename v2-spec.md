# v2-spec.md — 韓式裱花蛋糕排練工具 V2（配色升級 + 花的多樣性）

## 這是什麼
V1 的升級版。V1 讓你能把花擺到蛋糕上、調色、旋轉看、存截圖。V2 讓配色方式從「一朵一朵選」升級成「選色系、自動帶漸層」，同時增加花的種類和操控精度。目標是讓規劃出來的結果更接近你真正做得出來的蛋糕。

## 基礎：從 V1 程式碼繼續開發
本版從 V1 的 cake-v2 複製資料夾開始，不從零建立。V1 已完成的功能全部保留不動。

## V1 開發過程中的實際決定（Claude Code 必讀，避免重複踩坑）

### 花的模型
- 使用 .glb 3D 模型，不是 procedural 幾何。Procedural 做有機形狀很醜，已驗證不可行。
- 玫瑰模型：public/models/rose.glb（14,864 faces，已降面數，來自 Sketchfab Heliona CC BY）
- 繡球花模型：public/models/hydrangea.glb（55,626 faces，已降面數，來自 Sketchfab heyyodd CC BY-NC）
- 載入模型後 traverse 所有 material，把 map（貼圖）設為 null，用 material.color 設定顏色。不這樣做的話 GLB 自帶貼圖會蓋掉程式碼指定的顏色。

### 光源
- Canvas 設定 `gl={{ toneMapping: THREE.NoToneMapping }}`，否則 ACES Filmic tone mapping 會把白色壓暗。
- 環境光、方向光、半球光組合。方向光不能太強，否則亮暗面落差太大。
- 光源固定在世界座標，不跟著相機或蛋糕旋轉。

### 互動
- 花的移除功能不存在。沒有點一下跳回花盤，沒有刪除按鈕。使用者想把花從蛋糕上拿走，自己拖回花盤。
- 點一下蛋糕上的花 = 選中它（出現色票）。
- 沒有高度滑桿。沒有任何滑桿 UI（V2 會加花方向旋轉滑桿，但那是新功能）。
- OrbitControls 的 enablePan 在 V1 沒有成功啟用，V2 要修復。

### 相機
- 預設斜上 45 度
- 垂直角度限制 0°～85°
- 縮放限制 minDistance / maxDistance

### 蛋糕
- 顏色 #fafaf8（近白色），可透過色票切換
- 底盤固定純白 #ffffff，獨立於蛋糕顏色

### 花吸附
- 用 raycaster hit 的 face normal 計算花的旋轉：Quaternion.setFromUnitVectors(UP, faceNormal)
- 頂面法線 worldNormal.y > 0.9 時強制用精確的 (0,1,0) 避免浮點誤差
- 底面（法線 y < -0.9）不吸附，花回到花盤格位
- 花的底部用 bounding box 計算偏移，讓花「坐」在表面上，不漂浮
- 拖曳時 OrbitControls.enabled 設為 false，拖曳結束設回 true
- 拖曳 vs 點擊判斷：移動距離 < 5px = 點擊（選中），>= 5px = 拖曳

## V2 新增功能

### 1. 色系配色 + 漸層
- 打開工具時，畫面出現色系選擇介面，選兩個色系（主色 + 輔助色）
- 可選的色系：粉紅系、紫色系、藍色系、綠色系、橘色系、黃色系、白色系
- 選完後，花盤裡的花自動帶上該色系的深淺漸層色：
  - 主色系分配給玫瑰（6 朵，從深到淺排列）
  - 輔助色系分配給繡球花（8 朵，從深到淺排列）
- 漸層計算方式：取色系的基礎色，用 HSL 色彩空間，固定色相（H），從高飽和度低亮度到低飽和度高亮度，均勻分配給每朵花
- 使用者仍然可以點個別花換色（V1 的逐朵選色功能保留），但起點是協調的漸層色而不是全部粉紅
- 可以隨時重新選色系，花盤裡的花會重新分配顏色（已放到蛋糕上的花不受影響）
- 色系選擇 UI 放在畫面上方或左上角，不擋蛋糕和花盤

### 2. 更多花的種類
- 新增 3 種花型：牡丹、康乃馨、蘋果花（或五瓣花）
- 每種花用 .glb 模型，從 Sketchfab 免費下載或 Meshy/Tripo 生成
- 下載後用 gltf-transform 移除莖葉、降面數到 20,000 以內
- 花盤擴大，容納所有花型。每種花的數量待定（先各 4 朵，之後調整）
- 新花型的顏色同樣受色系配色影響

### 3. 花朵大小調整
- 蛋糕上的花選中後，出現大小調整控制（小型 UI，+/- 按鈕或滑桿）
- 範圍：0.5x ～ 1.5x（原始大小的一半到一倍半）
- 資料結構裡已有 scale 欄位，直接使用

### 4. 花方向旋轉
- 蛋糕上的花選中後，出現旋轉滑桿（0° ～ 360°）
- 旋轉軸 = 花吸附的表面法線方向（頂面的花繞 Y 軸轉，側面的花繞該面法線轉）
- 用途：決定花的哪一面朝前
- 跟大小調整共用選中花的 UI 面板

### 5. 平移功能修復
- OrbitControls 設定：左鍵拖曳 = 旋轉，右鍵拖曳 = 平移，滾輪 = 縮放
- mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
- touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
- 檢查花的拖曳 pointerdown 事件裡的 stopPropagation 是否只攔截左鍵（e.button === 0），不要擋右鍵
- 如果 OrbitControls 的右鍵平移仍然無法生效，改用鍵盤方向鍵平移作為備案

## 資料結構變更

```typescript
// 新增色系類型
type ColorFamily = 'pink' | 'purple' | 'blue' | 'green' | 'orange' | 'yellow' | 'white'

// FlowerType 擴充
type FlowerType = 'rose' | 'hydrangea' | 'peony' | 'carnation' | 'apple_blossom'

// AppState 新增
type AppState = {
  // ...V1 既有欄位全部保留...
  primaryColorFamily: ColorFamily | null    // 主色系
  secondaryColorFamily: ColorFamily | null  // 輔助色系
}

// Flower 新增
type Flower = {
  // ...V1 既有欄位全部保留...
  facingAngle: number  // 花方向旋轉角度（0-360），繞法線軸
}
```

## V2 不做
- 不做多層蛋糕
- 不做葉子
- 不做底座墊高
- 不做底盤造型升級
- 不做同種花隨機差異
- 不做版型模板
- 不做材質光影升級
- 不做自由調色盤
- 不做手機觸控優化

## 3D 模型管理
- 所有 .glb 模型放在 public/models/
- 新增花型的模型命名：peony.glb、carnation.glb、apple_blossom.glb
- 每個模型面數控制在 20,000 以內
- 載入後一律移除貼圖，用程式碼控制顏色
- 授權資訊統一放在 README.md 的 Credits 區塊

## 技術棧
- 跟 V1 完全相同：Vite + React + TypeScript + React Three Fiber + Drei + Three.js
- 不用後端、不用資料庫、不用路由
- Claude Code 預設模型

## 工作方式
從 V1 的複製資料夾開始。按以下順序開發，每一步停下來讓我確認：

1. 色系選擇 UI：畫面上方出現色系選擇介面，可選主色系 + 輔助色系，選完後花盤裡的花自動帶上漸層色
2. 漸層分配邏輯：用 HSL 計算每朵花的深淺色，玫瑰用主色系、繡球用輔助色系，花盤上能看到漸層效果
3. 色系與逐朵選色的整合：色系選完之後，點個別花仍然可以用 V1 的色票換色，兩個不衝突
4. 新增花型模型載入：把 peony.glb、carnation.glb、apple_blossom.glb 載入場景，放到花盤上，確認顯示正確
5. 花盤重新排版：花盤擴大，所有花型排列整齊，新花型也受色系配色影響
6. 花朵大小調整：選中蛋糕上的花，出現大小控制，拖動可縮放
7. 花方向旋轉：選中蛋糕上的花，出現旋轉滑桿，拖動可繞法線轉
8. 平移功能修復：OrbitControls 右鍵平移，確認跟花的拖曳不衝突
9. 整體手感檢查：色系切換順暢、多種花型同時在蛋糕上不卡頓、漸層色看起來自然協調
