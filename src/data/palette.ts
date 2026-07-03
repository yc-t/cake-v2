export type PaletteColor = {
  name: string
  hex: string
  rgb: [number, number, number]
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ]
}

export const PALETTE: PaletteColor[] = [
  { name: '桃粉',     hex: '#F4A6A0', rgb: hexToRgb('#F4A6A0') },
  { name: '珊瑚桃',   hex: '#F5B993', rgb: hexToRgb('#F5B993') },
  { name: '奶油黃',   hex: '#F3D98B', rgb: hexToRgb('#F3D98B') },
  { name: '薰衣草紫', hex: '#C3A6DD', rgb: hexToRgb('#C3A6DD') },
  { name: '花園藍',   hex: '#8FB8D9', rgb: hexToRgb('#8FB8D9') },
  { name: '酒紅',     hex: '#A64D5F', rgb: hexToRgb('#A64D5F') },
  { name: '暖白',     hex: '#F4EFE9', rgb: hexToRgb('#F4EFE9') },
]

export const CAKE_NEAR_WHITE: PaletteColor = {
  name: '近白',
  hex: '#fafaf8',
  rgb: hexToRgb('#fafaf8'),
}

export const DEFAULT_FLOWER_HEX = '#F4EFE9'
export const DEFAULT_FLOWER_RGB: [number, number, number] = hexToRgb('#F4EFE9')
