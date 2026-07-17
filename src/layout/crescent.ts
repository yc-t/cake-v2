import type { Flower, FlowerType } from '../types'
import type { CakeSpec, FlowerRole, LayoutResult, PlacedFlower } from './types'
import { CRESCENT, FLOWER_DIAMETER, MAX_GENERATION_ATTEMPTS, SPACING } from './constants'
import { placeOnSurface, sideFacePoint, topFacePoint } from './placement'
import { checkLayout, type ConstraintReport } from './constraints'

/**
 * 新月弧佈局（layout-direction §2A）。
 * 花從頂面某側的焦點出發，沿弧線流動並跨越邊緣垂落側面，形成對角帶狀花流。
 *
 * 生成流程：隨機參數 → 沿花流佈 slot → 空間鬆弛（§3 間距）→ 選 tray 花（§7 深淺）
 * → 硬約束檢查；不通過換 seed 重試（引擎內部復用檢查器，ADR D4 validator 路線）。
 */

const DEG = Math.PI / 180
const TAU = Math.PI * 2

// ── 工具 ─────────────────────────────────────────────────────────────────────

type Rng = () => number

/** 決定性 PRNG，同一 seed 產出同一佈局 */
function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** 感知亮度，§7 深淺分配用（引擎只讀 flower JSON 的 color，不 import 配色系統） */
function luminance(c: [number, number, number]): number {
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
}

// ── 內部結構 ─────────────────────────────────────────────────────────────────

type Slot = {
  t: number // 沿花流參數 0（厚端）–1（薄端）
  lateral: number // 垂直於流向的偏移（世界單位）
  type: FlowerType
  role: FlowerRole
  sizeRel: number // ×焦點花直徑（= FLOWER_DIAMETER.peony）
}

type Work = {
  slot: Slot
  surface: 'top' | 'side'
  x: number // top 用：世界 x
  z: number // top 用：世界 z
  theta: number // side 用：圓柱角
  y: number // side 用：世界 y
  worldD: number
  scale: number
}

// ── 對外 API ─────────────────────────────────────────────────────────────────

export function generateCrescent(
  flowers: Flower[],
  cake: CakeSpec,
  seed: number = (Date.now() & 0xffff) >>> 0,
): { result: LayoutResult; report: ConstraintReport } {
  let best: { result: LayoutResult; report: ConstraintReport } | null = null
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const s = (seed + attempt * 7919) >>> 0
    const result = generateOnce(flowers, cake, s, attempt + 1)
    const report = checkLayout(result, cake)
    if (report.pass) return { result, report }
    const fails = report.checks.filter(c => !c.pass).length
    const bestFails = best ? best.report.checks.filter(c => !c.pass).length : Infinity
    if (fails < bestFails) best = { result, report }
  }
  // 重試耗盡：回傳違規最少的一版（report.pass = false，呼叫端可見）
  return best as { result: LayoutResult; report: ConstraintReport }
}

// ── 單次生成 ─────────────────────────────────────────────────────────────────

