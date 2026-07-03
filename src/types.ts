export type FlowerType = 'rose' | 'hydrangea' | 'peony' | 'fivepetal'

export type Flower = {
  id: string
  type: FlowerType
  color: [number, number, number]
  baseColor: string | null        // hex of the palette color assigned to this flower, or null
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
  elevation: number
  facingAngle: number             // rotation around surface normal, 0-360
  slotPosition: [number, number, number]
  onCake: boolean
}

export type CakeLayer = {
  shape: 'cylinder'
  radius: number
  height: number
  color: [number, number, number]
}

export type AppState = {
  flowers: Flower[]
  cake: { layers: CakeLayer[] }
  board: { radius: number; height: number; color: [number, number, number] }
  draggingId: string | null
  selectedId: string | null
  typeColorMap: Record<FlowerType, string | null>  // per-type palette hex from Screen 1
  currentScreen: 'screen1' | 'screen2'
}
