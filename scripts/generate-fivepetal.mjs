#!/usr/bin/env node
/**
 * Generates a procedural five-petal flower GLB.
 * Output: public/models/fivepetal.glb
 *
 * Geometry:
 *   - 5 petals: elliptic parametric surface, slightly curved upward
 *   - Centre: hemispherical dome
 *   - Bottom disc closing the dome (flat base)
 *   - All normals computed via face-normal accumulation (smooth shading)
 */

import { NodeIO, Document } from '@gltf-transform/core'
import { writeFileSync } from 'fs'

const TWO_PI = Math.PI * 2

// ── Parameters ──────────────────────────────────────────────────────────────
const NUM_PETALS  = 5
const INNER_R     = 0.05    // petal starts this far from centre
const OUTER_R     = 0.60    // petal tip radius → diameter 1.2
const MAX_HALF_W  = 0.22    // max half-width at petal midpoint
const BEND        = 0.10    // peak upward height of petal
const U_SEGS      = 16      // segments along petal (radial)
const V_SEGS      = 12      // segments across petal (tangential)

const CTR_R       = 0.09    // centre dome base radius
const CTR_H       = 0.07    // centre dome height
const CTR_LATS    = 5       // dome latitude rings
const CTR_LONS    = 16      // dome longitude divisions

// ── Flat geometry arrays ────────────────────────────────────────────────────
const positions = []   // [x0,y0,z0, x1,y1,z1, ...]
const normals   = []   // accumulated then normalised
const indices   = []

let vcnt = 0

function pushVtx(x, y, z) {
  positions.push(x, y, z)
  normals.push(0, 0, 0)    // placeholder
  return vcnt++
}

function pushTri(a, b, c) { indices.push(a, b, c) }

// ── Petals ───────────────────────────────────────────────────────────────────
for (let p = 0; p < NUM_PETALS; p++) {
  const angle = (p / NUM_PETALS) * TWO_PI
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)

  // Build (U_SEGS+1) × (V_SEGS+1) grid of vertex indices
  const grid = []

  for (let ui = 0; ui <= U_SEGS; ui++) {
    const u = ui / U_SEGS
    const r = INNER_R + u * (OUTER_R - INNER_R)
    // Bell-curve width profile; small minimum avoids degenerate base triangles
    const halfW = Math.max(0.008, MAX_HALF_W * Math.sin(Math.PI * u))
    const yMid  = BEND * Math.sin(Math.PI * u)

    const row = []
    for (let vi = 0; vi <= V_SEGS; vi++) {
      const vn = (vi / V_SEGS) * 2 - 1        // −1 … +1
      const lx = r
      const lz = vn * halfW
      const ly = yMid * (1 - vn * vn * 0.5)   // edges slightly lower than centre

      // Rotate petal around Y by its angle
      row.push(pushVtx(lx * ca - lz * sa, ly, lx * sa + lz * ca))
    }
    grid.push(row)
  }

  // CCW quads → upward-facing front normals
  // Quad: a=grid[ui][vi], b=grid[ui][vi+1], c=grid[ui+1][vi], d=grid[ui+1][vi+1]
  // CCW from +Y: (a,b,d) and (a,d,c)
  for (let ui = 0; ui < U_SEGS; ui++) {
    for (let vi = 0; vi < V_SEGS; vi++) {
      const a = grid[ui][vi], b = grid[ui][vi + 1]
      const c = grid[ui + 1][vi], d = grid[ui + 1][vi + 1]
      pushTri(a, b, d)
      pushTri(a, d, c)
    }
  }
}

