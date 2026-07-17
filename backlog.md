# Backlog

## 技術債

- 【技術債】若花元件未來調整 `TARGET_DIAMETER`，需同步更新 `src/layout/constants.ts` 的 `FLOWER_DIAMETER`，否則佈局的 bounding box 計算會失準。目前複製的數值：rose 1.6 / hydrangea 2.0 / peony 2.64 / fivepetal 1.7。（來源：layout-engine-impact.md D-9，2026-07-17 使用者核准複製方案）
