import { NodeIO } from '@gltf-transform/core'
import { prune } from '@gltf-transform/functions'
import { readFileSync, writeFileSync } from 'fs'

const io = new NodeIO()

// ── Rose: keep only petal mesh, remove stem / leafs / thorns ──────────────
{
  const doc = await io.readBinary(readFileSync('public/models/rose-original.glb'))
  const root = doc.getRoot()

  const REMOVE_KEYWORDS = ['stem', 'leaf', 'thorn']

  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const name = mesh.getName().toLowerCase()
    if (REMOVE_KEYWORDS.some(k => name.includes(k))) {
      node.setMesh(null)
      node.dispose()
    }
  }

  await doc.transform(prune())

  const glb = await io.writeBinary(doc)
  writeFileSync('public/models/rose.glb', glb)

  let tris = 0
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices()
      if (idx) tris += idx.getCount() / 3
    }
  }
  console.log(`rose.glb — meshes: ${root.listMeshes().length}, triangles: ${Math.round(tris).toLocaleString()}`)
}

// ── Hydrangea: keep Object_0–253, remove Object_254–257 ───────────────────
{
  const doc = await io.readBinary(readFileSync('public/models/hydrangea-original.glb'))
  const root = doc.getRoot()

  for (const node of root.listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const name = mesh.getName()
    const match = name.match(/^Object_(\d+)$/)
    if (match && parseInt(match[1], 10) >= 254) {
      node.setMesh(null)
      node.dispose()
    }
  }

  await doc.transform(prune())

  const glb = await io.writeBinary(doc)
  writeFileSync('public/models/hydrangea.glb', glb)

  let tris = 0
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices()
      if (idx) tris += idx.getCount() / 3
    }
  }
  console.log(`hydrangea.glb — meshes: ${root.listMeshes().length}, triangles: ${Math.round(tris).toLocaleString()}`)
}
