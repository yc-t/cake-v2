import type { Flower } from '../types'
import type { CakeSpec, LayoutResult } from './types'
import { FLOWER_DIAMETER, WREATH } from './constants'
import {
  DEG, TAU, lerp, mulberry32, shuffle,
  type GenSlot, type Rng, type Work, makeWork, relax,
  finalizeWorks, generateWithRetry,
} from './common'
import type { ConstraintReport } from './constraints'

/**
 * 雙群花圈佈局（layout-direction §2B）。
 * 兩個密集花群分據頂面兩個對角位置（角度差 150–210°），之間用零散中型花
 * 串聯成不均勻環狀，頂面中央留出大面積空白。
 *
 * 設計決定：連接段花分佈在兩側弧上（不是只有一側），以形成 §5B 目測要求的
 * 「環」的暗示；兩群花型組成依 §2B 不對稱。
 * 花群外緣花可微微越過頂面到側面（§2B：0–20% 高度）——本實作取 0%（範圍內），
 * 全部花放頂面，由 relax 的中央留白約束推出環形。
 */

type GroupSpec = {
  groupId: number
  theta: number
  focalR: number
  spread: number
  slots: { type: GenSlot['type']; role: GenSlot['role']; sizeRel: number }[]
}

export function generateWreath(
  flowers: Flower[],
  cake: CakeSpec,
  seed: number = (Date.now() & 0xffff) >>> 0,
): { result: LayoutResult; report: ConstraintReport } {
  return generateWithRetry(cake, seed, (s, attempts) => generateOnce(flowers, cake, s, attempts))
}

