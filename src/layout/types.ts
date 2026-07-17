import type { FlowerType } from '../types'

export type LayoutType = 'crescent' | 'wreath' | 'dome'

export type FlowerRole = 'focal' | 'mid' | 'filler' | 'tail'

export type SurfaceKind = 'top' | 'side' | 'board'

export type CakeSpec = { radius: number; height: number }

/**
 * 佈局引擎的單朵花放置結果。
 * position / rotation / scale 會寫回 flower JSON；
 * 其餘欄位是記憶體內 metadata（D2 決議：不落地到 flower JSON），
 * 硬約束檢查器直接吃這個結構驗證。
 */
export type PlacedFlower = {
  flowerId: string
  type: FlowerType
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
  /** FLOWER_DIAMETER[type] × scale，重疊與覆蓋率計算用 */
  worldDiameter: number
  role: FlowerRole
  surface: SurfaceKind
  /** 繞表面法線的朝向角（度），§3 朝向規則的檢查對象 */
  facingAngleDeg: number
  /** 沿花流的參數位置，0 = 厚端 … 1 = 薄端（新月弧）；其他佈局作群內距離用 */
  flowT: number
  /** 雙群花圈的群組編號（0 / 1 = 花群、2 = 連接段）；其他佈局為 0 */
  groupId: number
}

export type LayoutResult = {
  layout: LayoutType
  seed: number
  /** 通過硬約束前重試的次數（含成功那次） */
  attempts: number
  placements: PlacedFlower[]
}
