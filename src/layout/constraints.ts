import type { CakeSpec, LayoutResult, PlacedFlower } from './types'
import { LIMITS, SPACING } from './constants'

/**
 * 硬約束檢查器：驗證 layout-engine-spec §9 標記「可程式檢查」的驗收標準。
 * 輸入是佈局引擎的記憶體回傳值（含 metadata），不從 flower JSON 反推（D2 決議）。
 *
 * bounding box 近似：每朵花視為邊長 = worldDiameter 的立方體，
 * 中心在表面點沿法線外推 0.3 × worldDiameter 處（normalizeFlower 保證花底在表面，
 * 花體重心約在下半部）。與 impact analysis 假設 D-10 一致。
 */

export type ConstraintCheck = {
  id: string
  pass: boolean
  value: string
  limit: string
}

export type ConstraintReport = { pass: boolean; checks: ConstraintCheck[] }

const BBOX_CENTER_LIFT = 0.3 // ×worldDiameter，bbox 中心沿法線外推比例
const GRID_N = 160 // 頂面覆蓋率的取樣格數（GRID_N × GRID_N 覆蓋外接正方形）

export function checkLayout(result: LayoutResult, cake: CakeSpec): ConstraintReport {
  const checks: ConstraintCheck[] = [
    checkFocalOdd(result.placements),
    checkSameTypeOverlap(result.placements),
    checkSameTypeFacing(result.placements),
  ]
  if (result.layout === 'crescent') {
    const { coverage, bareContinuous } = topCoverage(result.placements, cake)
    checks.push({
      id: 'crescent-top-coverage',
      pass: coverage <= LIMITS.CRESCENT_TOP_COVERAGE_MAX,
      value: `${(coverage * 100).toFixed(1)}%`,
      limit: `≤ ${LIMITS.CRESCENT_TOP_COVERAGE_MAX * 100}%`,
    })
    checks.push({
      id: 'crescent-bare-continuous',
      pass: bareContinuous >= LIMITS.CRESCENT_BARE_CONTINUOUS_MIN,
      value: `${(bareContinuous * 100).toFixed(1)}%`,
      limit: `≥ ${(LIMITS.CRESCENT_BARE_CONTINUOUS_MIN * 100).toFixed(0)}%（最大連續裸露區）`,
    })
    checks.push(checkThickThinRatio(result.placements))
  }
  if (result.layout === 'wreath') {
    checks.push(checkWreathAngle(result.placements))
    checks.push(checkWreathCenterClear(result.placements, cake))
  }
  if (result.layout === 'dome') {
    const { coverage } = topCoverage(result.placements, cake)
    checks.push({
      id: 'dome-top-coverage',
      pass: coverage >= LIMITS.DOME_TOP_COVERAGE_MIN,
      value: `${(coverage * 100).toFixed(1)}%`,
      limit: `≥ ${LIMITS.DOME_TOP_COVERAGE_MIN * 100}%`,
    })
    checks.push(checkDomeFocalOffcenter(result.placements, cake))
  }
  return { pass: checks.every(c => c.pass), checks }
}

// ── 跨佈局通用 ───────────────────────────────────────────────────────────────

/** 焦點花數量為奇數（1 或 3） */
function checkFocalOdd(placements: PlacedFlower[]): ConstraintCheck {
  const n = placements.filter(p => p.role === 'focal').length
  return {
    id: 'focal-count-odd',
    pass: n === 1 || n === 3,
    value: `${n}`,
    limit: '1 或 3',
  }
}

/** 同種花 bbox 重疊 ≤ 30% */
function checkSameTypeOverlap(placements: PlacedFlower[]): ConstraintCheck {
  let worst = 0
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i]
      const b = placements[j]
      if (a.type !== b.type) continue
      worst = Math.max(worst, bboxOverlapFraction(a, b))
    }
  }
  return {
    id: 'same-type-overlap',
    pass: worst <= LIMITS.SAME_TYPE_OVERLAP_MAX,
    value: `${(worst * 100).toFixed(1)}%`,
    limit: `≤ ${LIMITS.SAME_TYPE_OVERLAP_MAX * 100}%`,
  }
}

