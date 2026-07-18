# Backlog

## 技術債

- 【技術債】若花元件未來調整 `TARGET_DIAMETER`，需同步更新 `src/layout/constants.ts` 的 `FLOWER_DIAMETER`，否則佈局的 bounding box 計算會失準。目前複製的數值：rose 1.6 / hydrangea 2.0 / peony 2.64 / fivepetal 1.7。（來源：layout-engine-impact.md D-9，2026-07-17 使用者核准複製方案）

## 設計提議

- 【設計提議】滿版圓頂（dome）在 D1「庫存 26 朵為硬上限」約束下，於 layout-direction §2C 的尺寸遞減範圍內（中間區 55–70%、邊緣區 35–45% 焦點花直徑），可用花的頂面投影覆蓋率實測僅 **41–44%**，達不到 §9 5C「頂面覆蓋 ≥ 80%」。生成器已依規格實作並回傳違規最少版本（coverage 檢查如實 FAIL，其餘 4 項檢查全過）。待決定：調降 dome 覆蓋率驗收區間，或增加花盤庫存（粗估需要 ~2 倍花量或允許尺寸上調）。（2026-07-17，階段二實測；依 D1 決議不自行生成額外花朵）

## 決議變更紀錄

- 【決議變更】2026-07-18：D1「花盤庫存 26 朵為硬上限」被推翻。庫存擴充為 rose 8 / hydrangea 8 / peony 6 / fivepetal 12（共 34 朵），並新增英雄花機制（peony-0，scale 上限 1.8）。crescent / wreath 實測覆蓋率目標 ×2；**dome 覆蓋率問題本輪仍不處理**（上方設計提議條目維持開放，dome 不用 hero 尺寸、slot 計畫不變）。
