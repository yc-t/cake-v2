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

function removeMeshesExcept(root, keepFn) {
  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    if (!keepFn(mesh.getName())) {
      node.setMesh(null)
      node.dispose()
    }
  }
}

// ── Peony: keep Object_0, simplify to ≤20,000 ────────────────────────────
{
  const doc = await io.readBinary(readFileSync('public/models/peony-original.glb'))
  const root = doc.getRoot()

  removeMeshesExcept(root, name => name === 'Object_0')
  await doc.transform(prune())

  const beforeTris = countTris(root)
  console.log(`peony before simplify : ${beforeTris.toLocaleString()} triangles`)

  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.21, error: 1.0 }),
    prune(),
  )

  const glb = await io.writeBinary(doc)
  writeFileSync('public/models/peony.glb', glb)
  console.log(`peony.glb             : ${countTris(doc.getRoot()).toLocaleString()} triangles`)
}



