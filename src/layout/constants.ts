import type { FlowerType } from '../types'

/**
 * ⚠ 複製自各花元件的 TARGET_DIAMETER（Rose / Hydrangea / Peony / FivePetal .tsx）。
 * 佈局模組禁止 import 花朵模型模組（layout-engine-spec §9 grep 邊界），故複製數值。
 * 若花元件調整 TARGET_DIAMETER，需同步更新此處——見 backlog.md【技術債】。
 */
export const FLOWER_DIAMETER: Record<FlowerType, number> = {
  rose: 1.6,
  hydrangea: 2.0,
  peony: 2.64,
  fivepetal: 1.7,
}

/** 花盤庫存為硬上限（D1）：引擎只用 tray 現有的花，不生成額外實例 */
export const MAX_GENERATION_ATTEMPTS = 24

/**
 * layout-direction §3 空間規則（全部「可調」）。
 * 生成端以「圓模型中心距下限」表達；係數與 §3 的 bbox 重疊容忍對應：
 * 0.78 → 同種花 bbox 重疊 ≤ ~25%（容忍上限 20–30%）
 * 0.66 → 不同種花 bbox 重疊 ≤ ~35%（容忍上限 30–40%，小花可塞大花縫隙）
 */
export const SPACING = {
  SAME_TYPE_DIST_FACTOR: 0.78,
  DIFF_TYPE_DIST_FACTOR: 0.66,
  /** 焦點花之間不重疊（§3：0%），加一點縫 */
  FOCAL_DIST_FACTOR: 1.03,
  /** 同種花繞法線朝向角最小差（§3） */
  MIN_FACING_DIFF_DEG: 25,
  /** 頂面花隨機傾斜角上限（§3：0–20°） */
  TILT_MAX_DEG: 20,
  /** 側面花朝向沿法線（§3），只留極小擾動 */
  SIDE_TILT_MAX_DEG: 8,
} as const

/** layout-direction §2A 新月弧構圖參數（全部「可調」，寫死於此不開放 UI） */
export const CRESCENT = {
  /** 焦點花距圓心 1/2–2/3 半徑（×蛋糕半徑） */
  FOCAL_R_MIN: 0.5,
  FOCAL_R_MAX: 0.667,
  /** 花流的角度跨幅 */
  ARC_SPAN_MIN_DEG: 100,
  ARC_SPAN_MAX_DEG: 140,
  /** 花流跨越頂面邊緣、轉入側面的參數位置 */
  T_EDGE: 0.55,
  /** 花流垂落側面的深度（×蛋糕高度；§2A 容許 0–50%） */
  SIDE_DROP_MIN: 0.25,
  SIDE_DROP_MAX: 0.5,
  /** 中段 rose 尺寸（×焦點花直徑），沿花流由 START 遞減到 END（§2A：末端 40–50%） */
  MID_SIZE_START: 0.58,
  MID_SIZE_END: 0.45,
  /** 收尾 fivepetal 尺寸（§2A：焦點花的 20–25%） */
  TAIL_SIZE_MAX: 0.25,
  TAIL_SIZE_MIN: 0.2,
  /** 收尾 hydrangea 小簇尺寸 */
  TAIL_HYD_SIZE: 0.28,
  /** 墊底填充 hydrangea 尺寸 */
  FILLER_SIZE: 0.5,
  /** §7 大花抬升（世界單位，大花頂端高於周圍 15–25% 的近似實作） */
  FOCAL_LIFT_MIN: 0.15,
  FOCAL_LIFT_MAX: 0.25,
} as const

/** 硬約束檢查門檻（layout-engine-spec §9 可程式檢查項） */
export const LIMITS = {
  SAME_TYPE_OVERLAP_MAX: 0.3,
  CRESCENT_TOP_COVERAGE_MAX: 0.4,
  CRESCENT_BARE_CONTINUOUS_MIN: 0.55,
  CRESCENT_THICK_THIN_RATIO_MIN: 2.0,
  WREATH_ANGLE_MIN_DEG: 120,
  WREATH_ANGLE_MAX_DEG: 210,
  /** 中央留白直徑 ≥ 30% 蛋糕直徑 */
  WREATH_CENTER_CLEAR_MIN: 0.3,
  DOME_TOP_COVERAGE_MIN: 0.8,
  /** 焦點花偏心 ≥ 15% 半徑 */
  DOME_FOCAL_OFFCENTER_MIN: 0.15,
} as const
