# layout-engine-impact.md — 佈局引擎 Impact Analysis

依據 layout-engine-spec.md §5 產出。分析日期：2026-07-17。
**尚未確認前不寫任何程式碼。**

---

## List A — 依賴掃描

所有讀寫花朵放置資料、拖曳吸附邏輯、花盤庫存、Screen 2 進入點與渲染迴圈的位置：

### 花朵放置資料（flower JSON）

| 檔案 | 函式 / 元件 | 用途 |
|------|------------|------|
| `src/types.ts` | `Flower`, `AppState` | flower JSON 定義：`id, type, color, baseColor, position, rotation, scale, elevation, facingAngle, slotPosition, onCake`。佈局引擎的 input/output 格式即此。 |
| `src/data/initialState.ts` | `initialState`, `makeFlower`, `*_SLOTS` | 花盤庫存的唯一來源（寫死）：rose 6、hydrangea 8、peony 4、fivepetal 8，共 26 朵。也定義蛋糕幾何（radius 5、height 4、圓柱、中心在原點）與底盤（radius 6、height 0.3）。 |
| `src/components/DragManager.tsx` | `onUp()`（L128–159） | **唯一寫入放置資料的地方**：吸附成功時寫 `position / rotation / onCake:true`；吸附失敗時寫回 `slotPosition / rotation:[0,0,0] / onCake:false`。 |
| `src/App.tsx` | `handleFlowerShadeChange`, `handleFlowerFamilyChange` | Screen 2 寫入 `color / baseColor`（個別花換色）。 |
| `src/App.tsx` | `handleColorAssign` | Screen 1 寫入 `color / baseColor / typeColorMap`（依 `computeGradient` 分配同型花的深淺梯度）。**佈局引擎讀取配色的來源即 `typeColorMap` + 每朵花的 `baseColor` / `color`。** |
| `src/App.tsx` | `handleReset` | 整個 state 重設回 `initialState`（佈局結果會被一併清除，行為正確，不需改）。 |
| `src/App.tsx` | feedback 觸發 effect（L123–128） | 讀 `onCake` 數量（僅統計用，不影響佈局）。 |

### 拖曳吸附邏輯

| 檔案 | 函式 | 用途 |
|------|------|------|
| `src/components/DragManager.tsx` | `getSnap(ndc)`（L52–61） | 吸附核心：raycast 打 `cakeMeshRef`，取交點與世界座標法線，排除底面（`normal.y < -0.9`）。 |
| `src/components/DragManager.tsx` | `onUp()` 內的放置計算（L135–139） | 「表面點 + 法線」→ 最終 transform 的轉換：`quaternion.setFromUnitVectors(UP, normal)` → euler，位置沿法線外推 `SURFACE_OFFSET = 0.02`。**這段數學是佈局引擎要重現（或共用）的放置規則。** |
| `src/components/DragManager.tsx` | `onMove()` + preview group | 拖曳中預覽。純互動用，佈局引擎不需要。 |

### 花盤庫存

| 檔案 | 函式 / 元件 | 用途 |
|------|------------|------|
| `src/data/initialState.ts` | `ROSE_SLOTS` 等四組常數 | 庫存數量與 tray 上的 slot 位置。 |
| `src/components/FlowerTray.tsx` | `FlowerTray` | 渲染 tray 盒子 + **所有花**（不論在 tray 或蛋糕上，依 `flower.position / rotation` 渲染）。這也是花朵的渲染迴圈。**注意：只套用 `position` 和 `rotation`，`scale` / `elevation` / `facingAngle` 完全沒被讀取。** |

### Screen 2 進入點與渲染迴圈

