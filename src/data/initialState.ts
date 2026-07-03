import type { AppState, Flower, FlowerType } from '../types'
import { DEFAULT_FLOWER_RGB } from './palette'

// Board bottom = -(cake.height/2 + board.height) = -(2 + 0.3) = -2.3
// Tray height = 0.35 → tray center y = -2.3 + 0.175 = -2.125 → tray top = -1.95
const TRAY_TOP = -1.95

// Roses: 3 cols × 2 rows
const ROSE_SLOTS: [number, number, number][] = [
  [8, TRAY_TOP, -3],   [10.5, TRAY_TOP, -3],   [13, TRAY_TOP, -3],
  [8, TRAY_TOP, -0.5], [10.5, TRAY_TOP, -0.5], [13, TRAY_TOP, -0.5],
]

// Hydrangeas: 4 cols × 2 rows
const HYDRANGEA_SLOTS: [number, number, number][] = [
  [8, TRAY_TOP, 2.5],  [9.8, TRAY_TOP, 2.5],  [11.6, TRAY_TOP, 2.5],  [13.4, TRAY_TOP, 2.5],
  [8, TRAY_TOP, 4.3],  [9.8, TRAY_TOP, 4.3],  [11.6, TRAY_TOP, 4.3],  [13.4, TRAY_TOP, 4.3],
]

// Peony: 4 cols × 1 row
const PEONY_SLOTS: [number, number, number][] = [
  [8, TRAY_TOP, 6.5], [10, TRAY_TOP, 6.5], [12, TRAY_TOP, 6.5], [14, TRAY_TOP, 6.5],
]

// FivePetal: 4 cols × 1 row
const FIVEPETAL_SLOTS: [number, number, number][] = [
  [8, TRAY_TOP, 8.8], [10, TRAY_TOP, 8.8], [12, TRAY_TOP, 8.8], [14, TRAY_TOP, 8.8],
]

function makeFlower(
  type: FlowerType,
  slotPosition: [number, number, number],
  index: number,
): Flower {
  return {
    id: `${type}-${index}`,
    type,
    color: DEFAULT_FLOWER_RGB,
    baseColor: null,
    position: slotPosition,
    rotation: [0, 0, 0],
    scale: 1.0,
    elevation: 0,
    facingAngle: 0,
    slotPosition,
    onCake: false,
  }
}

export const initialState: AppState = {
  flowers: [
    ...ROSE_SLOTS.map((slot, i) => makeFlower('rose', slot, i)),
    ...HYDRANGEA_SLOTS.map((slot, i) => makeFlower('hydrangea', slot, i)),
    ...PEONY_SLOTS.map((slot, i) => makeFlower('peony', slot, i)),
    ...FIVEPETAL_SLOTS.map((slot, i) => makeFlower('fivepetal', slot, i)),
  ],
  cake: {
    layers: [
      {
        shape: 'cylinder',
        radius: 5,
        height: 4,
        color: [0.980, 0.980, 0.973], // #fafaf8
      },
    ],
  },
  board: {
    radius: 6,
    height: 0.3,
    color: [1, 1, 1],
  },
  draggingId: null,
  selectedId: null,
  typeColorMap: { rose: null, hydrangea: null, peony: null, fivepetal: null },
  currentScreen: 'screen1',
}

// Tray geometry: x 6.5–15.5, z -4.5–10.0
export const TRAY_POS: [number, number, number] = [11, -2.125, 2.75]
export const TRAY_SIZE: [number, number, number] = [9, 0.35, 14.5]