/** 同種花繞法線朝向角差 ≥ 25° */
function checkSameTypeFacing(placements: PlacedFlower[]): ConstraintCheck {
  let worst = 360
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i]
      const b = placements[j]
      if (a.type !== b.type) continue
      const d = Math.abs(a.facingAngleDeg - b.facingAngleDeg) % 360
      worst = Math.min(worst, Math.min(d, 360 - d))
    }
  }
  return {
    id: 'same-type-facing-diff',
    pass: worst >= SPACING.MIN_FACING_DIFF_DEG,
    value: worst === 360 ? 'n/a（無同種花對）' : `${worst.toFixed(1)}°`,
    limit: `≥ ${SPACING.MIN_FACING_DIFF_DEG}°`,
  }
}

// ── 新月弧專屬 ───────────────────────────────────────────────────────────────

/** 厚端花群寬度 ≥ 2× 薄端。寬度 = 對花流方向的垂直展幅（含花半徑）。 */
function checkThickThinRatio(placements: PlacedFlower[]): ConstraintCheck {
  const thick = placements.filter(p => p.flowT <= 0.3)
  const thin = placements.filter(p => p.flowT >= 0.7)
  const wThick = bandWidth(thick)
  const wThin = bandWidth(thin)
  const ratio = wThin > 0 ? wThick / wThin : 0
  return {
    id: 'crescent-thick-thin-ratio',
    pass: thick.length > 0 && thin.length > 0 && ratio >= LIMITS.CRESCENT_THICK_THIN_RATIO_MIN,
    value: `${wThick.toFixed(2)} / ${wThin.toFixed(2)} = ${ratio.toFixed(2)}`,
    limit: `≥ ${LIMITS.CRESCENT_THICK_THIN_RATIO_MIN}`,
  }
}

/**
 * 花群寬度：以群內 flowT 最小/最大兩朵的連線為「流向」，
 * 寬度 = 2 × max(各花中心到流向軸的垂距 + 花半徑)。單朵時 = 直徑。
 */
function bandWidth(group: PlacedFlower[]): number {
  if (group.length === 0) return 0
  if (group.length === 1) return group[0].worldDiameter
  const sorted = [...group].sort((a, b) => a.flowT - b.flowT)
  const first = sorted[0].position
  const last = sorted[sorted.length - 1].position
  let ax = last[0] - first[0]
  let ay = last[1] - first[1]
  let az = last[2] - first[2]
  const len = Math.hypot(ax, ay, az)
  if (len < 1e-6) {
    // 群內花幾乎同點：寬度 = 最大直徑
    return Math.max(...group.map(p => p.worldDiameter))
  }
  ax /= len
  ay /= len
  az /= len
  // 群中心
  const cx = group.reduce((s, p) => s + p.position[0], 0) / group.length
  const cy = group.reduce((s, p) => s + p.position[1], 0) / group.length
  const cz = group.reduce((s, p) => s + p.position[2], 0) / group.length
  let half = 0
  for (const p of group) {
    const dx = p.position[0] - cx
    const dy = p.position[1] - cy
    const dz = p.position[2] - cz
    const along = dx * ax + dy * ay + dz * az
    const px = dx - along * ax
    const py = dy - along * ay
    const pz = dz - along * az
    half = Math.max(half, Math.hypot(px, py, pz) + p.worldDiameter / 2)
  }
  return half * 2
}

// ── 雙群花圈專屬 ─────────────────────────────────────────────────────────────

/** 兩花群焦點花的角度差 120°–210°。以各群 worldDiameter 最大的焦點花為代表；
 *  兩方向間的角度差幾何上最大 180°，因此有效檢查為 ≥ 120°。 */
