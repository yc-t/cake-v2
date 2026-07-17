import type { Flower } from '../types'
import type { DragInfo } from './DragManager'
import { Rose } from './Rose'
import { Hydrangea } from './Hydrangea'
import { Peony } from './Peony'
import { FivePetal } from './FivePetal'
import { TRAY_POS, TRAY_SIZE } from '../data/initialState'

interface Props {
  flowers: Flower[]
  draggingId: string | null
  selectedId: string | null
  onFlowerPointerDown: (flowerId: string, e: PointerEvent) => void
}

function FlowerModel({ flower }: { flower: Flower }) {
  switch (flower.type) {
    case 'rose':      return <Rose color={flower.color} />
    case 'hydrangea': return <Hydrangea color={flower.color} />
    case 'peony':     return <Peony color={flower.color} />
    case 'fivepetal': return <FivePetal color={flower.color} />
  }
}

export function FlowerTray({ flowers, draggingId, selectedId: _selectedId, onFlowerPointerDown }: Props) {
  return (
    <group>
      <mesh position={TRAY_POS} castShadow receiveShadow>
        <boxGeometry args={TRAY_SIZE} />
        <meshStandardMaterial color="#e8ddd0" />
      </mesh>

      {flowers.map((flower) => (
        <group
          key={flower.id}
          position={flower.position}
          rotation={flower.rotation}
          scale={flower.scale}
          visible={flower.id !== draggingId}
          onPointerDown={(e) => {
            if (e.nativeEvent.button !== 0) return
            e.stopPropagation()
            onFlowerPointerDown(flower.id, e.nativeEvent)
          }}
        >
          <FlowerModel flower={flower} />
        </group>
      ))}
    </group>
  )
}

export type { DragInfo }