function generateOnce(flowers: Flower[], cake: CakeSpec, seed: number, attempts: number): LayoutResult {
  const rng = mulberry32(seed)
  const R = cake.radius
  const topY = cake.height / 2

  // 1. 花流幾何
  const theta0 = rng() * TAU
  const dir = rng() < 0.5 ? 1 : -1
  const span = lerp(CRESCENT.ARC_SPAN_MIN_DEG, CRESCENT.ARC_SPAN_MAX_DEG, rng()) * DEG
  const rFocal = lerp(CRESCENT.FOCAL_R_MIN, CRESCENT.FOCAL_R_MAX, rng()) * R
  const dropMax = lerp(CRESCENT.SIDE_DROP_MIN, CRESCENT.SIDE_DROP_MAX, rng()) * cake.height

  // 2. slot 計畫（§2A 花型角色 + 大小遞減）
  const slots: Slot[] = []
  // 焦點：peony 2 + rose 1 = 3 朵（奇數，滿足跨佈局驗收；§2A：peony 1–2 + rose 1）
  slots.push({ t: 0.02, lateral: 0.15, type: 'rose', role: 'focal', sizeRel: FLOWER_DIAMETER.rose / FLOWER_DIAMETER.peony })
  slots.push({ t: 0.05, lateral: -0.6, type: 'peony', role: 'focal', sizeRel: 1.0 })
  slots.push({ t: 0.13, lateral: 0.55, type: 'peony', role: 'focal', sizeRel: 0.92 })
  // 中段：rose 2–3
  const midCount = rng() < 0.5 ? 2 : 3
  for (let i = 0; i < midCount; i++) {
    const k = i / (midCount - 1)
    slots.push({
      t: lerp(0.26, 0.52, k),
      lateral: (i % 2 === 0 ? 1 : -1) * 0.4,
      type: 'rose',
      role: 'mid',
      sizeRel: lerp(CRESCENT.MID_SIZE_START, CRESCENT.MID_SIZE_END, k),
    })
  }
  // 墊底填充：hydrangea 1–2，塞在大花之間的縫隙（帶側）
  const fillerCount = rng() < 0.6 ? 2 : 1
  for (let i = 0; i < fillerCount; i++) {
    slots.push({
      t: i === 0 ? 0.18 : 0.36,
      lateral: (i % 2 === 0 ? -1 : 1) * lerp(0.9, 1.1, rng()),
      type: 'hydrangea',
      role: 'filler',
      sizeRel: CRESCENT.FILLER_SIZE,
    })
  }
  // 收尾：fivepetal 2–3 + hydrangea 小簇 1
  const tailCount = rng() < 0.5 ? 2 : 3
  for (let i = 0; i < tailCount; i++) {
    const k = i / (tailCount - 1)
    slots.push({
      t: lerp(0.66, 0.9, k),
      lateral: (i % 2 === 0 ? 1 : -1) * 0.3,
      type: 'fivepetal',
      role: 'tail',
      sizeRel: lerp(CRESCENT.TAIL_SIZE_MAX, CRESCENT.TAIL_SIZE_MIN, k),
    })
  }
  slots.push({ t: 0.97, lateral: 0, type: 'hydrangea', role: 'tail', sizeRel: CRESCENT.TAIL_HYD_SIZE })

  // 3. slot → 初始表面座標
  const works: Work[] = slots.map(slot => {
    const worldD = slot.sizeRel * FLOWER_DIAMETER.peony
    const scale = worldD / FLOWER_DIAMETER[slot.type]
    const theta = theta0 + dir * span * slot.t
    if (slot.t <= CRESCENT.T_EDGE) {
      const r = clamp(lerp(rFocal, R, slot.t / CRESCENT.T_EDGE) + slot.lateral, 0.4, R)
      return {
        slot, surface: 'top' as const,
        x: Math.cos(theta) * r, z: Math.sin(theta) * r,
        theta, y: topY, worldD, scale,
      }
    }
    const drop = ((slot.t - CRESCENT.T_EDGE) / (1 - CRESCENT.T_EDGE)) * dropMax
    return {
      slot, surface: 'side' as const,
      x: 0, z: 0,
      theta: theta + slot.lateral / R, y: topY - drop, worldD, scale,
    }
  })

  // 4. 空間鬆弛：滿足 §3 間距 / 重疊容忍，花只在各自表面的參數空間內移動
  relax(works, R, topY, dropMax)

  // 5. 朝向角（§3：同種花繞法線角差 ≥ 25°）與傾斜
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

  // 6. 依 §7 深淺規則挑選實體 tray 花（引擎不改色，只決定哪朵花放哪個位置）
  const idByWork = selectFlowerIds(works, flowers)

  // 7. 產出最終 transform
  const placements: PlacedFlower[] = works.map(w => {
    const lift = w.slot.role === 'focal' ? lerp(CRESCENT.FOCAL_LIFT_MIN, CRESCENT.FOCAL_LIFT_MAX, rng()) : 0
    const { point, normal } =
      w.surface === 'top'
        ? topFacePoint(cake, Math.hypot(w.x, w.z), Math.atan2(w.z, w.x))
        : sideFacePoint(cake, w.theta, topY - w.y)
    const { position, rotation } = placeOnSurface(point, normal, facings.get(w) ?? 0, tilts.get(w) ?? 0, lift)
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
      groupId: 0,
    }
  })

  return { layout: 'crescent', seed, attempts, placements }
}

// ── 空間鬆弛 ─────────────────────────────────────────────────────────────────

function worldPos(w: Work, R: number): [number, number, number] {
  if (w.surface === 'top') return [w.x, w.y, w.z]
  return [Math.cos(w.theta) * R, w.y, Math.sin(w.theta) * R]
}

/** 兩朵花的中心距下限（§3 間距與重疊容忍，對應 SPACING 係數） */
function minCenterDist(a: Work, b: Work): number {
  const rr = (a.worldD + b.worldD) / 2
  if (a.slot.role === 'focal' && b.slot.role === 'focal') return rr * SPACING.FOCAL_DIST_FACTOR
  const f = a.slot.type === b.slot.type ? SPACING.SAME_TYPE_DIST_FACTOR : SPACING.DIFF_TYPE_DIST_FACTOR
  return rr * f
}

