import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { normalizeFlower } from './flowerNormalize'

interface Props {
  color: [number, number, number]
}

const TARGET_DIAMETER = 2.64   // 2.2 × 1.2

useGLTF.preload('/models/peony.glb')

export function Peony({ color }: Props) {
  const { scene } = useGLTF('/models/peony.glb')

  const cloned = useMemo(() => {
    const root = scene.clone(true)

    // Clear baked-in rotations from Sketchfab export nodes
    root.traverse(child => {
      if (child.name === 'Sketchfab_model' || child.name === 'GLTF_SceneRootNode') {
        child.rotation.set(0, 0, 0)
        child.quaternion.identity()
      }
    })

    root.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.7 })
      }
    })
    normalizeFlower(root, TARGET_DIAMETER, 'density')
    return root
  }, [scene])

  cloned.traverse(child => {
    if (child instanceof THREE.Mesh) {
      ;(child.material as THREE.MeshStandardMaterial).color.setRGB(color[0], color[1], color[2])
    }
  })

  return <primitive object={cloned} />
}