| 檔案 | 函式 / 元件 | 用途 |
|------|------------|------|
| `src/App.tsx` | `handleStart` | Screen 1 → Screen 2 切換（`currentScreen: 'screen2'`）。 |
| `src/App.tsx` | Screen 2 JSX（L237 起） | Canvas、光源、`CakeScene`（含 `cakeMeshRef` 圓柱）、`FlowerTray`、`DragManager`、`OrbitControls`、截圖/重設按鈕。**佈局選擇 UI 的掛載點在此。** |
| `src/App.tsx` | `CakeScene` | 蛋糕圓柱 mesh（`cakeMeshRef` 的來源）＋底盤。幾何參數來自 state。 |
| `src/components/FlowerColorPicker.tsx` | `FlowerColorPicker` | 選中花的換色 UI（佈局後手動調整需保持可用，不需改）。 |
| `src/data/gradient.ts` | `computeGradient`, `computePeonyGradient` | 深淺梯度計算。佈局引擎分配同色系深淺（layout-direction §7）時讀取用。屬 Screen 1 配色系統，**只讀不改**（Must avoid 邊界）。 |

### 相關但不可修改（asset-interface.md「現有程式碼已強制」邊界）

| 檔案 | 用途 |
|------|------|
| `src/components/Rose.tsx` / `Hydrangea.tsx` / `Peony.tsx` / `FivePetal.tsx` | 模型載入、材質清除、`TARGET_DIAMETER`（rose 1.6 / hydrangea 2.0 / peony 2.64 / fivepetal 1.7）。佈局引擎的 bounding 計算需要這些直徑值，但不可 import 這些模組（§9 grep 檢查）。 |
| `src/components/flowerNormalize.ts` | 正規化保證：花底在 y=0、直徑歸一。佈局引擎依賴此保證（花中心點 = 表面吸附點），不碰。 |

---

## List B — 需修改的現有檔案

| 檔案 | 修改內容摘要 |
|------|-------------|
| `src/App.tsx` | (1) 新增 `handleApplyLayout(layoutType)`：呼叫佈局模組取得放置結果，一次 `setState` 寫入所有花的 `position / rotation / onCake / scale`。(2) 在 Screen 2 JSX 掛載佈局選擇 UI 元件。(3) 佈局套用前先把已在蛋糕上的花收回 tray（行為待 List D-4 確認）。 |
| `src/components/DragManager.tsx` | 把「表面點 + 法線 → position/rotation」的放置數學（`setFromUnitVectors` + `SURFACE_OFFSET` 外推）抽成純函式，移到新的共用模組（見 List C `placement.ts`），DragManager 改為 import 使用。**行為不變**，只是讓佈局引擎能以程式方式呼叫同一套放置邏輯，保證手動拖曳與自動佈局的落點規則一致。 |
| `src/components/FlowerTray.tsx` | 渲染時套用 `flower.scale`（`<group scale={flower.scale}>`）。目前 `scale` 欄位存在但渲染忽略；大小遞減（layout-direction §2A/2B/2C）必須讓此欄位生效。欄位已存在於 flower JSON，**不是資料結構改動**。（是否也套用 `elevation` / `facingAngle` 見 List D-3。） |

不需修改：`src/types.ts`（欄位已足夠，見 List D-2）、`src/data/initialState.ts`、`flowerNormalize.ts`、四個花元件、`gradient.ts`、`Screen1.tsx`。

---

## List C — 新建檔案

