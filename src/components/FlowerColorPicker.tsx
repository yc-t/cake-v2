import React, { useState, useEffect } from 'react'
import type { Flower } from '../types'
import { PALETTE } from '../data/palette'
import { computeGradient, computePeonyGradient } from '../data/gradient'
import { trackChangeFlowerColor } from '../lib/analytics'
import { useLanguage } from '../i18n'

interface Props {
  flower: Flower
  onShadeChange: (color: [number, number, number]) => void
  onFamilyChange: (baseHex: string) => void
}

function rgbToCss([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
}

const WHEEL_BG = 'conic-gradient(#F4A6A0, #F5B993, #F3D98B, #C3A6DD, #8FB8D9, #A64D5F, #F4EFE9, #F4A6A0)'

const pillStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  background: 'rgba(255,255,255,0.90)',
  backdropFilter: 'blur(10px)',
  borderRadius: 48,
  padding: '8px 16px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
  pointerEvents: 'all',
}

const dotBase: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  flexShrink: 0,
  boxSizing: 'border-box',
  cursor: 'pointer',
  transition: 'transform 0.1s',
}

export function FlowerColorPicker({ flower, onShadeChange, onFamilyChange }: Props) {
  const { t } = useLanguage()
  const [wheelOpen, setWheelOpen] = useState(false)

  useEffect(() => {
    setWheelOpen(false)
  }, [flower.id])

  const gradientSteps: [number, number, number][] | null = flower.baseColor
    ? (flower.type === 'peony'
        ? computePeonyGradient(flower.baseColor, 5)
        : computeGradient(flower.baseColor, 5))
    : null

  const currentCss = rgbToCss(flower.color)

  return (
    <div style={{
      position: 'fixed',
      bottom: 28,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      alignItems: 'center',
      zIndex: 30,
      pointerEvents: 'none',
    }}>
      {/* Click-away overlay */}
      {wheelOpen && (
        <div
          onClick={() => setWheelOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            pointerEvents: 'all',
          }}
        />
      )}

      {/* Row 2 — 7-color palette, shown above Row 1 when wheel is open */}
      {wheelOpen && (
        <div style={pillStyle}>
          {PALETTE.map(p => (
            <div
              key={p.hex}
              onClick={() => { trackChangeFlowerColor('row2'); onFamilyChange(p.hex); setWheelOpen(false) }}
              title={t(`color.${p.key}`)}
              style={{
                ...dotBase,
                background: p.hex,
                border: '2px solid rgba(0,0,0,0.09)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.18)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
            />
          ))}
        </div>
      )}

      {/* Row 1 — gradient shades + color wheel toggle */}
      <div style={pillStyle}>
        {gradientSteps && gradientSteps.map((color, i) => {
          const css = rgbToCss(color)
          const isSelected = css === currentCss
          return (
            <div
              key={i}
              onClick={() => { trackChangeFlowerColor('row1'); onShadeChange(color) }}
              style={{
                ...dotBase,
                background: css,
                border: isSelected
                  ? '2.5px solid rgba(0,0,0,0.55)'
                  : '2px solid rgba(0,0,0,0.09)',
                boxShadow: isSelected ? '0 0 0 1.5px rgba(255,255,255,0.9) inset' : 'none',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.18)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
            />
          )
        })}

        {/* Separator */}
        {gradientSteps && (
          <div style={{
            width: 1,
            height: 20,
            background: 'rgba(0,0,0,0.08)',
            alignSelf: 'center',
            flexShrink: 0,
          }} />
        )}

        {/* Color wheel icon */}
        <div
          onClick={(e) => { e.stopPropagation(); setWheelOpen(o => !o) }}
          style={{
            ...dotBase,
            background: WHEEL_BG,
            border: wheelOpen
              ? '2.5px solid rgba(0,0,0,0.45)'
              : '2px solid rgba(0,0,0,0.09)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.18)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
        />
      </div>
    </div>
  )
}
