import type { Flower, FlowerType } from '../types'
import type { CakeSpec, FlowerRole, LayoutResult, LayoutType, PlacedFlower } from './types'
import { FLOWER_DIAMETER, HERO_FLOWER_ID, MAX_GENERATION_ATTEMPTS, SPACING } from './constants'
import { placeOnSurface, sideFacePoint, topFacePoint } from './placement'
import { checkLayout, type ConstraintReport } from './constraints'

/**
 * 三個佈局生成器（crescent / wreath / dome）共用的生成機制：
 * 決定性 PRNG、空間鬆弛、朝向角分配、§7 深淺選花、重試迴圈。
 * 階段一時放在 crescent.ts，階段二因 wreath / dome 復用而抽出。
 */

export const DEG = Math.PI / 180
export const TAU = Math.PI * 2

// ── PRNG 與數學工具 ──────────────────────────────────────────────────────────

export type Rng = () => number

/** 決定性 PRNG，同一 seed 產出同一佈局 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** 感知亮度，§7 深淺分配用（引擎只讀 flower JSON 的 color，不 import 配色系統） */
export function luminance(c: [number, number, number]): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── 生成中的工作結構 ─────────────────────────────────────────────────────────

export type GenSlot = {
  /** 佈局內的排序參數（crescent：花流位置；wreath / dome：距焦點的正規化距離） */
  t: number
  type: FlowerType
  role: FlowerRole
  /** ×焦點花直徑（= FLOWER_DIAMETER.peony） */
  sizeRel: number
  /** wreath 的群組編號（0 / 1 = 花群、2 = 連接段）；其他佈局 0 */
  groupId: number
}

export type Work = {
  slot: GenSlot
  surface: 'top' | 'side'
  x: number // top 用：世界 x
  z: number // top 用：世界 z
  theta: number // side 用：圓柱角
  y: number // side 用：世界 y
  worldD: number
  scale: number
}

export function makeWork(
  slot: GenSlot,
  init:
    | { surface: 'top'; x: number; z: number; topY: number }
    | { surface: 'side'; theta: number; y: number },
): Work {
  const worldD = slot.sizeRel * FLOWER_DIAMETER.peony
  const scale = worldD / FLOWER_DIAMETER[slot.type]
  if (init.surface === 'top') {
    return { slot, surface: 'top', x: init.x, z: init.z, theta: 0, y: init.topY, worldD, scale }
  }
  return { slot, surface: 'side', x: 0, z: 0, theta: init.theta, y: init.y, worldD, scale }
}

export function worldPos(w: Work, R: number): [number, number, number] {
  if (w.surface === 'top') return [w.x, w.y, w.z]
  return [Math.cos(w.theta) * R, w.y, Math.sin(w.theta) * R]
}

// ── 空間鬆弛（§3 間距 / 重疊容忍） ────────────────────────────────────────────

/** 兩朵花的中心距下限（§3，對應 SPACING 係數） */
export function minCenterDist(a: Work, b: Work): number {
  const rr = (a.worldD + b.worldD) / 2
  if (a.slot.role === 'focal' && b.slot.role === 'focal') return rr * SPACING.FOCAL_DIST_FACTOR
  const f = a.slot.type === b.slot.type ? SPACING.SAME_TYPE_DIST_FACTOR : SPACING.DIFF_TYPE_DIST_FACTOR
  return rr * f
}

export type RelaxBounds = {
  R: number
  topY: number
  /** 側面花允許的最低 y */
  minY: number
  /** 中央留白半徑（wreath 用）：頂面花的投影圓不得進入此半徑 */
  holeR?: number
}

