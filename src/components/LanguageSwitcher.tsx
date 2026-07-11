import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../i18n'
import type { Locale } from '../i18n'

const GLOBE_ICON = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="9" cy="9" r="7" stroke="#555" strokeWidth="1.5"/>
    <ellipse cx="9" cy="9" rx="3" ry="7" stroke="#555" strokeWidth="1.5"/>
    <line x1="2" y1="9" x2="16" y2="9" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="3.5" y1="5.5" x2="14.5" y2="5.5" stroke="#555" strokeWidth="1.2" strokeLinecap="round"/>
    <line x1="3.5" y1="12.5" x2="14.5" y2="12.5" stroke="#555" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
)

const LANGUAGES: { locale: Locale; label: string }[] = [
  { locale: 'zh-TW', label: '繁體中文' },
  { locale: 'en',    label: 'English' },
]

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'fixed', top: 16, right: 16, zIndex: 100 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'rgba(0,0,0,0.06)',
          border: '1.5px solid rgba(0,0,0,0.08)',
          borderRadius: '50%',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          padding: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.12)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)' }}
      >
        {GLOBE_ICON}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          minWidth: 130,
        }}>
          {LANGUAGES.map(({ locale: l, label }) => (
            <button
              key={l}
              onClick={() => { setLocale(l); setOpen(false) }}
              style={{
                display: 'block',
                width: '100%',
                padding: '9px 16px',
                background: locale === l ? 'rgba(0,0,0,0.06)' : 'transparent',
                border: 'none',
                textAlign: 'left',
                fontFamily: 'sans-serif',
                fontSize: 13,
                color: locale === l ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.55)',
                fontWeight: locale === l ? 600 : 400,
                cursor: 'pointer',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => {
                if (locale !== l) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = locale === l ? 'rgba(0,0,0,0.06)' : 'transparent'
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
