import type { AppState, Flower, FlowerType } from '../types'
import { DEFAULT_FLOWER_RGB } from './palette'

// Board bottom = -(cake.height/2 + board.height) = -(2 + 0.3) = -2.3
// Tray height = 0.35 → tray center y = -2.3 + 0.175 = -2.125 → tray top = -1.95
const TRAY_TOP = -1.95

// Roses: 4 cols × 2 rows
const ROSE_SLOTS: [number, number, number][] = [
  [8, TRAY_TOP, -3],   [10, TRAY_TOP, -3],   [12, TRAY_TOP, -3],   [14, TRAY_TOP, -3],
  [8, TRAY_TOP, -0.5], [10, TRAY_TOP, -0.5], [12, TRAY_TOP, -0.5], [14, TRAY_TOP, -0.5],
]

// Hydrangeas: 4 cols × 2 rows
const HYDRANGEA_SLOTS: [number, number, number][] = [
  [8, TRAY_TOP, 2.5],  [9.8, TRAY_TOP, 2.5],  [11.6, TRAY_TOP, 2.5],  [13.4, TRAY_TOP, 2.5],
  [8, TRAY_TOP, 4.3],  [9.8, TRAY_TOP, 4.3],  [11.6, TRAY_TOP, 4.3],  [13.4, TRAY_TOP, 4.3],
]

// Peony: 3 cols × 2 rows（peony-0 = 佈局引擎的英雄花，見 layout/constants.ts HERO_FLOWER_ID）
const PEONY_SLOTS: [number, number, number][] = [
  [8, TRAY_TOP, 6.3], [11, TRAY_TOP, 6.3], [14, TRAY_TOP, 6.3],
  [8, TRAY_TOP, 8.9], [11, TRAY_TOP, 8.9], [14, TRAY_TOP, 8.9],
]

// FivePetal: 6 cols × 2 rows
const FIVEPETAL_SLOTS: [number, number, number][] = [
  [7.5, TRAY_TOP, 10.7], [9, TRAY_TOP, 10.7], [10.5, TRAY_TOP, 10.7], [12, TRAY_TOP, 10.7], [13.5, TRAY_TOP, 10.7], [15, TRAY_TOP, 10.7],
  [7.5, TRAY_TOP, 11.8], [9, TRAY_TOP, 11.8], [10.5, TRAY_TOP, 11.8], [12, TRAY_TOP, 11.8], [13.5, TRAY_TOP, 11.8], [15, TRAY_TOP, 11.8],
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

// Tray geometry: x 6.5–15.5, z -4.5–13.0（2026-07-18 庫存擴充：加深容納 peony 第二排與 fivepetal 12 朵）
export const TRAY_POS: [number, number, number] = [11, -2.125, 4.25]
export const TRAY_SIZE: [number, number, number] = [9, 0.35, 17.5]