export function relax(works: Work[], bounds: RelaxBounds): void {
  const ITER = 60
  for (let iter = 0; iter < ITER; iter++) {
    let moved = false
    for (let i = 0; i < works.length; i++) {
      for (let j = i + 1; j < works.length; j++) {
        const a = works[i]
        const b = works[j]
        const pa = worldPos(a, bounds.R)
        const pb = worldPos(b, bounds.R)
        let dx = pb[0] - pa[0]
        let dy = pb[1] - pa[1]
        let dz = pb[2] - pa[2]
        let dist = Math.hypot(dx, dy, dz)
        const need = minCenterDist(a, b)
        if (dist >= need) continue
        moved = true
        if (dist < 1e-4) {
          dx = 1; dy = 0; dz = 0; dist = 1
        }
        const push = ((need - dist) / dist) * 0.5
        applyPush(a, [-dx * push, -dy * push, -dz * push], bounds)
        applyPush(b, [dx * push, dy * push, dz * push], bounds)
      }
    }
    if (bounds.holeR !== undefined) {
      // 中央留白：頂面花整顆投影圓推出 hole 之外
      for (const w of works) {
        if (w.surface !== 'top') continue
        const rc = Math.hypot(w.x, w.z)
        const needR = bounds.holeR + w.worldD / 2
        if (rc >= needR) continue
        moved = true
        if (rc < 1e-4) {
          w.x = needR
        } else {
          w.x *= needR / rc
          w.z *= needR / rc
        }
        // 推出後仍不得越過頂面邊緣
        const r2 = Math.hypot(w.x, w.z)
        if (r2 > bounds.R) {
          w.x *= bounds.R / r2
          w.z *= bounds.R / r2
        }
      }
    }
    if (!moved) break
  }
}

/** 把 3D 推力投影回花所在表面的自由度（top：xz 平面；side：θ 與 y） */
function applyPush(w: Work, push: [number, number, number], bounds: RelaxBounds): void {
  if (w.surface === 'top') {
    w.x += push[0]
    w.z += push[2]
    const r = Math.hypot(w.x, w.z)
    if (r > bounds.R) {
      // 中心點最遠到頂面邊緣（§4：花瓣可懸空，中心不出邊）
      w.x *= bounds.R / r
      w.z *= bounds.R / r
    }
  } else {
    const tx = -Math.sin(w.theta)
    const tz = Math.cos(w.theta)
    w.theta += (push[0] * tx + push[2] * tz) / bounds.R
    w.y = clamp(w.y + push[1], bounds.minY, bounds.topY)
  }
}

// ── 朝向角分配（§3：同種花繞法線角差 ≥ 25°） ─────────────────────────────────

export function assignFacings(count: number, rng: Rng): number[] {
  if (count === 0) return []
  const base = rng() * 360
  const step = 360 / count
  // step 對庫存上限（8 朵 → 45°）恆 > 25°；jitter 限制在不破壞最小差的範圍
  const jitterMax = Math.max(0, (step - SPACING.MIN_FACING_DIFF_DEG) / 2 - 1)
  const order = shuffle([...Array(count).keys()], rng)
  return order.map(i => (base + i * step + (rng() * 2 - 1) * jitterMax + 360) % 360)
}

// ── 實體花挑選（§7 深淺分配，best effort，D5 決議不做精確比例） ────────────────

/**
 * 依 slot.t 排序（0 = 焦點端）為每個花型挑選實體 tray 花。
 * 引擎不改色，只決定哪朵花放哪個位置。
 * 庫存為硬上限（D1）：不足時捨棄多出的 slot 並從 works 移除。
 */
export function selectFlowerIds(works: Work[], flowers: Flower[]): Map<Work, string> {
  const map = new Map<Work, string>()
  const types: FlowerType[] = ['rose', 'hydrangea', 'peony', 'fivepetal']
  for (const type of types) {
    const group = works.filter(w => w.slot.type === type).sort((a, b) => a.slot.t - b.slot.t)
    if (group.length === 0) continue
    let pool = flowers.filter(f => f.type === type).sort((a, b) => luminance(a.color) - luminance(b.color))
    let usable = group.slice(0, pool.length)

    // 英雄花規則（2026-07-18）：worldDiameter 最大的 peony slot 優先選 HERO_FLOWER_ID
    if (type === 'peony' && usable.length > 0) {
      const hero = pool.find(f => f.id === HERO_FLOWER_ID)
      if (hero) {
        const heroWork = usable.reduce((a, b) => (b.worldD > a.worldD ? b : a), usable[0])
        map.set(heroWork, hero.id)
        pool = pool.filter(f => f.id !== hero.id)
        usable = usable.filter(w => w !== heroWork)
      }
    }

    const picked = pickShadesForFlow(pool, usable.length)
    usable.forEach((w, i) => map.set(w, picked[i].id))
  }
  for (let i = works.length - 1; i >= 0; i--) {
    if (!map.has(works[i])) works.splice(i, 1)
  }
  return map
}