// ── Centre dome ──────────────────────────────────────────────────────────────
{
  const dg = []
  for (let lat = 0; lat <= CTR_LATS; lat++) {
    const phi = (lat / CTR_LATS) * Math.PI / 2   // 0 = top pole, π/2 = equator
    const y   = CTR_H * Math.cos(phi)
    const r   = CTR_R * Math.sin(phi)
    const row = []
    for (let lon = 0; lon <= CTR_LONS; lon++) {
      const th = (lon / CTR_LONS) * TWO_PI
      row.push(pushVtx(r * Math.cos(th), y, r * Math.sin(th)))
    }
    dg.push(row)
  }

  // Same CCW winding as petals → outward normals on dome
  for (let lat = 0; lat < CTR_LATS; lat++) {
    for (let lon = 0; lon < CTR_LONS; lon++) {
      const a = dg[lat][lon], b = dg[lat][lon + 1]
      const c = dg[lat + 1][lon], d = dg[lat + 1][lon + 1]
      pushTri(a, b, d)
      pushTri(a, d, c)
    }
  }

  // Bottom disc: fan from (0,0,0) → -Y normal (CW from above)
  const botCtr = pushVtx(0, 0, 0)
  const eq = dg[CTR_LATS]
  for (let lon = 0; lon < CTR_LONS; lon++) {
    pushTri(botCtr, eq[lon + 1], eq[lon])
  }
}

// ── Compute smooth vertex normals via face-normal accumulation ───────────────
for (let i = 0; i < indices.length; i += 3) {
  const ai = indices[i], bi = indices[i + 1], ci = indices[i + 2]
  const ax = positions[ai*3], ay = positions[ai*3+1], az = positions[ai*3+2]
  const bx = positions[bi*3], by = positions[bi*3+1], bz = positions[bi*3+2]
  const cx = positions[ci*3], cy = positions[ci*3+1], cz = positions[ci*3+2]

  const e1x = bx-ax, e1y = by-ay, e1z = bz-az
  const e2x = cx-ax, e2y = cy-ay, e2z = cz-az

  // Face normal (magnitude = 2× triangle area = weighting for smooth normals)
  const nx = e1y*e2z - e1z*e2y
  const ny = e1z*e2x - e1x*e2z
  const nz = e1x*e2y - e1y*e2x

  for (const vi of [ai, bi, ci]) {
    normals[vi*3]   += nx
    normals[vi*3+1] += ny
    normals[vi*3+2] += nz
  }
}

for (let i = 0; i < vcnt; i++) {
  const nx = normals[i*3], ny = normals[i*3+1], nz = normals[i*3+2]
  const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1
  normals[i*3] = nx/len; normals[i*3+1] = ny/len; normals[i*3+2] = nz/len
}

// ── Build gltf-transform Document ───────────────────────────────────────────
const doc    = new Document()
const buffer = doc.createBuffer()

const posAcc = doc.createAccessor()
  .setBuffer(buffer).setType('VEC3').setArray(new Float32Array(positions))
const normAcc = doc.createAccessor()
  .setBuffer(buffer).setType('VEC3').setArray(new Float32Array(normals))
const idxAcc = doc.createAccessor()
  .setBuffer(buffer).setType('SCALAR')
  .setArray(vcnt <= 65535 ? new Uint16Array(indices) : new Uint32Array(indices))

const mat = doc.createMaterial('petal')
  .setDoubleSided(true)
  .setBaseColorFactor([1.0, 0.85, 0.88, 1.0])   // pale pink; colour overridden at runtime
  .setRoughnessFactor(0.75)
  .setMetallicFactor(0.0)

const prim = doc.createPrimitive()
  .setAttribute('POSITION', posAcc)
  .setAttribute('NORMAL', normAcc)
  .setIndices(idxAcc)
  .setMaterial(mat)

const mesh = doc.createMesh('fivepetal').addPrimitive(prim)
const node = doc.createNode('Flower').setMesh(mesh)
doc.createScene('Scene').addChild(node)

const io  = new NodeIO()
const glb = await io.writeBinary(doc)
writeFileSync('public/models/fivepetal.glb', glb)

const tris = indices.length / 3
console.log(`fivepetal.glb: ${vcnt.toLocaleString()} vertices, ${tris.toLocaleString()} triangles`)
