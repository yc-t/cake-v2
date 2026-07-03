import { useMemo } from 'react'
import * as THREE from 'three'

interface Props {
  color: [number, number, number]
}

// ── Geometry parameters (match generate-fivepetal.mjs) ──────────────────────
const NUM_PETALS = 5
const INNER_R = 0.05, OUTER_R = 0.60
const MAX_HALF_W = 0.22, BEND = 0.10
const U_SEGS = 16, V_SEGS = 12
const CTR_R = 0.09, CTR_H = 0.07, CTR_LATS = 5, CTR_LONS = 16
const TARGET_DIAMETER = 1.7
const TWO_PI = Math.PI * 2

function buildGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], nrm: number[] = [], idx: number[] = []
  let vc = 0

  const vtx = (x: number, y: number, z: number): number => {
    pos.push(x, y, z); nrm.push(0, 0, 0); return vc++
  }
  const tri = (a: number, b: number, c: number) => idx.push(a, b, c)

  // ── Petals ────────────────────────────────────────────────────────────────
  for (let p = 0; p < NUM_PETALS; p++) {
    const angle = p / NUM_PETALS * TWO_PI
    const ca = Math.cos(angle), sa = Math.sin(angle)
    const g: number[][] = []
    for (let ui = 0; ui <= U_SEGS; ui++) {
      const u = ui / U_SEGS
      const r = INNER_R + u * (OUTER_R - INNER_R)
      const hw = Math.max(0.008, MAX_HALF_W * Math.sin(Math.PI * u))
      const ym = BEND * Math.sin(Math.PI * u)
      const row: number[] = []
      for (let vi = 0; vi <= V_SEGS; vi++) {
        const vn = vi / V_SEGS * 2 - 1
        const lx = r, lz = vn * hw, ly = ym * (1 - vn * vn * 0.5)
        row.push(vtx(lx * ca - lz * sa, ly, lx * sa + lz * ca))
      }
      g.push(row)
    }
    for (let ui = 0; ui < U_SEGS; ui++)
      for (let vi = 0; vi < V_SEGS; vi++) {
        const [a, b, c, d] = [g[ui][vi], g[ui][vi+1], g[ui+1][vi], g[ui+1][vi+1]]
        tri(a, b, d); tri(a, d, c)
      }
  }

  // ── Centre dome ───────────────────────────────────────────────────────────
  const dg: number[][] = []
  for (let lat = 0; lat <= CTR_LATS; lat++) {
    const phi = lat / CTR_LATS * Math.PI / 2
    const y = CTR_H * Math.cos(phi), r = CTR_R * Math.sin(phi)
    const row: number[] = []
    for (let lon = 0; lon <= CTR_LONS; lon++) {
      const th = lon / CTR_LONS * TWO_PI
      row.push(vtx(r * Math.cos(th), y, r * Math.sin(th)))
    }
    dg.push(row)
  }
  for (let lat = 0; lat < CTR_LATS; lat++)
    for (let lon = 0; lon < CTR_LONS; lon++) {
      const [a, b, c, d] = [dg[lat][lon], dg[lat][lon+1], dg[lat+1][lon], dg[lat+1][lon+1]]
      tri(a, b, d); tri(a, d, c)
    }
  const bot = vtx(0, 0, 0)
  const eq = dg[CTR_LATS]
  for (let lon = 0; lon < CTR_LONS; lon++) tri(bot, eq[lon+1], eq[lon])

  // ── Smooth normals via face-normal accumulation ───────────────────────────
  for (let i = 0; i < idx.length; i += 3) {
    const [ai, bi, ci] = [idx[i], idx[i+1], idx[i+2]]
    const ax=pos[ai*3], ay=pos[ai*3+1], az=pos[ai*3+2]
    const bx=pos[bi*3], by=pos[bi*3+1], bz=pos[bi*3+2]
    const cx=pos[ci*3], cy=pos[ci*3+1], cz=pos[ci*3+2]
    const ex=bx-ax, ey=by-ay, ez=bz-az
    const fx=cx-ax, fy=cy-ay, fz=cz-az
    const nx=ey*fz-ez*fy, ny=ez*fx-ex*fz, nz=ex*fy-ey*fx
    for (const vi of [ai, bi, ci]) { nrm[vi*3]+=nx; nrm[vi*3+1]+=ny; nrm[vi*3+2]+=nz }
  }
  for (let i = 0; i < vc; i++) {
    const nx=nrm[i*3], ny=nrm[i*3+1], nz=nrm[i*3+2]
    const len = Math.sqrt(nx*nx+ny*ny+nz*nz) || 1
    nrm[i*3]=nx/len; nrm[i*3+1]=ny/len; nrm[i*3+2]=nz/len
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3))
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(idx), 1))

  // Normalize: scale to TARGET_DIAMETER, centre x/z, snap bottom to y = 0
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  const sz = new THREE.Vector3(); bb.getSize(sz)
  const sc = TARGET_DIAMETER / Math.max(sz.x, sz.z)
  geo.scale(sc, sc, sc)
  geo.computeBoundingBox()
  const bb2 = geo.boundingBox!
  geo.translate(
    -((bb2.min.x + bb2.max.x) / 2),
    -bb2.min.y,
    -((bb2.min.z + bb2.max.z) / 2),
  )

  return geo
}

// Geometry and material are module-level singletons (built once, shared across instances)
const GEO = buildGeometry()

export function FivePetal({ color }: Props) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.7, side: THREE.DoubleSide }),
    [],
  )

  // Sync color every render — synchronous, no effect timing issues
  mat.color.setRGB(color[0], color[1], color[2])

  return <mesh geometry={GEO} material={mat} />
}
