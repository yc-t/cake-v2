import React from 'react'
import type { LayoutType } from '../layout/types'
import { useLanguage } from '../i18n'

/**
 * 佈局選擇 UI（layout-engine-spec §6）：最小化、不遮擋蛋糕視野。
 * 三個選項對應三種佈局原型；點擊即套用（重複點擊同一佈局會重新隨機生成）。
 * 樣式比照現有右下角按鈕群（App.tsx btnStyle）。
 */

interface Props {
  onApply: (layout: LayoutType) => void
}

const OPTIONS: { type: LayoutType; labelKey: string }[] = [
  { type: 'crescent', labelKey: 'layout.crescent' },
  { type: 'wreath', labelKey: 'layout.wreath' },
  { type: 'dome', labelKey: 'layout.dome' },
]

const pillStyle: React.CSSProperties = {
  height: 36,
  padding: '0 14px',
  background: 'rgba(0,0,0,0.06)',
  border: '1.5px solid rgba(0,0,0,0.08)',
  borderRadius: 18,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
  fontFamily: 'sans-serif',
  fontSize: 13,
  color: '#555',
  letterSpacing: '0.01em',
}

export function LayoutPicker({ onApply }: Props) {
  const { t } = useLanguage()
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span
        style={{
          fontFamily: 'sans-serif',
          fontSize: 12,
          color: 'rgba(0,0,0,0.45)',
          letterSpacing: '0.02em',
          userSelect: 'none',
        }}
      >
        {t('layout.label')}
      </span>
      {OPTIONS.map(o => (
        <button
          key={o.type}
          onClick={() => onApply(o.type)}
          style={pillStyle}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.12)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
        >
          {t(o.labelKey)}
        </button>
      ))}
    </div>
  )
}
