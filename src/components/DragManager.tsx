import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { AppState } from '../types'
import { Rose } from './Rose'
import { Hydrangea } from './Hydrangea'
import { Peony } from './Peony'
import { FivePetal } from './FivePetal'

const UP = new THREE.Vector3(0, 1, 0)
const SURFACE_OFFSET = 0.02

export type DragInfo = {
  flowerId: string
  startX: number
  startY: number
  didDrag: boolean
}

interface Props {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  cakeMeshRef: React.RefObject<THREE.Mesh | null>
  orbitRef: React.RefObject<{ enabled: boolean } | null>
  dragRef: React.RefObject<DragInfo | null>
  onCakeClick: () => void
}

export function DragManager({ state, setState, cakeMeshRef, orbitRef, dragRef, onCakeClick }: Props) {
  const { camera, gl } = useThree()

  const previewPos = useRef(new THREE.Vector3(0, 999, 0))
  const previewQuat = useRef(new THREE.Quaternion())
  const previewGroupRef = useRef<THREE.Group>(null)
  const rc = useRef(new THREE.Raycaster())
  const floatPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -3))
  const planeTarget = useRef(new THREE.Vector3())
  // Tracks where a non-flower left-click started, to distinguish orbit from click
  const bgDown = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const dom = gl.domElement

    function getNDC(e: PointerEvent) {
      const r = dom.getBoundingClientRect()
      return new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      )
    }

    function getSnap(ndc: THREE.Vector2) {
      rc.current.setFromCamera(ndc, camera)
      if (!cakeMeshRef.current) return null
      const hits = rc.current.intersectObject(cakeMeshRef.current)
      if (!hits.length) return null
      const hit = hits[0]
      const normal = hit.face!.normal.clone().transformDirection(cakeMeshRef.current.matrixWorld)
      if (normal.y < -0.9) return null
      return { point: hit.point, normal }
    }

    function onDown(e: PointerEvent) {
      if (e.button !== 0) return
      // Always record start position; used in onUp to distinguish click from orbit
      bgDown.current = { x: e.clientX, y: e.clientY }
    }

    function onMove(e: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return

      if (!drag.didDrag) {
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return
        drag.didDrag = true
        if (orbitRef.current) orbitRef.current.enabled = false
        setState(s => ({ ...s, draggingId: drag.flowerId, selectedId: null }))
      }

      const ndc = getNDC(e)
      const snap = getSnap(ndc)
      if (snap) {
        previewQuat.current.setFromUnitVectors(UP, snap.normal)
        previewPos.current.copy(snap.point).addScaledVector(snap.normal, SURFACE_OFFSET)
      } else {
        if (rc.current.ray.intersectPlane(floatPlane.current, planeTarget.current)) {
          previewPos.current.copy(planeTarget.current)
        }
        previewQuat.current.identity()
      }
    }

    function onUp(e: PointerEvent) {
      if (e.button !== 0) return

      const drag = dragRef.current

      if (!drag) {
        // Non-flower pointer up — check if it was a short click (not an orbit drag)
        const start = bgDown.current
        bgDown.current = null
        if (!start) return
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) >= 5) return // was orbit

        // Short click: check if cake was hit
        rc.current.setFromCamera(getNDC(e), camera)
        const cakeHit = cakeMeshRef.current
          ? rc.current.intersectObject(cakeMeshRef.current).length > 0
          : false

        if (cakeHit) {
          onCakeClick()
        } else {
          setState(s => s.selectedId ? { ...s, selectedId: null } : s)
        }
        return
      }

      dragRef.current = null
      bgDown.current = null
      if (orbitRef.current) orbitRef.current.enabled = true

      if (!drag.didDrag) {
        // Click on a flower: just select it
        setState(s => ({ ...s, draggingId: null, selectedId: drag.flowerId }))
        return
      }

      const snap = getSnap(getNDC(e))
      previewPos.current.set(0, 999, 0)

      if (snap) {
        const quat = new THREE.Quaternion().setFromUnitVectors(UP, snap.normal)
        const euler = new THREE.Euler().setFromQuaternion(quat)
        const pos = snap.point.clone().addScaledVector(snap.normal, SURFACE_OFFSET)
        setState(s => ({
          ...s,
          draggingId: null,
          flowers: s.flowers.map(f =>
            f.id === drag.flowerId
              ? { ...f, position: [pos.x, pos.y, pos.z], rotation: [euler.x, euler.y, euler.z], onCake: true }
              : f
          ),
        }))
      } else {
        setState(s => ({
          ...s,
          draggingId: null,
          flowers: s.flowers.map(f =>
            f.id === drag.flowerId
              ? { ...f, position: f.slotPosition, rotation: [0, 0, 0], onCake: false }
              : f
          ),
        }))
      }
    }

    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerup', onUp)
    return () => {
      dom.removeEventListener('pointerdown', onDown)
      dom.removeEventListener('pointermove', onMove)
      dom.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl, cakeMeshRef, orbitRef, dragRef, setState, onCakeClick])

  useFrame(() => {
    if (!previewGroupRef.current || !state.draggingId) return
    previewGroupRef.current.position.copy(previewPos.current)
    previewGroupRef.current.quaternion.copy(previewQuat.current)
  })

  const draggingFlower = state.draggingId
    ? state.flowers.find(f => f.id === state.draggingId)
    : null

  if (!draggingFlower) return null

  const c = draggingFlower.color
  const preview =
    draggingFlower.type === 'rose'      ? <Rose color={c} /> :
    draggingFlower.type === 'hydrangea' ? <Hydrangea color={c} /> :
    draggingFlower.type === 'peony'     ? <Peony color={c} /> :
                                          <FivePetal color={c} />

  return (
    <group ref={previewGroupRef} position={[0, 999, 0]}>
      {preview}
    </group>
  )
}