| 檔案 | 內容摘要 |
|------|---------|
| `src/layout/placement.ts` | 共用放置數學（從 DragManager 抽出）：`surfaceTransform(point, normal) → { position, rotation }`。加上蛋糕表面的解析幾何：頂面極座標 `(r, θ)` → 世界座標與法線 `(0,1,0)`；側面圓柱座標 `(θ, h)` → 世界座標與徑向法線。蛋糕是理想圓柱（radius 5、height 4、置中原點），解析計算與 raycast 結果等價。 |
| `src/layout/types.ts` | 佈局模組內部型別：`LayoutType`（`'crescent' | 'wreath' | 'dome'`）、佈局結果（花 id → 放置指令）、焦點花標記等**記憶體內** metadata（不進 flower JSON，見 List D-2）。 |
| `src/layout/constants.ts` | 所有可調參數常數（覆蓋面積範圍、角度差、間距、重疊容忍、大小遞減比例…，即 layout-direction 中所有「可調」數值）＋各花型直徑常數（rose 1.6 / hydrangea 2.0 / peony 2.64 / fivepetal 1.7，**複製數值而非 import 花元件**，以守住 §9 grep 邊界；同步風險記在 List D-9）。 |
| `src/layout/crescent.ts` | 新月弧演算法（layout-direction §2A）：焦點花選位、沿弧擴散、頂面→側面對角帶、大小遞減、花型角色分配、§7 配色空間分區。 |
| `src/layout/wreath.ts` | 雙群花圈演算法（§2B）：兩焦點選位（角度差 150°–210°）、群內擴散、連接段花、中央留白、§7 主色/對比色分群。 |
| `src/layout/dome.ts` | 滿版圓頂演算法（§2C）：偏心焦點、不規則填充、dome 高度輪廓、邊緣垂落、§7 配色穿插。 |
| `src/layout/constraints.ts` | 硬約束檢查器，驗證 spec §9 可程式檢查項：頂面投影覆蓋率（5A ≤40%、5C ≥80%）、厚薄端寬度比 ≥2、花群角度差 120°–210°、中央留白 ≥30% 直徑、焦點花偏心 ≥15% 半徑、同種花 bbox 重疊 ≤30%、同種花 Y 轉角差 ≥25°、焦點花數為奇數。 |
| `src/components/LayoutPicker.tsx` | 佈局選擇 UI：三個選項的最小化元件，不遮擋蛋糕（位置樣式比照現有右下角按鈕群）。呼叫 `App.tsx` 傳入的 `onApplyLayout`。 |

---

## List D — Assumptions / Open Questions

### 需要你決定的開放問題

1. **花盤庫存是硬上限嗎？** 庫存固定 26 朵（rose 6 / hydrangea 8 / peony 4 / fivepetal 8）。粗估滿版圓頂 80–95% 頂面覆蓋（頂面積 ≈ 78.5，各花投影 ≈ 2–5.5）需要接近全部 26 朵，可能不夠或極緊。佈局引擎是 (a) 只能用 tray 現有的花（不夠時取覆蓋率下限或放大 scale 補償），還是 (b) 可以生成額外花朵實例（會增加庫存以外的花，影響「拖回 tray」行為）？

2. **「花所屬佈局群組 / 焦點花」標記欄位**（spec §7 點名的問題）：flower JSON 沒有欄位可標記「此花由哪個佈局生成」或「此花是焦點花」。我的預設做法：這些 metadata 只存在佈局引擎的記憶體回傳值中，硬約束檢查器直接吃引擎的回傳（不從 flower JSON 反推），flower JSON 完全不動。若你想要除錯時能從 state 看出佈局來源，才需要加欄位——要加嗎？

3. **`scale` / `elevation` / `facingAngle` 三個欄位存在但渲染完全忽略**（`FlowerTray` 只套 `position` / `rotation`）。大小遞減是 in scope，所以 `scale` 必須生效（已列入 List B）。問題：
   - `elevation`（大花頂端高於周圍 15–25%，layout-direction §7 視覺層次）——由佈局引擎直接算進 `position.y`，還是讓 `elevation` 欄位生效？我建議直接算進 `position.y`，不動渲染層對 `elevation` 的處理。
   - `facingAngle`（繞表面法線的朝向，§3 朝向規則的 Y 轉角差 ≥25° 即此）——同上，我建議由引擎直接組合進 `rotation` euler，不讓渲染層新讀欄位。
   - 這樣 List B 對 `FlowerTray` 的修改只剩 `scale` 一項。可以嗎？

4. **佈局套用時，已經手動放上蛋糕的花怎麼處理？** 選項：(a) 全部收回 tray 再重新佈局（乾淨，但使用者手動成果消失）；(b) 保留手動放置的花，佈局只用 tray 剩餘的花（結果可能違反驗收標準）。我建議 (a)，套用佈局 = 重新排列整顆蛋糕。

