import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { normalizeFlower } from './flowerNormalize'

interface Props {
  color: [number, number, number]
}

const TARGET_DIAMETER = 2.0

useGLTF.preload('/models/hydrangea.glb')

export function Hydrangea({ color }: Props) {
  const { scene } = useGLTF('/models/hydrangea.glb')

  const cloned = useMemo(() => {
    const root = scene.clone(true)
    root.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const orig = child.material as THREE.MeshStandardMaterial
        const mat = orig.clone()
        mat.map = null
        mat.metalnessMap = null
        mat.roughnessMap = null
        mat.metalness = 0
        mat.roughness = 0.7
        child.material = mat
      }
    })
    normalizeFlower(root, TARGET_DIAMETER)
    return root
  }, [scene])

  cloned.traverse(child => {
    if (child instanceof THREE.Mesh) {
      ;(child.material as THREE.MeshStandardMaterial).color.setRGB(color[0], color[1], color[2])
    }
  })

  return <primitive object={cloned} />
}
