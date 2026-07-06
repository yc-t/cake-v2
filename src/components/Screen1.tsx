import React, { useState, useEffect, useRef, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
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

const DEFAULT_COLOR: [number, number, number] = [0.957, 0.937, 0.914] // #F4EFE9

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
}

// Canvas pixel tinting — only tints non-transparent pixels, background stays transparent.
function tintImage(baseDataUrl: string, tintHex: string): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = imageData.data
      const tr = parseInt(tintHex.slice(1, 3), 16) / 255
      const tg = parseInt(tintHex.slice(3, 5), 16) / 255
      const tb = parseInt(tintHex.slice(5, 7), 16) / 255
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0) {
          d[i]     = Math.round(d[i]     * tr)
          d[i + 1] = Math.round(d[i + 1] * tg)
          d[i + 2] = Math.round(d[i + 2] * tb)
        }
      }
      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.src = baseDataUrl
  })
}

// Captures snapshot after first render frame
function ThumbnailCapture({ onCapture }: { onCapture: (url: string) => void }) {
  const { gl } = useThree()
  const captured = useRef(false)
  useEffect(() => {
    if (captured.current) return
    captured.current = true
    requestAnimationFrame(() => {
      const url = gl.domElement.toDataURL('image/png')
      onCapture(url)
    })
  }, [gl, onCapture])
  return null
}

function FlowerModelScene({ type }: { type: FlowerType }) {
  switch (type) {
    case 'rose':      return <Rose color={DEFAULT_COLOR} />
    case 'hydrangea': return <Hydrangea color={DEFAULT_COLOR} />
    case 'peony':     return <Peony color={DEFAULT_COLOR} />
    case 'fivepetal': return <FivePetal color={DEFAULT_COLOR} />
  }
}

const CAMERA_BY_TYPE: Record<FlowerType, [number, number, number]> = {
  rose:      [0, 3, 3],
  hydrangea: [0, 4, 3],
  peony:     [0, 4, 3],
  fivepetal: [0, 3, 2],
}

function ThumbnailRenderer({ type, onCapture }: { type: FlowerType; onCapture: (type: FlowerType, url: string) => void }) {
  const handleCapture = (url: string) => onCapture(type, url)
  return (
    <div style={{ position: 'fixed', left: -9999, top: -9999, width: 200, height: 200 }}>
      <Canvas
        camera={{ position: CAMERA_BY_TYPE[type], fov: 50 }}
        gl={{ toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true, antialias: true, alpha: true }}
        style={{ width: 200, height: 200 }}
      >
        {/* No background color — transparent canvas */}
        <ambientLight intensity={1.8} />
        <hemisphereLight args={['#ffffff', '#e8e3dc', 1.2]} />
        <directionalLight position={[2, 5, 3]} intensity={0.8} />
        <Suspense fallback={null}>
          <FlowerModelScene type={type} />
        </Suspense>
        <ThumbnailCapture onCapture={handleCapture} />
      </Canvas>
    </div>
  )
}

