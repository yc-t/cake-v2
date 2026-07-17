import type { Flower } from '../types'
import type { CakeSpec, LayoutResult } from './types'
import { CRESCENT, FLOWER_DIAMETER } from './constants'
import {
  DEG, TAU, clamp, lerp, mulberry32,
  type GenSlot, type Work, makeWork, relax,
  finalizeWorks, generateWithRetry,
} from './common'
import type { ConstraintReport } from './constraints'

/**
 * 新月弧佈局（layout-direction §2A）。
 * 花從頂面某側的焦點出發，沿弧線流動並跨越邊緣垂落側面，形成對角帶狀花流。
 *
 * 生成流程：隨機參數 → 沿花流佈 slot → 空間鬆弛（§3 間距）→ 選 tray 花（§7 深淺）
 * → 硬約束檢查；不通過換 seed 重試（引擎內部復用檢查器，ADR D4 validator 路線）。
 */

type Slot = GenSlot & {
  /** 垂直於流向的偏移（世界單位），只在初始佈點時用 */
  lateral: number
}

export function generateCrescent(
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

  // 1. 花流幾何
  const theta0 = rng() * TAU
  const dir = rng() < 0.5 ? 1 : -1
  const span = lerp(CRESCENT.ARC_SPAN_MIN_DEG, CRESCENT.ARC_SPAN_MAX_DEG, rng()) * DEG
  const rFocal = lerp(CRESCENT.FOCAL_R_MIN, CRESCENT.FOCAL_R_MAX, rng()) * R
  const dropMax = lerp(CRESCENT.SIDE_DROP_MIN, CRESCENT.SIDE_DROP_MAX, rng()) * cake.height

  // 2. slot 計畫（§2A 花型角色 + 大小遞減）
  const slots: Slot[] = []
  // 焦點：peony 2 + rose 1 = 3 朵（奇數，滿足跨佈局驗收；§2A：peony 1–2 + rose 1）
  slots.push({ t: 0.02, lateral: 0.15, type: 'rose', role: 'focal', sizeRel: FLOWER_DIAMETER.rose / FLOWER_DIAMETER.peony, groupId: 0 })
  slots.push({ t: 0.05, lateral: -0.6, type: 'peony', role: 'focal', sizeRel: 1.0, groupId: 0 })
  slots.push({ t: 0.13, lateral: 0.55, type: 'peony', role: 'focal', sizeRel: 0.92, groupId: 0 })
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
      groupId: 0,
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
      groupId: 0,
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
      groupId: 0,
    })
  }
  slots.push({ t: 0.97, lateral: 0, type: 'hydrangea', role: 'tail', sizeRel: CRESCENT.TAIL_HYD_SIZE, groupId: 0 })

  // 3. slot → 初始表面座標（沿花流曲線）
  const works: Work[] = slots.map(slot => {
    const theta = theta0 + dir * span * slot.t
    if (slot.t <= CRESCENT.T_EDGE) {
      const r = clamp(lerp(rFocal, R, slot.t / CRESCENT.T_EDGE) + slot.lateral, 0.4, R)
      return makeWork(slot, { surface: 'top', x: Math.cos(theta) * r, z: Math.sin(theta) * r, topY })
    }
    const drop = ((slot.t - CRESCENT.T_EDGE) / (1 - CRESCENT.T_EDGE)) * dropMax
    return makeWork(slot, { surface: 'side', theta: theta + slot.lateral / R, y: topY - drop })
  })

  // 4. 空間鬆弛（§3）
  relax(works, { R, topY, minY: topY - CRESCENT.SIDE_DROP_MAX * cake.height })

  // 5. 定稿：朝向、傾斜、選花、transform（§7 大花抬升：焦點花 lift）
  return finalizeWorks('crescent', works, flowers, cake, rng, seed, attempts, (w, r) =>
    w.slot.role === 'focal' ? lerp(CRESCENT.FOCAL_LIFT_MIN, CRESCENT.FOCAL_LIFT_MAX, r()) : 0,
  )
}
