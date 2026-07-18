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
import { generateWreath } from '../src/layout/wreath'
import { generateDome } from '../src/layout/dome'
import type { CakeSpec, LayoutResult } from '../src/layout/types'
import { topCoverage, type ConstraintReport } from '../src/layout/constraints'
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

type Generator = (f: Flower[], c: CakeSpec, s: number) => { result: LayoutResult; report: ConstraintReport }

const LAYOUTS: { name: string; gen: Generator }[] = [
  { name: 'crescent（新月弧）', gen: generateCrescent },
  { name: 'wreath（雙群花圈）', gen: generateWreath },
  { name: 'dome（滿版圓頂）', gen: generateDome },
]

let allPass = true
for (const { name, gen } of LAYOUTS) {
  console.log(`=== ${name} ===`)
  for (const seed of SEEDS) {
    const { result, report } = gen(flowers, cake, seed)
    const used = result.placements.length
    const cov = topCoverage(result.placements, cake).coverage
    console.log(
      `seed ${seed}: ${report.pass ? 'PASS' : 'FAIL'}` +
        `（attempts ${result.attempts}, flowers ${used}, top coverage ${(cov * 100).toFixed(1)}%）`,
    )
    for (const c of report.checks) {
      console.log(`  [${c.pass ? 'ok' : 'NG'}] ${c.id}: ${c.value}（limit ${c.limit}）`)
    }
    if (!report.pass) allPass = false
  }
}

process.exit(allPass ? 0 : 1)
