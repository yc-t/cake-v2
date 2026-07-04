import React from 'react'
import type { Flower } from '../types'
import { PALETTE } from '../data/palette'
import { computeGradient, computePeonyGradient } from '../data/gradient'

interface Props {
  flower: Flower
  onShadeChange: (color: [number, number, number]) => void
  onFamilyChange: (baseHex: string) => void
}

function rgbToCss([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
}

const pillStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  background: 'rgba(255,255,255,0.90)',
  backdropFilter: 'blur(10px)',
  borderRadius: 48,
  padding: '8px 16px',
  boxShadow: '0 3px 16px rgba(0,0,0,0.10)',
  pointerEvents: 'all',
}

export function FlowerColorPicker({ flower, onShadeChange, onFamilyChange }: Props) {
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

      {/* Row 1 — gradient shades of current family, only when baseColor is set */}
      {gradientSteps && (
        <div style={pillStyle}>
          {gradientSteps.map((color, i) => {
            const css = rgbToCss(color)
            const isSelected = css === currentCss
            return (
              <div
                key={i}
                onClick={() => onShadeChange(color)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: css,
                  border: isSelected
                    ? '2.5px solid rgba(0,0,0,0.55)'
                    : '2px solid rgba(0,0,0,0.09)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  transition: 'transform 0.1s',
                  boxShadow: isSelected ? '0 0 0 1.5px rgba(255,255,255,0.9) inset' : 'none',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.18)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
              />
            )
          })}
        </div>
      )}

      {/* Row 2 — 7-color palette, always shown */}
      <div style={pillStyle}>
        {PALETTE.map(p => (
          <div
            key={p.hex}
            onClick={() => onFamilyChange(p.hex)}
            title={p.name}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: p.hex,
              border: '2px solid rgba(0,0,0,0.09)',
              cursor: 'pointer',
              flexShrink: 0,
              boxSizing: 'border-box',
              transition: 'transform 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.18)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)' }}
          />
        ))}
      </div>

    </div>
  )
}
