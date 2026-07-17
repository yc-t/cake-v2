/**
 * 佈局引擎的硬約束驗證 runner（開發工具，不進 app bundle）。
 * 執行：npx tsx scripts/check-layout.ts
 *
 * 模擬 Screen 1 配色（與 App.handleColorAssign 相同邏輯）後，
 * 對每種佈局跑多個 seed，印出硬約束檢查器報告。
 * 任一 seed 未通過 → exit code 1。
 */
import { initialState } from '../src/data/initialState'
import { computeGradient, computePeonyGradient } from '../src/data/gradient'
import { generateCrescent } from '../src/layout/crescent'
import type { Flower, FlowerType } from '../src/types'

// 模擬 Screen 1 的配色指定（薰衣草紫 / 花園藍 / 酒紅 / 暖白）
const ASSIGN: Record<FlowerType, string> = {
  rose: '#C3A6DD',
  hydrangea: '#8FB8D9',
  peony: '#A64D5F',
  fivepetal: '#F4EFE9',
}

function applyScreen1Colors(flowers: Flower[]): Flower[] {
  let out = flowers.map(f => ({ ...f }))
  for (const type of Object.keys(ASSIGN) as FlowerType[]) {
    const hex = ASSIGN[type]
    const count = out.filter(f => f.type === type).length
    const gradient = type === 'peony' ? computePeonyGradient(hex, count) : computeGradient(hex, count)
    let gi = 0
    out = out.map(f => (f.type === type ? { ...f, baseColor: hex, color: gradient[gi++] } : f))
  }
  return out
}

const flowers = applyScreen1Colors(initialState.flowers)
const cake = {
  radius: initialState.cake.layers[0].radius,
  height: initialState.cake.layers[0].height,
}

const SEEDS = [1, 42, 1234, 20260717, 99999]

let allPass = true
console.log('=== crescent（新月弧）===')
for (const seed of SEEDS) {
  const { result, report } = generateCrescent(flowers, cake, seed)
  const used = result.placements.length
  console.log(
    `seed ${seed}: ${report.pass ? 'PASS' : 'FAIL'}` +
      `（attempts ${result.attempts}, flowers ${used}）`,
  )
  for (const c of report.checks) {
    console.log(`  [${c.pass ? 'ok' : 'NG'}] ${c.id}: ${c.value}（limit ${c.limit}）`)
  }
  if (!report.pass) allPass = false
}

process.exit(allPass ? 0 : 1)
