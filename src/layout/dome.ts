import type { Flower } from '../types'
import type { CakeSpec, LayoutResult } from './types'
import { DOME, FLOWER_DIAMETER } from './constants'
import {
  TAU, clamp, lerp, mulberry32,
  type GenSlot, type Rng, type Work, makeWork, relax,
  finalizeWorks, generateWithRetry,
} from './common'
import type { ConstraintReport } from './constraints'

/**
 * 滿版圓頂佈局（layout-direction §2C）。
 * 焦點花群偏心約 1/4 半徑，向四周不規則填充到頂面邊緣，
 * 邊緣花垂落側面 10–30% 高度，整體呈中間高、邊緣低的 dome 輪廓。
 *
 * ⚠ 已知限制（D1 決議：庫存 26 朵為硬上限，不生成額外花朵）：
 * 在 §2C 的尺寸遞減範圍內，庫存可用花的投影面積總和達不到
 * §9 5C「頂面覆蓋 ≥ 80%」；此佈局的 coverage 檢查預期 FAIL，
 * 生成器回傳違規最少的版本。詳見 backlog.md【設計提議】。
 */

export function generateDome(
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

  // 1. 焦點花群位置：偏心約 1/4 半徑（§2C）
  const thetaF = rng() * TAU
  const fx = Math.cos(thetaF) * DOME.FOCAL_OFFSET * R
  const fz = Math.sin(thetaF) * DOME.FOCAL_OFFSET * R

  const works: Work[] = []
  const pushTop = (slot: GenSlot, x: number, z: number) => {
    const r = Math.hypot(x, z)
    if (r > R) {
      x *= R / r
      z *= R / r
    }
    works.push(makeWork(slot, { surface: 'top', x, z, topY }))
  }

  // 2. 焦點區：peony 2 + rose 1（§2C；共 3 朵焦點花 = 奇數）
  const roseRel = FLOWER_DIAMETER.rose / FLOWER_DIAMETER.peony
  const focalSlots: GenSlot[] = [
    { t: 0, type: 'peony', role: 'focal', sizeRel: 1.0, groupId: 0 },
    { t: 0.05, type: 'peony', role: 'focal', sizeRel: 0.95, groupId: 0 },
    { t: 0.1, type: 'rose', role: 'focal', sizeRel: roseRel, groupId: 0 },
  ]
  focalSlots.forEach((slot, i) => {
    const ang = thetaF + (i * TAU) / 3 + rng() * 0.6
    const d = i === 0 ? 0 : lerp(1.0, 1.5, rng())
    pushTop(slot, fx + Math.cos(ang) * d, fz + Math.sin(ang) * d)
  })

  // 3. 中間區：rose 4 + hydrangea 3（§2C：rose 3–5 + hydrangea 2–3 簇），
  //    不規則填充：隨機 (r, θ)，由 relax 解開重疊
  const midRoseCount = 4
  for (let i = 0; i < midRoseCount; i++) {
    const k = i / (midRoseCount - 1)
    const ang = rng() * TAU
    const r = lerp(0.3, 0.7, rng()) * R
    pushTop(
      { t: 0.4, type: 'rose', role: 'mid', sizeRel: lerp(DOME.MID_SIZE_MAX, DOME.MID_SIZE_MIN, k), groupId: 0 },
      Math.cos(ang) * r,
      Math.sin(ang) * r,
    )
  }
  for (let i = 0; i < 3; i++) {
    const ang = rng() * TAU
    const r = lerp(0.35, 0.75, rng()) * R
    pushTop(
      { t: 0.5, type: 'hydrangea', role: 'mid', sizeRel: lerp(DOME.MID_SIZE_MIN, DOME.MID_SIZE_MAX, rng()), groupId: 0 },
      Math.cos(ang) * r,
      Math.sin(ang) * r,
    )
  }

  // 4. 縫隙填充：hydrangea 4（§2C：hydrangea 是滿版最重要的面積填充器）
  for (let i = 0; i < 4; i++) {
    const ang = rng() * TAU
    const r = lerp(0.45, 0.85, rng()) * R
    pushTop(
      { t: 0.6, type: 'hydrangea', role: 'filler', sizeRel: lerp(0.5, DOME.MID_SIZE_MIN, rng()), groupId: 0 },
      Math.cos(ang) * r,
      Math.sin(ang) * r,
    )
  }

  // 5. 邊緣收尾：fivepetal 6 + 縮小 rose 1 當花苞（§2C），沿邊緣環狀分佈
  const edgeCount = 6
  const edgeBase = rng() * TAU
  for (let i = 0; i < edgeCount; i++) {
    const ang = edgeBase + (i * TAU) / edgeCount + (rng() * 2 - 1) * 0.3
    const r = lerp(0.86, 0.98, rng()) * R
    pushTop(
      { t: 0.9, type: 'fivepetal', role: 'tail', sizeRel: lerp(DOME.EDGE_SIZE_MIN, DOME.EDGE_SIZE_MAX, rng()), groupId: 0 },
      Math.cos(ang) * r,
      Math.sin(ang) * r,
    )
  }
  pushTop(
    { t: 0.9, type: 'rose', role: 'tail', sizeRel: DOME.EDGE_SIZE_MIN + 0.05, groupId: 0 },
    Math.cos(edgeBase + 0.5) * 0.92 * R,
    Math.sin(edgeBase + 0.5) * 0.92 * R,
  )

  // 6. 垂落側面：fivepetal 2，深度 10–30% 蛋糕高度（§2C）
  for (let i = 0; i < 2; i++) {
    const drop = lerp(DOME.SIDE_DROP_MIN, DOME.SIDE_DROP_MAX, rng()) * cake.height
    works.push(
      makeWork(
        { t: 1, type: 'fivepetal', role: 'tail', sizeRel: DOME.EDGE_SIZE_MIN, groupId: 0 },
        { surface: 'side', theta: rng() * TAU, y: topY - drop },
      ),
    )
  }

  // 7. 空間鬆弛（§3）
  relax(works, { R, topY, minY: topY - DOME.SIDE_DROP_MAX * cake.height })

  // 8. 定稿。dome 輪廓（§2C：中間高、邊緣低）：焦點花抬升最多，
  //    中間區依 t 遞減抬升，邊緣不抬升
  return finalizeWorks('dome', works, flowers, cake, rng, seed, attempts, (w, r: Rng) => {
    if (w.slot.role === 'focal') return lerp(DOME.FOCAL_LIFT_MIN, DOME.FOCAL_LIFT_MAX, r())
    if (w.surface === 'top' && w.slot.t < 0.9) return DOME.MID_LIFT_MAX * clamp(1 - w.slot.t, 0, 1)
    return 0
  })
}