/**
 * 從暗→亮排序的庫存挑 n 朵並排出順序：
 * 焦點端用較深（§7：焦點花 = 梯度中最鮮豔端），尾端較淺（填充花 = 高明度低彩度），
 * 中間交錯避免深淺成帶（§7 深淺穿插）。
 */
export function pickShadesForFlow(pool: Flower[], n: number): Flower[] {
  const chosen: Flower[] = []
  for (let i = 0; i < n; i++) {
    const idx = n === 1 ? 0 : Math.round((i * (pool.length - 1)) / (n - 1))
    chosen.push(pool[idx])
  }
  const seen = new Set<string>()
  const unique: Flower[] = []
  for (const f of chosen) {
    if (!seen.has(f.id)) { seen.add(f.id); unique.push(f) }
  }
  let k = 0
  while (unique.length < n && k < pool.length) {
    if (!seen.has(pool[k].id)) { seen.add(pool[k].id); unique.push(pool[k]) }
    k++
  }
  const sorted = [...unique].sort((a, b) => luminance(a.color) - luminance(b.color))
  const out: Flower[] = []
  const evens = sorted.filter((_, i) => i % 2 === 0)
  const odds = sorted.filter((_, i) => i % 2 === 1).reverse()
  out.push(...evens, ...odds)
  return out.slice(0, n)
}

// ── 定稿：works → PlacedFlower[] ────────────────────────────────────────────

/**
 * 共用的定稿流程：朝向角、傾斜、選花、最終 transform。
 * liftFor 決定每朵花沿法線的抬升（§7 大花視覺層次，各佈局策略不同）。
 */
export function finalizeWorks(
  layout: LayoutType,
  works: Work[],
  flowers: Flower[],
  cake: CakeSpec,
  rng: Rng,
  seed: number,
  attempts: number,
  liftFor: (w: Work, rng: Rng) => number,
): LayoutResult {
  const topY = cake.height / 2

  const facings = new Map<Work, number>()
  const tilts = new Map<Work, number>()
  for (const type of ['rose', 'hydrangea', 'peony', 'fivepetal'] as FlowerType[]) {
    const group = works.filter(w => w.slot.type === type)
    const angles = assignFacings(group.length, rng)
    group.forEach((w, i) => {
      facings.set(w, angles[i])
      tilts.set(w, rng() * (w.surface === 'top' ? SPACING.TILT_MAX_DEG : SPACING.SIDE_TILT_MAX_DEG))
    })
  }

  const idByWork = selectFlowerIds(works, flowers)

  const placements: PlacedFlower[] = works.map(w => {
    const { point, normal } =
      w.surface === 'top'
        ? topFacePoint(cake, Math.hypot(w.x, w.z), Math.atan2(w.z, w.x))
        : sideFacePoint(cake, w.theta, topY - w.y)
    const { position, rotation } = placeOnSurface(
      point,
      normal,
      facings.get(w) ?? 0,
      tilts.get(w) ?? 0,
      liftFor(w, rng),
    )
    return {
      flowerId: idByWork.get(w) as string,
      type: w.slot.type,
      position,
      rotation,
      scale: w.scale,
      worldDiameter: w.worldD,
      role: w.slot.role,
      surface: w.surface,
      facingAngleDeg: facings.get(w) ?? 0,
      flowT: w.slot.t,
      groupId: w.slot.groupId,
    }
  })

  return { layout, seed, attempts, placements }
}

// ── 重試迴圈（硬約束檢查器當 generation validator，ADR D4 策略二預留路線） ────

export function generateWithRetry(
  cake: CakeSpec,
  seed: number,
  genOnce: (seed: number, attempts: number) => LayoutResult,
): { result: LayoutResult; report: ConstraintReport } {
  let best: { result: LayoutResult; report: ConstraintReport } | null = null
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const s = (seed + attempt * 7919) >>> 0
    const result = genOnce(s, attempt + 1)
    const report = checkLayout(result, cake)
    if (report.pass) return { result, report }
    const fails = report.checks.filter(c => !c.pass).length
    const bestFails = best ? best.report.checks.filter(c => !c.pass).length : Infinity
    if (fails < bestFails) best = { result, report }
  }
  // 重試耗盡：回傳違規最少的一版（report.pass = false，呼叫端可見）
  return best as { result: LayoutResult; report: ConstraintReport }
}
