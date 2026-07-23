import { NodeIO } from '@gltf-transform/core'
import { weld, simplify, prune } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { readFileSync, writeFileSync } from 'fs'

await MeshoptSimplifier.ready

const io = new NodeIO()

function countTris(root) {
  let t = 0
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices()
      if (idx) t += idx.getCount() / 3
    }
  return Math.round(t)
}

// ── Rose: 92,910 → target < 20,000 (ratio ~0.16) ─────────────────────────
{
  const doc = await io.readBinary(readFileSync('public/models/rose.glb'))
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.16, error: 1.0 }),
    prune(),
  )
  const glb = await io.writeBinary(doc)
  writeFileSync('public/models/rose.glb', glb)
  const tris = countTris(doc.getRoot())
  console.log(`rose.glb     : ${tris.toLocaleString()} triangles`)
}

// ── Hydrangea: 2,785,364 → target ~55,000 per model (8x = 440K < 500K) ───
{
  const doc = await io.readBinary(readFileSync('public/models/hydrangea.glb'))
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.02, error: 1.0 }),
    prune(),
  )
  const glb = await io.writeBinary(doc)
  writeFileSync('public/models/hydrangea.glb', glb)
  const tris = countTris(doc.getRoot())
  console.log(`hydrangea.glb: ${tris.toLocaleString()} triangles  (×8 = ${(tris*8).toLocaleString()})`)
}