function relax(works: Work[], R: number, topY: number, dropMax: number): void {
  const ITER = 60
  const minY = topY - Math.max(dropMax, CRESCENT.SIDE_DROP_MAX * (topY * 2)) // 側面允許帶
  for (let iter = 0; iter < ITER; iter++) {
    let moved = false
    for (let i = 0; i < works.length; i++) {
      for (let j = i + 1; j < works.length; j++) {
        const a = works[i]
        const b = works[j]
        const pa = worldPos(a, R)
        const pb = worldPos(b, R)
        let dx = pb[0] - pa[0]
        let dy = pb[1] - pa[1]
        let dz = pb[2] - pa[2]
        let dist = Math.hypot(dx, dy, dz)
        const need = minCenterDist(a, b)
        if (dist >= need) continue
        moved = true
        if (dist < 1e-4) {
          // 同點：沿流向錯開
          dx = 1; dy = 0; dz = 0; dist = 1
        }
        const push = ((need - dist) / dist) * 0.5
        applyPush(a, [-dx * push, -dy * push, -dz * push], R, topY, minY)
        applyPush(b, [dx * push, dy * push, dz * push], R, topY, minY)
      }
    }
    if (!moved) break
  }
}

/** 把 3D 推力投影回花所在表面的自由度（top：xz 平面；side：θ 與 y） */
function applyPush(w: Work, push: [number, number, number], R: number, topY: number, minY: number): void {
  if (w.surface === 'top') {
    w.x += push[0]
    w.z += push[2]
    const r = Math.hypot(w.x, w.z)
    if (r > R) {
      // 中心點最遠到頂面邊緣（§4：花瓣可懸空，中心不出邊）
      w.x *= R / r
      w.z *= R / r
    }
  } else {
    const tx = -Math.sin(w.theta)
    const tz = Math.cos(w.theta)
    w.theta += ((push[0] * tx + push[2] * tz) / R)
    w.y = clamp(w.y + push[1], minY, topY)
  }
}

// ── 朝向角分配 ───────────────────────────────────────────────────────────────

/** 為同種花分配繞法線朝向角，保證兩兩相差 ≥ MIN_FACING_DIFF_DEG */
function assignFacings(count: number, rng: Rng): number[] {
  if (count === 0) return []
  const base = rng() * 360
  const step = 360 / count
  // step 對庫存上限（8 朵 → 45°）恆 > 25°；jitter 限制在不破壞最小差的範圍
  const jitterMax = Math.max(0, (step - SPACING.MIN_FACING_DIFF_DEG) / 2 - 1)
  const order = shuffle([...Array(count).keys()], rng)
  return order.map(i => (base + i * step + (rng() * 2 - 1) * jitterMax + 360) % 360)
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── 實體花挑選（§7 深淺分配，best effort，D5 決議不做精確比例） ────────────────

function selectFlowerIds(works: Work[], flowers: Flower[]): Map<Work, string> {
  const map = new Map<Work, string>()
  const types: FlowerType[] = ['rose', 'hydrangea', 'peony', 'fivepetal']
  for (const type of types) {
    // 該型花的 slot，按花流順序
    const group = works.filter(w => w.slot.type === type).sort((a, b) => a.slot.t - b.slot.t)
    if (group.length === 0) continue
    // tray 庫存按亮度排序（暗 → 亮）
    const pool = flowers.filter(f => f.type === type).sort((a, b) => luminance(a.color) - luminance(b.color))
    // 庫存為硬上限（D1）：不足時捨棄多出的 slot（依目前 slot 計畫不會發生，防禦性處理）
    const usable = group.slice(0, pool.length)
    const picked = pickShadesForFlow(pool, usable.length)
    usable.forEach((w, i) => map.set(w, picked[i].id))
  }
  // 被捨棄的 slot（無庫存可用）從 works 移除
  for (let i = works.length - 1; i >= 0; i--) {
    if (!map.has(works[i])) works.splice(i, 1)
  }
  return map
}

/**
 * 從暗→亮排序的庫存挑 n 朵並排出花流順序：
 * 焦點端用較深（§7：焦點花 = 中等明度+較高彩度，梯度中最鮮豔端），
 * 尾端用較淺（填充花 = 高明度低彩度），中間交錯避免深淺成帶（§7 深淺穿插）。
 */
function pickShadesForFlow(pool: Flower[], n: number): Flower[] {
  // 均勻取樣 n 朵（涵蓋整個深淺範圍）
  const chosen: Flower[] = []
  for (let i = 0; i < n; i++) {
    const idx = n === 1 ? 0 : Math.round((i * (pool.length - 1)) / (n - 1))
    chosen.push(pool[idx])
  }
  // 去重（round 可能撞同一朵）
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
  // 花流順序：最深在焦點端，其餘深淺交錯（0,2,4,…,5,3,1 式布局避免單調帶）
  const sorted = [...unique].sort((a, b) => luminance(a.color) - luminance(b.color))
  const out: Flower[] = []
  const evens = sorted.filter((_, i) => i % 2 === 0)
  const odds = sorted.filter((_, i) => i % 2 === 1).reverse()
  out.push(...evens, ...odds)
  return out.slice(0, n)
}
