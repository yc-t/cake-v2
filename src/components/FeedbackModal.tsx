import React, { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../i18n'
import type { Locale } from '../i18n'
import { trackUserFeedback, trackFeedbackRatingSelected } from '../lib/analytics'

interface Props {
  triggerSource: string
  onClose: () => void
}

const Q2_OPTIONS: { key: string; label: Record<Locale, string> }[] = [
  { key: 'color_picking',    label: { 'zh-TW': '選花的顏色',     en: 'Choosing flower colors' } },
  { key: 'dragging_flowers', label: { 'zh-TW': '拖花朵到蛋糕上',  en: 'Dragging flowers onto the cake' } },
  { key: 'cake_color',       label: { 'zh-TW': '換蛋糕底色',     en: 'Changing cake base color' } },
  { key: 'rotating_view',    label: { 'zh-TW': '旋轉視角',       en: 'Rotating the view' } },
  { key: 'moving_flowers',   label: { 'zh-TW': '移動花朵',       en: 'Moving flowers' } },
  { key: 'nothing',          label: { 'zh-TW': '沒有卡住的地方',  en: 'Nothing was difficult' } },
]

const Q3_OPTIONS: { key: string; label: Record<Locale, string> }[] = [
  { key: 'more_flowers',     label: { 'zh-TW': '增加更多花的種類',    en: 'Add more flower types' } },
  { key: 'more_colors',      label: { 'zh-TW': '增加更多顏色選項',    en: 'Add more color options' } },
  { key: 'shade_control',    label: { 'zh-TW': '可以調整單朵花的深淺', en: 'Adjust individual flower shading' } },
  { key: 'more_cake_shapes', label: { 'zh-TW': '增加蛋糕造型',       en: 'Add more cake shapes' } },
  { key: 'other',            label: { 'zh-TW': '其他（請說明）',     en: 'Other (please specify)' } },
]

// Padding used in both steps — must match for accurate height measurement
const STEP_PADDING = '22px 28px 26px'

const chipBase: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 20,
  border: '1.5px solid rgba(0,0,0,0.10)',
  fontFamily: 'sans-serif',
  fontSize: 13,
  cursor: 'pointer',
  transition: 'all 0.12s',
  userSelect: 'none',
  lineHeight: 1.4,
  background: 'none',
}

const qLabel: React.CSSProperties = {
  fontSize: 13,
  color: '#555',
  marginBottom: 10,
  lineHeight: 1.6,
}

