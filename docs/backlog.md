# Backlog

## 技術債

- 【技術債】若花元件未來調整 `TARGET_DIAMETER`，需同步更新 `src/layout/constants.ts` 的 `FLOWER_DIAMETER`，否則佈局的 bounding box 計算會失準。目前複製的數值：rose 1.6 / hydrangea 2.0 / peony 2.64 / fivepetal 1.7。（來源：layout-engine-impact.md D-9，2026-07-17 使用者核准複製方案）

## 佈局頂面覆蓋率
未來開放使用者調整佈局頂面覆蓋率範圍（目前寫死在layout/constants.ts，三種佈局各自的覆蓋率上下限）。需求：使用者可在 17%–35% 之間自行調整，不限於現在spec 規定的固定值。

這是獨立於本輪 layout-engine-spec.md 的功能，等三階段完成、實際看過瀏覽器渲染結果後，另開新 spec 文件處理，不在本輪範圍內。