5. **主色 / 對比色如何從 Screen 1 的輸出推導？** Screen 1 是「每種花型一個色」（`typeColorMap`），而 layout-direction §7 要求的是「主色家族 55–70%、對比色 25–35%」的面積分配。花型和顏色綁定，所以顏色面積比其實由「哪些花型放多少朵」間接決定。我的預設推導：把 typeColorMap 中面積佔比最大的色系當主色、次大當對比色，佈局引擎依 §7 空間分區規則安排「色 = 花型」的空間位置。但若使用者在 Screen 1 給四種花型配了 3–4 種不同色相，55/30/15 的比例可能無法達成——此時以空間分區規則為主、面積比例盡力而為，可接受嗎？

6. **奶白色花的來源**（§7：每個佈局至少 1–2 朵奶白 #F4EFE9）。若 Screen 1 沒有任何花型配暖白，佈局引擎是否可以把個別花的顏色改成奶白？這會跨進「配色」領域（spec 說引擎「不重新設計配色本身」）。選項：(a) 允許引擎指定 1–2 朵花為奶白（覆寫該花 `color`）；(b) 只在 Screen 1 已有暖白花時才排入奶白角色，沒有就跳過此規則。

7. **底盤放花的範圍確認**：spec §4 In scope 包含「底盤表面（僅 fivepetal 或花瓣，數量上限 3–5）」，但 layout-direction §6 說「不做底盤上散落花瓣的裝飾」。我的理解：**fivepetal 整朵花**放底盤 = in scope；**散落花瓣**（petal 碎片，目前也沒有這種資產）= out of scope。正確嗎？

### 分析中確立的假設（如有誤請指出）

8. **解析放置取代 raycast**：蛋糕是理想圓柱（radius 5、height 4），佈局引擎用圓柱解析幾何直接算表面點與法線，不經過 raycaster；最終 transform 用與 DragManager 相同的 `setFromUnitVectors(UP, normal)` + `SURFACE_OFFSET` 數學（抽成共用函式），保證與手動拖曳落點規則一致。

9. **花型直徑常數複製**：`TARGET_DIAMETER` 寫死在四個花元件內，而 §9 grep 檢查禁止佈局模組 import 花朵模型載入模組，所以在 `src/layout/constants.ts` 複製這四個數值（1.6 / 2.0 / 2.64 / 1.7）。若未來花元件調直徑需手動同步——會在兩處都加註解互相指向。

10. **bounding 以直徑常數近似**：重疊 / 覆蓋率檢查用「以 `TARGET_DIAMETER × scale` 為直徑的圓形投影」近似花的 bbox，不在執行期讀 GLB 實際 bbox（避免依賴模型載入時序）。normalizeFlower 以 `max(size.x, size.z)` 歸一直徑，此近似與正規化保證一致。

11. **佈局後的手動調整零成本**：佈局引擎輸出與手動拖曳寫入完全相同的欄位（`position / rotation / onCake` + `scale`），之後的拖曳、換色、移除自然走現有路徑，不需要任何鎖定/解鎖邏輯。惟手動拖曳（DragManager `onUp`）不會重設 `scale`，被佈局縮小的花拖回 tray 後仍是縮小尺寸——需要在拖回 tray 時重設 `scale = 1` 嗎？（小問題，預設：拖回 tray 重設為 1，在 DragManager 的 tray 返回分支加一行。）

12. **hydrangea 效能**：hydrangea 254 mesh/朵（asset-interface §7），庫存 8 朵全上蛋糕時 draw calls 顯著，但這是現況既有限制，佈局引擎不做特殊處理、不超出庫存數量即可。

13. **`elevation` 的大花抬高**會讓花底離開蛋糕表面（花底 y=0 保證是貼面）。抬高 15–25% 後花底會微微懸空，近看可能穿幫。假設：抬高幅度小、花瓣互相遮擋，視覺可接受；驗收時目測確認。

---

以上。**等你確認 List D（特別是 1–7）後才開始寫程式碼。**