function generateOnce(flowers: Flower[], cake: CakeSpec, seed: number, attempts: number): LayoutResult {
  const rng = mulberry32(seed)
  const R = cake.radius
  const topY = cake.height / 2

  // 1. 兩群的幾何：θA 隨機，θB = θA ± (150–210°)
  const thetaA = rng() * TAU
  const angleDiff = lerp(WREATH.ANGLE_DIFF_MIN_DEG, WREATH.ANGLE_DIFF_MAX_DEG, rng()) * DEG
  const dir = rng() < 0.5 ? 1 : -1
  const thetaB = thetaA + dir * angleDiff
  const holeR = lerp(WREATH.HOLE_R_MIN, WREATH.HOLE_R_MAX, rng()) * R

  // 2. 兩群的花型組成（§2B，兩群不對稱）
  //    焦點花共 3 朵（奇數）：A-peony、A-rose、B-rose
  const roseRel = FLOWER_DIAMETER.rose / FLOWER_DIAMETER.peony
  // 2026-07-18 覆蓋率×2：主焦點改英雄花尺寸、兩群各加 1 rose 填充 + 1 fivepetal
  const groupA: GroupSpec = {
    groupId: 0,
    theta: thetaA,
    focalR: lerp(WREATH.FOCAL_R_MIN, WREATH.FOCAL_R_MAX, rng()) * R,
    spread: lerp(WREATH.SPREAD_MIN, WREATH.SPREAD_MAX, rng()) * R,
    slots: [
      { type: 'peony', role: 'focal', sizeRel: lerp(WREATH.HERO_SIZE_MIN, WREATH.HERO_SIZE_MAX, rng()) },
      { type: 'rose', role: 'focal', sizeRel: roseRel },
      { type: 'rose', role: 'filler', sizeRel: lerp(0.5, 0.6, rng()) },
      { type: 'hydrangea', role: 'filler', sizeRel: lerp(WREATH.FILL_SIZE_MIN, WREATH.FILL_SIZE_MAX, rng()) },
      { type: 'hydrangea', role: 'filler', sizeRel: WREATH.FILL_SIZE_MIN },
      { type: 'fivepetal', role: 'filler', sizeRel: WREATH.FILL_SIZE_MIN },
      { type: 'fivepetal', role: 'filler', sizeRel: WREATH.FILL_SIZE_MIN * 0.9 },
      { type: 'fivepetal', role: 'filler', sizeRel: WREATH.FILL_SIZE_MIN * 0.8 },
    ],
  }
  const groupB: GroupSpec = {
    groupId: 1,
    theta: thetaB,
    focalR: lerp(WREATH.FOCAL_R_MIN, WREATH.FOCAL_R_MAX, rng()) * R,
    spread: lerp(WREATH.SPREAD_MIN, WREATH.SPREAD_MAX, rng()) * R,
    slots: [
      { type: 'rose', role: 'focal', sizeRel: roseRel },
      { type: 'rose', role: 'mid', sizeRel: roseRel * 0.9 },
      { type: 'hydrangea', role: 'mid', sizeRel: lerp(WREATH.FILL_SIZE_MIN, WREATH.FILL_SIZE_MAX, rng()) },
      { type: 'hydrangea', role: 'filler', sizeRel: WREATH.FILL_SIZE_MIN },
      { type: 'hydrangea', role: 'filler', sizeRel: WREATH.FILL_SIZE_MIN * 0.9 },
      { type: 'fivepetal', role: 'filler', sizeRel: WREATH.FILL_SIZE_MIN * 0.95 },
      { type: 'fivepetal', role: 'filler', sizeRel: WREATH.FILL_SIZE_MIN * 0.85 },
    ],
  }

  // 3. 群內佈點：焦點在群中心，其餘繞焦點散開
  const works: Work[] = []
  for (const g of [groupA, groupB]) {
    g.slots.forEach((s, i) => {
      const isFocal = i === 0
      const dist = isFocal ? 0 : lerp(0.55, 1.0, rng()) * g.spread
      const ang = rng() * TAU
      const cx = Math.cos(g.theta) * g.focalR + Math.cos(ang) * dist
      const cz = Math.sin(g.theta) * g.focalR + Math.sin(ang) * dist
      works.push(
        makeWork(
          { t: isFocal ? 0 : 0.5 + 0.5 * (dist / g.spread), type: s.type, role: s.role, sizeRel: s.sizeRel, groupId: g.groupId },
          { surface: 'top', x: cx, z: cz, topY },
        ),
      )
    })
  }

  // 4. 連接段（groupId 2）：3–4 朵中型 rose / fivepetal 交替，
  //    分佈在兩側弧上（兩群之間的短弧與長弧各放一部分），間距大、不成密集帶
  const connectorCount = rng() < 0.5 ? WREATH.CONNECTOR_MIN : WREATH.CONNECTOR_MAX
  const ringR = lerp(0.62, 0.75, rng()) * R
  // 短弧（θA→θB 沿 dir）與長弧（反向）各自的角度跨幅
  const shortSpan = angleDiff
  const longSpan = TAU - angleDiff
  const onShort = Math.ceil(connectorCount / 2)
  const onLong = connectorCount - onShort
  const connectorTypes = shuffle<GenSlot['type']>(['rose', 'fivepetal', 'rose', 'fivepetal'], rng)
  let ci = 0
  const pushConnector = (theta: number) => {
    const type = connectorTypes[ci % connectorTypes.length]
    const sizeRel = lerp(WREATH.CONNECTOR_SIZE_MIN, WREATH.CONNECTOR_SIZE_MAX, rng())
    works.push(
      makeWork(
        { t: 2, type, role: 'mid', sizeRel, groupId: 2 },
        { surface: 'top', x: Math.cos(theta) * ringR, z: Math.sin(theta) * ringR, topY },
      ),
    )
    ci++
  }
  for (let i = 0; i < onShort; i++) {
    const k = (i + 1) / (onShort + 1)
    pushConnector(thetaA + dir * shortSpan * k + (rng() * 2 - 1) * 0.12)
  }
  for (let i = 0; i < onLong; i++) {
    const k = (i + 1) / (onLong + 1)
    pushConnector(thetaA - dir * longSpan * k + (rng() * 2 - 1) * 0.12)
  }

  // 5. 空間鬆弛：§3 間距 + 中央留白（§2B 留白直徑 35–50% 蛋糕直徑）
  relax(works, { R, topY, minY: topY, holeR })

  // 6. 定稿（§7 焦點花抬升）
  return finalizeWorks('wreath', works, flowers, cake, rng, seed, attempts, (w, r: Rng) =>
    w.slot.role === 'focal' ? lerp(WREATH.FOCAL_LIFT_MIN, WREATH.FOCAL_LIFT_MAX, r()) : 0,
  )
}