export function FeedbackModal({ triggerSource, onClose }: Props) {
  const { locale, t } = useLanguage()

  // ── Mount animation ─────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // ── Expand animation state ───────────────────────────────────────────────
  // phase:      which step is active
  // step1Alpha: controls Q1 content fade-out
  // step2Alpha: controls Q2-Q4 content fade-in
  // cardH:      explicit pixel height during transition, 'auto' otherwise
  const [phase,      setPhase]      = useState<'step1' | 'step2'>('step1')
  const [step1Alpha, setStep1Alpha] = useState(1)
  const [step2Alpha, setStep2Alpha] = useState(0)
  const [cardH,      setCardH]      = useState<'auto' | number>('auto')

  // ── Form state ───────────────────────────────────────────────────────────
  const [rating,          setRating]          = useState<number | null>(null)
  const [hoverRating,     setHoverRating]     = useState<number | null>(null)
  const [painPoints,      setPainPoints]      = useState<string[]>([])
  const [featurePriority, setFeaturePriority] = useState('')
  const [otherText,       setOtherText]       = useState('')
  const [comment,         setComment]         = useState('')
  const [submitted,       setSubmitted]       = useState(false)

  // ── Refs ─────────────────────────────────────────────────────────────────
  const cardRef        = useRef<HTMLDivElement>(null)
  // step2Ref doubles as the ghost (position:absolute, invisible) on step1,
  // and as the actual step2 content on step2. Same DOM node, style changes.
  const step2Ref       = useRef<HTMLDivElement>(null)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
  }, [])

  // ── Expansion sequence ───────────────────────────────────────────────────
  function beginExpansion() {
    const h1 = cardRef.current?.offsetHeight  ?? 0
    const h2 = step2Ref.current?.offsetHeight ?? 0

    // 1. Fade out Q1 + lock card at step-1 height
    setStep1Alpha(0)
    setCardH(h1)

    // 2. Next two frames: expand to step-2 height (300ms ease-out)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setCardH(h2)
      })
    })

    // 3. After 350ms (300ms transition + 50ms buffer): show step 2
    setTimeout(() => {
      setPhase('step2')
      // Step 2 div is now in-flow; fade it in next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStep2Alpha(1)
          // 4. Release height lock once step-2 is visible (allow "other" input to grow)
          setTimeout(() => setCardH('auto'), 100)
        })
      })
    }, 350)
  }

  function handleRatingClick(n: number) {
    setRating(n)
    trackFeedbackRatingSelected({ rating: n, trigger_source: triggerSource })
    if (phase !== 'step1') return
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    advanceTimerRef.current = setTimeout(beginExpansion, 400)
  }

  function togglePainPoint(key: string) {
    setPainPoints(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function handleSubmit() {
    if (rating === null) return
    const fp = featurePriority === 'other' && otherText.trim()
      ? `other: ${otherText.trim()}`
      : featurePriority
    trackUserFeedback({
      rating,
      pain_points: painPoints,
      feature_priority: fp,
      comment: comment.trim(),
      trigger_source: triggerSource,
    })
    setSubmitted(true)
    setCardH('auto')
    setTimeout(onClose, 2000)
  }

  const displayRating = hoverRating ?? rating

  // Card height / transition
  const isAnimatingHeight = typeof cardH === 'number'
  const cardHeightStyle: React.CSSProperties = isAnimatingHeight
    ? { height: cardH, transition: 'height 300ms ease-out, opacity 300ms ease-out, transform 300ms ease-out' }
    : { height: 'auto', transition: 'opacity 300ms ease-out, transform 300ms ease-out' }

  return (
    // Overlay — 300ms fade in; keeps card centred as card height grows
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.38)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: '20px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 300ms ease-out',
      }}
    >
      {/*
        Card:
        - overflow: hidden clips the ghost (step2 positioned absolutely on step1).
          Box-shadow is NOT affected by overflow: hidden.
        - position: relative so the ghost positions relative to this card.
      */}
      <div
        ref={cardRef}
        style={{
          background: '#fff',
          borderRadius: 18,
          width: '100%',
          maxWidth: 460,
          position: 'relative',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          fontFamily: 'sans-serif',
          flexShrink: 0,
          overflow: 'hidden',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          ...cardHeightStyle,
        }}
      >
        {/* X — z-index 2 so it sits above both steps during transition */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            zIndex: 2,
            width: 28,
            height: 28,
            border: 'none',
            background: 'rgba(0,0,0,0.06)',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            fontSize: 18,
            color: '#555',
            lineHeight: 1,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.12)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)' }}
        >
          ×
        </button>

        {submitted ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 140,
            padding: '28px',
            fontSize: 17,
            color: '#555',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}>
            {t('feedback.thanks')}
          </div>
        ) : (
          <>
            {/* ── Step 1 (Q1) — rendered in flow; removed from DOM once step2 starts ── */}
            {phase === 'step1' && (
              <div style={{
                padding: STEP_PADDING,
                opacity: step1Alpha,
                transition: 'opacity 150ms ease-out',
              }}>
                <div style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#333',
                  marginBottom: 18,
                  paddingRight: 32,
                  letterSpacing: '0.01em',
                }}>
                  {t('feedback.title')}
                </div>

                <div style={qLabel}>{t('feedback.q1')}</div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => handleRatingClick(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(null)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: displayRating === n
                          ? '2px solid #333'
                          : '1.5px solid rgba(0,0,0,0.15)',
                        background: displayRating === n ? '#333' : 'transparent',
                        color: displayRating === n ? '#fff' : '#555',
                        fontSize: 14,
                        fontWeight: displayRating === n ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                        fontFamily: 'sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: 232,
                  marginTop: 6,
                }}>
                  <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>
                    1 {t('feedback.q1.min')}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>
                    5 {t('feedback.q1.max')}
                  </span>
                </div>
              </div>
            )}

            {/*
              ── Step 2 (Q2–Q4) ───────────────────────────────────────────────
              phase === 'step1': position absolute, visibility hidden → ghost for height measurement.
                                 Must use the same padding as the actual rendering.
              phase === 'step2': normal in-flow, opacity-transitioned.
            */}
            <div
              ref={step2Ref}
              style={phase === 'step1' ? {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                padding: STEP_PADDING,
                boxSizing: 'border-box',
                visibility: 'hidden',
                pointerEvents: 'none',
              } : {
                padding: STEP_PADDING,
                opacity: step2Alpha,
                transition: 'opacity 200ms ease-out',
              }}
            >
              <div style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#333',
                marginBottom: 18,
                paddingRight: 32,
                letterSpacing: '0.01em',
              }}>
                {t('feedback.title')}
              </div>

              {/* Q2 — multi-select */}
              <div style={{ marginBottom: 18 }}>
                <div style={qLabel}>{t('feedback.q2')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Q2_OPTIONS.map(opt => {
                    const selected = painPoints.includes(opt.key)
                    return (
                      <button
                        key={opt.key}
                        onClick={() => togglePainPoint(opt.key)}
                        style={{
                          ...chipBase,
                          background: selected ? '#333' : 'rgba(0,0,0,0.03)',
                          color: selected ? '#fff' : '#555',
                          borderColor: selected ? '#333' : 'rgba(0,0,0,0.10)',
                        }}
                      >
                        {opt.label[locale]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Q3 — single-select */}
              <div style={{ marginBottom: 18 }}>
                <div style={qLabel}>{t('feedback.q3')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Q3_OPTIONS.map(opt => {
                    const selected = featurePriority === opt.key
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setFeaturePriority(selected ? '' : opt.key)}
                        style={{
                          ...chipBase,
                          background: selected ? '#333' : 'rgba(0,0,0,0.03)',
                          color: selected ? '#fff' : '#555',
                          borderColor: selected ? '#333' : 'rgba(0,0,0,0.10)',
                        }}
                      >
                        {opt.label[locale]}
                      </button>
                    )
                  })}
                </div>
                {featurePriority === 'other' && (
                  <input
                    type="text"
                    value={otherText}
                    onChange={e => setOtherText(e.target.value)}
                    placeholder={t('feedback.q3.other.placeholder')}
                    style={{
                      marginTop: 10,
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1.5px solid rgba(0,0,0,0.12)',
                      fontFamily: 'sans-serif',
                      fontSize: 13,
                      color: '#555',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>

              {/* Q4 — free text */}
              <div style={{ marginBottom: 18 }}>
                <div style={qLabel}>{t('feedback.q4')}</div>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder={t('feedback.q4.placeholder')}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid rgba(0,0,0,0.12)',
                    fontFamily: 'sans-serif',
                    fontSize: 13,
                    color: '#555',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                    lineHeight: 1.5,
                  }}
                />
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleSubmit}
                  style={{
                    padding: '10px 28px',
                    background: '#333',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 22,
                    fontFamily: 'sans-serif',
                    fontSize: 14,
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#555' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#333' }}
                >
                  {t('feedback.submit')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
