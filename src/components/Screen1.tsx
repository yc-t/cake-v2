import React, { useState, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import type { Flower, FlowerType } from '../types'
import { Rose } from './Rose'
import { Hydrangea } from './Hydrangea'
import { Peony } from './Peony'
import { FivePetal } from './FivePetal'
import { PALETTE } from '../data/palette'

interface Props {
  flowers: Flower[]
  onColorAssign: (type: FlowerType, hex: string) => void
  onStart: () => void
}

const GROUPS: { type: FlowerType; label: string }[] = [
  { type: 'rose',      label: '玫瑰' },
  { type: 'hydrangea', label: '繡球花' },
  { type: 'peony',     label: '芍藥' },
  { type: 'fivepetal', label: '五瓣花' },
]

// Vertical drop-zone strips in screen space (% of canvas height, top→down).
// Camera [11, 10, 18] → target [11, -2, 3], fov 65.
// rose z≈-3 → screen top; fivepetal z≈8.8 → screen bottom.
// Adjust after visual check if strips don't align with flower groups.
const STRIPS: Record<FlowerType, { top: string; height: string }> = {
  rose:      { top: '4%',  height: '22%' },
  hydrangea: { top: '26%', height: '26%' },
  peony:     { top: '52%', height: '20%' },
  fivepetal: { top: '72%', height: '20%' },
}

function FlowerModel({ flower }: { flower: Flower }) {
  switch (flower.type) {
    case 'rose':      return <Rose color={flower.color} />
    case 'hydrangea': return <Hydrangea color={flower.color} />
    case 'peony':     return <Peony color={flower.color} />
    case 'fivepetal': return <FivePetal color={flower.color} />
  }
}

export function Screen1({ flowers, onColorAssign, onStart }: Props) {
  const [hintVisible, setHintVisible] = useState(true)
  const [hoverType, setHoverType] = useState<FlowerType | null>(null)

  function handleDrop(type: FlowerType, e: React.DragEvent) {
    e.preventDefault()
    const hex = e.dataTransfer.getData('hex')
    if (!hex) return
    onColorAssign(type, hex)
    setHintVisible(false)
    setHoverType(null)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>

      {/* 3D canvas — flowers at their tray slot positions, fixed camera */}
      <Canvas
        camera={{ position: [11, 10, 18], fov: 65 }}
        gl={{ toneMapping: THREE.NoToneMapping }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <color attach="background" args={['#f5f2ed']} />
        <ambientLight intensity={1.5} />
        <hemisphereLight args={['#ffffff', '#f5f2ed', 1.0]} />
        <directionalLight position={[11, 10, 18]} intensity={0.5} />
        <Suspense fallback={null}>
          {flowers.map(f => (
            <group key={f.id} position={f.slotPosition}>
              <FlowerModel flower={f} />
            </group>
          ))}
        </Suspense>
      </Canvas>

      {/* Drop-zone overlays — transparent strips over each flower group */}
      {GROUPS.map(({ type, label }) => {
        const strip = STRIPS[type]
        const groupFlowers = flowers.filter(f => f.type === type)
        const assignedHex = groupFlowers[0]?.baseColor
        const isHover = hoverType === type

        return (
          <div
            key={type}
            onDragOver={(e) => { e.preventDefault(); setHoverType(type) }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setHoverType(null)
              }
            }}
            onDrop={(e) => handleDrop(type, e)}
            style={{
              position: 'absolute',
              left: '4%',
              right: '4%',
              top: strip.top,
              height: strip.height,
              border: isHover
                ? '2px dashed rgba(0,0,0,0.28)'
                : '2px solid rgba(0,0,0,0.05)',
              borderRadius: 14,
              background: isHover ? 'rgba(255,255,255,0.10)' : 'transparent',
              transition: 'border-color 0.15s, background 0.15s',
              display: 'flex',
              alignItems: 'flex-end',
              padding: '0 14px 8px',
              boxSizing: 'border-box',
              pointerEvents: 'all',
            }}
          >
            <span style={{
              fontFamily: 'sans-serif',
              fontSize: 13,
              color: 'rgba(0,0,0,0.38)',
              userSelect: 'none',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {assignedHex && (
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: assignedHex,
                  border: '1px solid rgba(0,0,0,0.12)',
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
              )}
              {label} ×{groupFlowers.length}
            </span>
          </div>
        )
      })}

      {/* Hint text — fades out after first successful drag */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: 'sans-serif',
          fontSize: 18,
          color: 'rgba(0,0,0,0.30)',
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: hintVisible ? 1 : 0,
          transition: 'opacity 0.6s',
        }}
      >
        把顏色拖到花上
      </div>

      {/* Unified 7-color palette — draggable swatches */}
      <div
        style={{
          position: 'absolute',
          bottom: 36,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 12,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(10px)',
          borderRadius: 48,
          padding: '10px 20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          userSelect: 'none',
          zIndex: 20,
        }}
      >
        {PALETTE.map(color => (
          <div
            key={color.hex}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('hex', color.hex)}
            title={color.name}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: color.hex,
              border: '2px solid rgba(0,0,0,0.10)',
              cursor: 'grab',
              flexShrink: 0,
              transition: 'transform 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.15)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
          />
        ))}
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        style={{
          position: 'absolute',
          bottom: 36,
          right: 36,
          padding: '12px 28px',
          background: '#333',
          color: '#fff',
          border: 'none',
          borderRadius: 24,
          fontFamily: 'sans-serif',
          fontSize: 16,
          cursor: 'pointer',
          zIndex: 20,
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        }}
      >
        開始
      </button>
    </div>
  )
}