function checkWreathAngle(placements: PlacedFlower[]): ConstraintCheck {
  const primaryOf = (gid: number): PlacedFlower | undefined =>
    placements
      .filter(p => p.role === 'focal' && p.groupId === gid)
      .sort((a, b) => b.worldDiameter - a.worldDiameter)[0]
  const fA = primaryOf(0)
  const fB = primaryOf(1)
  if (!fA || !fB) {
    return { id: 'wreath-angle-diff', pass: false, value: '缺少花群焦點花', limit: '120°–210°' }
  }
  const angA = Math.atan2(fA.position[2], fA.position[0])
  const angB = Math.atan2(fB.position[2], fB.position[0])
  let d = Math.abs(angA - angB) * (180 / Math.PI)
  d = d % 360
  if (d > 180) d = 360 - d
  return {
    id: 'wreath-angle-diff',
    pass: d >= LIMITS.WREATH_ANGLE_MIN_DEG && d <= LIMITS.WREATH_ANGLE_MAX_DEG,
    value: `${d.toFixed(1)}°`,
    limit: `${LIMITS.WREATH_ANGLE_MIN_DEG}°–${LIMITS.WREATH_ANGLE_MAX_DEG}°`,
  }
}

/** 頂面中央留白直徑 ≥ 30% 蛋糕直徑（中央區域內無花的投影圓） */
function checkWreathCenterClear(placements: PlacedFlower[], cake: CakeSpec): ConstraintCheck {
  const R = cake.radius
  let clearR = R
  for (const p of placements) {
    if (p.surface !== 'top') continue
    const rc = Math.hypot(p.position[0], p.position[2]) - p.worldDiameter / 2
    clearR = Math.min(clearR, rc)
  }
  clearR = Math.max(clearR, 0)
  // 留白直徑比 = 2·clearR / 2R = clearR / R
  const frac = clearR / R
  return {
    id: 'wreath-center-clear',
    pass: frac >= LIMITS.WREATH_CENTER_CLEAR_MIN,
    value: `${(frac * 100).toFixed(1)}%（留白直徑/蛋糕直徑）`,
    limit: `≥ ${LIMITS.WREATH_CENTER_CLEAR_MIN * 100}%`,
  }
}

// ── 滿版圓頂專屬 ─────────────────────────────────────────────────────────────

/** 焦點花最高點距圓心 ≥ 15% 半徑（不在正中心） */
function checkDomeFocalOffcenter(placements: PlacedFlower[], cake: CakeSpec): ConstraintCheck {
  const focals = placements.filter(p => p.role === 'focal')
  if (focals.length === 0) {
    return { id: 'dome-focal-offcenter', pass: false, value: '無焦點花', limit: `≥ ${LIMITS.DOME_FOCAL_OFFCENTER_MIN * 100}% 半徑` }
  }
  const highest = focals.reduce((a, b) => (a.position[1] >= b.position[1] ? a : b))
  const dist = Math.hypot(highest.position[0], highest.position[2])
  const frac = dist / cake.radius
  return {
    id: 'dome-focal-offcenter',
    pass: frac >= LIMITS.DOME_FOCAL_OFFCENTER_MIN,
    value: `${(frac * 100).toFixed(1)}% 半徑`,
    limit: `≥ ${LIMITS.DOME_FOCAL_OFFCENTER_MIN * 100}% 半徑`,
  }
}

// ── 幾何工具 ────────────────────────────────────────────────────────────────

function surfaceNormalOf(p: PlacedFlower): [number, number, number] {
  if (p.surface === 'side') {
    const len = Math.hypot(p.position[0], p.position[2]) || 1
    return [p.position[0] / len, 0, p.position[2] / len]
  }
  return [0, 1, 0] // top / board
}