interface CardProps {
  label: string
  count: number
  displayThumbnail: string | null
  flowerColors: string[]   // per-flower hex dark→light; empty if no color assigned
  isHover: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

function FlowerCard({ label, count, displayThumbnail, flowerColors, isHover, onDragOver, onDragLeave, onDrop }: CardProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        background: isHover ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(8px)',
        borderRadius: 14,
        border: isHover ? '2px dashed rgba(0,0,0,0.30)' : '2px solid rgba(0,0,0,0.06)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        transition: 'border-color 0.15s, background 0.15s',
        boxSizing: 'border-box',
        minWidth: 0,
      }}
    >
      {/* Thumbnail — transparent bg; flower-only pixels tinted */}
      <div style={{
        width: 90,
        height: 90,
        borderRadius: 10,
        background: '#eae5de',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {displayThumbnail ? (
          <img
            src={displayThumbnail}
            alt={label}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
          />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#d8d3cb' }} />
        )}
      </div>

      {/* Label + count */}
      <div style={{
        fontFamily: 'sans-serif',
        fontSize: 13,
        color: 'rgba(0,0,0,0.55)',
        userSelect: 'none',
      }}>
        {label} ×{count}
      </div>

      {/* Gradient dots — one per flower, dark→light, only when color assigned */}
      {flowerColors.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {flowerColors.map((hex, i) => (
            <span
              key={i}
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: hex,
                border: '1px solid rgba(0,0,0,0.08)',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function Screen1({ flowers, onColorAssign, onStart }: Props) {
  const [hintVisible, setHintVisible] = useState(true)
  const [hoverType, setHoverType] = useState<FlowerType | null>(null)
  const [thumbnails, setThumbnails] = useState<Partial<Record<FlowerType, string>>>({})
  const [tintedThumbnails, setTintedThumbnails] = useState<Partial<Record<FlowerType, string>>>({})

  const handleCapture = (type: FlowerType, url: string) => {
    setThumbnails(prev => ({ ...prev, [type]: url }))
  }

  // Re-tint whenever base thumbnails or flower colors change
  useEffect(() => {
    let cancelled = false
    GROUPS.forEach(({ type }) => {
      const base = thumbnails[type]
      const groupFlowers = flowers.filter(f => f.type === type)
      const hasColor = (groupFlowers[0]?.baseColor ?? null) !== null

      if (!hasColor) {
        setTintedThumbnails(prev => {
          if (!(type in prev)) return prev
          const next = { ...prev }
          delete next[type]
          return next
        })
        return
      }
      if (!base) return

      const darkestHex = rgbToHex(groupFlowers[0].color)
      tintImage(base, darkestHex).then(tinted => {
        if (!cancelled) setTintedThumbnails(prev => ({ ...prev, [type]: tinted }))
      })
    })
    return () => { cancelled = true }
  }, [thumbnails, flowers])

  function handleDragOver(type: FlowerType, e: React.DragEvent) {
    e.preventDefault()
    setHoverType(type)
  }

  function handleDragLeave(_type: FlowerType, e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setHoverType(null)
  }

  function handleDrop(type: FlowerType, e: React.DragEvent) {
    e.preventDefault()
    const hex = e.dataTransfer.getData('hex')
    if (!hex) return
    onColorAssign(type, hex)
    setHintVisible(false)
    setHoverType(null)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: 'linear-gradient(to bottom, #f5f3f0, #e8e4de)' }}>

      {GROUPS.map(({ type }) => (
        <ThumbnailRenderer key={type} type={type} onCapture={handleCapture} />
      ))}

      {/* Main card layout */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 28px 0',
        paddingBottom: 0,
        boxSizing: 'border-box',
      }}>
        {/* Cards zone — flex:1 centers the cards vertically in available space */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          width: '100%',
        }}>
          <div style={{
            fontFamily: 'sans-serif',
            fontSize: 14,
            color: 'rgba(0,0,0,0.36)',
            userSelect: 'none',
            letterSpacing: '0.04em',
          }}>
            選擇花色
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
            width: '100%',
            maxWidth: 480,
          }}>
            {GROUPS.map(({ type, label }) => {
              const groupFlowers = flowers.filter((f: Flower) => f.type === type)
              const hasColor = (groupFlowers[0]?.baseColor ?? null) !== null
              const displayThumbnail = tintedThumbnails[type] ?? thumbnails[type] ?? null
              const flowerColors = hasColor ? groupFlowers.map(f => rgbToHex(f.color)) : []
              return (
                <FlowerCard
                  key={type}
                  label={label}
                  count={groupFlowers.length}
                  displayThumbnail={displayThumbnail}
                  flowerColors={flowerColors}
                  isHover={hoverType === type}
                  onDragOver={(e) => handleDragOver(type, e)}
                  onDragLeave={(e) => handleDragLeave(type, e)}
                  onDrop={(e) => handleDrop(type, e)}
                />
              )
            })}
          </div>
        </div>

        {/* Hint text — between cards and swatch bar */}
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'sans-serif',
          fontSize: 15,
          color: 'rgba(0,0,0,0.28)',
          pointerEvents: 'none',
          userSelect: 'none',
          opacity: hintVisible ? 1 : 0,
          transition: 'opacity 0.6s',
          letterSpacing: '0.02em',
        }}>
          把顏色拖到花上
        </div>

        {/* Spacer above swatch bar */}
        <div style={{ height: 80 }} />
      </div>

      {/* Palette swatches — smaller, sits comfortably above start button */}
      <div style={{
        position: 'absolute',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 9,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(10px)',
        borderRadius: 48,
        padding: '8px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
        userSelect: 'none',
        zIndex: 20,
      }}>
        {PALETTE.map(color => (
          <div
            key={color.hex}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('hex', color.hex)}
            title={color.name}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: color.hex,
              border: '2px solid rgba(0,0,0,0.09)',
              cursor: 'grab',
              flexShrink: 0,
              transition: 'transform 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.18)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
          />
        ))}
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        style={{
          position: 'absolute',
          bottom: 28,
          right: 28,
          padding: '10px 24px',
          background: '#333',
          color: '#fff',
          border: 'none',
          borderRadius: 22,
          fontFamily: 'sans-serif',
          fontSize: 15,
          cursor: 'pointer',
          zIndex: 20,
          boxShadow: '0 2px 10px rgba(0,0,0,0.16)',
        }}
      >
        開始
      </button>
    </div>
  )
}
