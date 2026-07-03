# CLAUDE.md — 韓式裱花蛋糕排練工具

## 專案技術棧
Vite + React + TypeScript + React Three Fiber + Drei + Three.js
不用後端、不用資料庫、不用路由

## GLB 模型處理規則
- 載入模型後 traverse 所有 material，把 map 設為 null，用 material.color 設定顏色
- Canvas 設定 gl={{ toneMapping: THREE.NoToneMapping }}
- 光源固定在世界座標，不跟著相機或蛋糕旋轉
- 新模型加入前必須確認 root node transform 為 identity

## 開發行為規則
- 開發過程中發現不在當前任務範圍內的問題或機會，不要停下當前任務。寫進 backlog.md，標記「設計提議」或「bug」，然後繼續。
- 不確定某個互動細節屬於「現在做」還是「之後做」，問我，不要自己決定。
- 不要自己發明互動邏輯或設計決策。如果 spec 沒寫，問我。
- 每個階段完成後停下來等我驗收，不要自動進入下一階段。

## 本輪開發規則（配色系統替換）
- 實作規格：color-system-spec.md（Section 2 定義權限層級）
- 只做 color-system-spec.md Section 4 In scope 列出的內容
- 不碰花的模型載入、吸附邏輯、OrbitControls、截圖功能
- 不做花大小調整、花方向旋轉、返回 Screen 1 保留排列
