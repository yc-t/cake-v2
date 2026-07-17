import * as THREE from 'three'
import type { CakeSpec } from './types'

/**
 * 手動拖曳（DragManager）與佈局引擎共用的放置數學。
 * 兩條路徑必須走同一套規則，保證自動佈局與手動拖曳的落點行為一致
 * （layout-engine-spec §6：手動調整行為與現有拖曳吸附系統一致）。
 */

export const SURFACE_OFFSET = 0.02

const UP = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)
const DEG = Math.PI / 180

export type SurfacePlacement = {
  position: [number, number, number]
  rotation: [number, number, number]
}

/** 表面點 + 法線 → 最終 transform。原 DragManager onUp 內的計算，行為不變。 */
export function surfaceTransform(point: THREE.Vector3, normal: THREE.Vector3): SurfacePlacement {
  return placeOnSurface(point, normal, 0, 0, 0)
}

/**
 * 佈局引擎用的擴充版：加上繞法線的朝向角（facing）、傾斜角（tilt）、抬升（lift）。
 * facing = tilt = lift = 0 時與 surfaceTransform（手動拖曳路徑）完全等價。
 */
export function placeOnSurface(
  point: THREE.Vector3,
  normal: THREE.Vector3,
  facingDeg: number,
  tiltDeg: number,
  lift: number,
): SurfacePlacement {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, normal)
  if (facingDeg !== 0) q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, facingDeg * DEG))
  if (tiltDeg !== 0) q.multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, tiltDeg * DEG))
  const e = new THREE.Euler().setFromQuaternion(q)
  const pos = point.clone().addScaledVector(normal, SURFACE_OFFSET + lift)
  return { position: [pos.x, pos.y, pos.z], rotation: [e.x, e.y, e.z] }
}

/**
 * 蛋糕表面的解析幾何。蛋糕是置中原點的理想圓柱（cylinderGeometry），
 * 解析計算的表面點與法線和 raycast 命中結果等價（impact analysis 假設 D-8）。
 */

/** 頂面（y = height/2）上極座標 (r, θ) 的表面點與法線 */
export function topFacePoint(cake: CakeSpec, r: number, thetaRad: number) {
  return {
    point: new THREE.Vector3(Math.cos(thetaRad) * r, cake.height / 2, Math.sin(thetaRad) * r),
    normal: new THREE.Vector3(0, 1, 0),
  }
}

/** 側面上 (θ, drop) 的表面點與徑向法線。drop = 從頂面邊緣往下的距離 */
export function sideFacePoint(cake: CakeSpec, thetaRad: number, drop: number) {
  const n = new THREE.Vector3(Math.cos(thetaRad), 0, Math.sin(thetaRad))
  return {
    point: new THREE.Vector3(n.x * cake.radius, cake.height / 2 - drop, n.z * cake.radius),
    normal: n,
  }
}