/** 兩朵花的近似 bbox 重疊比例 = 交集體積 / 較小 bbox 體積 */
function bboxOverlapFraction(a: PlacedFlower, b: PlacedFlower): number {
  const boxA = bboxOf(a)
  const boxB = bboxOf(b)
  let inter = 1
  for (let k = 0; k < 3; k++) {
    const w = Math.min(boxA.max[k], boxB.max[k]) - Math.max(boxA.min[k], boxB.min[k])
    if (w <= 0) return 0
    inter *= w
  }
  const volA = a.worldDiameter ** 3
  const volB = b.worldDiameter ** 3
  return inter / Math.min(volA, volB)
}

function bboxOf(p: PlacedFlower): { min: [number, number, number]; max: [number, number, number] } {
  const n = surfaceNormalOf(p)
  const h = p.worldDiameter / 2
  const c: [number, number, number] = [
    p.position[0] + n[0] * BBOX_CENTER_LIFT * p.worldDiameter,
    p.position[1] + n[1] * BBOX_CENTER_LIFT * p.worldDiameter,
    p.position[2] + n[2] * BBOX_CENTER_LIFT * p.worldDiameter,
  ]
  return {
    min: [c[0] - h, c[1] - h, c[2] - h],
    max: [c[0] + h, c[1] + h, c[2] + h],
  }
}

/**
 * 頂面覆蓋率與最大連續裸露區比例。
 * 把頂面圓盤取樣成格子，頂面花以投影圓（直徑 = worldDiameter）標記覆蓋；
 * 連續裸露區用 4 連通 flood fill 找最大空白區。
 */
export function topCoverage(
  placements: PlacedFlower[],
  cake: CakeSpec,
): { coverage: number; bareContinuous: number } {
  const R = cake.radius
  const cell = (R * 2) / GRID_N
  const topFlowers = placements
    .filter(p => p.surface === 'top')
    .map(p => ({ x: p.position[0], z: p.position[2], r: p.worldDiameter / 2 }))

  // 0 = 盤外, 1 = 裸露, 2 = 覆蓋
  const grid = new Uint8Array(GRID_N * GRID_N)
  let diskCells = 0
  let covered = 0
  for (let i = 0; i < GRID_N; i++) {
    for (let j = 0; j < GRID_N; j++) {
      const x = -R + (i + 0.5) * cell
      const z = -R + (j + 0.5) * cell
      if (x * x + z * z > R * R) continue
      const idx = i * GRID_N + j
      diskCells++
      let hit = false
      for (const f of topFlowers) {
        const dx = x - f.x
        const dz = z - f.z
        if (dx * dx + dz * dz <= f.r * f.r) {
          hit = true
          break
        }
      }
      if (hit) {
        grid[idx] = 2
        covered++
      } else {
        grid[idx] = 1
      }
    }
  }
  if (diskCells === 0) return { coverage: 0, bareContinuous: 0 }

  // flood fill 最大裸露連通區
  let largest = 0
  const stack: number[] = []
  for (let s = 0; s < grid.length; s++) {
    if (grid[s] !== 1) continue
    let size = 0
    grid[s] = 3
    stack.push(s)
    while (stack.length > 0) {
      const cur = stack.pop() as number
      size++
      const ci = Math.floor(cur / GRID_N)
      const cj = cur % GRID_N
      if (ci > 0 && grid[cur - GRID_N] === 1) { grid[cur - GRID_N] = 3; stack.push(cur - GRID_N) }
      if (ci < GRID_N - 1 && grid[cur + GRID_N] === 1) { grid[cur + GRID_N] = 3; stack.push(cur + GRID_N) }
      if (cj > 0 && grid[cur - 1] === 1) { grid[cur - 1] = 3; stack.push(cur - 1) }
      if (cj < GRID_N - 1 && grid[cur + 1] === 1) { grid[cur + 1] = 3; stack.push(cur + 1) }
    }
    largest = Math.max(largest, size)
  }

  return { coverage: covered / diskCells, bareContinuous: largest / diskCells }
}
