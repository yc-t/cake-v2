import * as THREE from 'three'

/**
 * Normalizes a cloned GLB scene to a target diameter, then snaps its base to y=0.
 *
 * stemMode controls how the base (contact point) is determined:
 *   'bottom'   — use the exact bounding-box bottom (default; for stemless flowers)
 *   'density'  — scan vertex density histogram from the bottom upward;
 *                the first bin whose vertex count exceeds 30% of the peak is used.
 *                This automatically finds where the petal mass begins, ignoring the
 *                sparse stem/calyx below.
 */
export function normalizeFlower(
  root: THREE.Object3D,
  targetDiameter: number,
  stemMode: 'bottom' | 'density' = 'bottom',
): void {
  root.updateMatrixWorld(true)

  const box1 = new THREE.Box3().setFromObject(root)
  const size = new THREE.Vector3()
  box1.getSize(size)
  const naturalDiameter = Math.max(size.x, size.z) || 1

  const scale = targetDiameter / naturalDiameter
  root.scale.setScalar(scale)

  root.updateMatrixWorld(true)
  const box2 = new THREE.Box3().setFromObject(root)

  let contactY = box2.min.y   // default: stem tip at y=0

  if (stemMode === 'density') {
    // Collect world-space y for every vertex
    const yVals: number[] = []
    const tmp = new THREE.Vector3()
    root.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return
      const pos = child.geometry.getAttribute('position') as THREE.BufferAttribute
      if (!pos) return
      for (let i = 0; i < pos.count; i++) {
        tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(child.matrixWorld)
        yVals.push(tmp.y)
      }
    })

    if (yVals.length > 0) {
      const minY = box2.min.y
      const height = box2.max.y - minY
      const NUM_BINS = 20
      const binSize = height / NUM_BINS

      // Histogram
      const hist = new Array<number>(NUM_BINS).fill(0)
      for (const y of yVals) {
        const b = Math.min(Math.floor((y - minY) / binSize), NUM_BINS - 1)
        hist[b]++
      }

      const peak = Math.max(...hist)
      const threshold = peak * 0.30   // 30 % of peak — below this = sparse stem/calyx

      // Scan from bottom upward; first dense bin = petal base
      for (let b = 0; b < NUM_BINS; b++) {
        if (hist[b] >= threshold) {
          contactY = minY + b * binSize
          break
        }
      }
    }
  }

  root.position.y = -contactY
}
