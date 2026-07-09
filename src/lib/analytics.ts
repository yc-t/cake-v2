import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined

if (KEY) {
  posthog.init(KEY, {
    api_host: 'https://us.i.posthog.com',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    person_profiles: 'always',
    request_batching: false,
  })
}

function capture(
  event: string,
  props?: Record<string, unknown>,
  options?: Parameters<typeof posthog.capture>[2],
) {
  if (!KEY) return
  posthog.capture(event, props, options)
}

// Module-level session timestamps — survive across React re-renders/remounts
let screen1EnterAt = 0
let screen2EnterAt = 0

export function trackScreen1Enter() {
  screen1EnterAt = Date.now()
  capture('screen1_enter', { ts: screen1EnterAt })
}

export function trackScreen2Enter() {
  screen2EnterAt = Date.now()
  capture('screen2_enter', {
    ts: screen2EnterAt,
    // Time the user spent on screen1 before starting
    screen1_duration_ms: screen1EnterAt ? screen2EnterAt - screen1EnterAt : undefined,
  })
}

export function trackScreen2Exit(reason: 'reset' | 'page_close') {
  const now = Date.now()
  capture('screen2_exit', {
    ts: now,
    reason,
    // Time spent arranging flowers on screen2
    screen2_duration_ms: screen2EnterAt ? now - screen2EnterAt : undefined,
    // Full session from app open to close/reset
    session_duration_ms: screen1EnterAt ? now - screen1EnterAt : undefined,
  }, reason === 'page_close' ? { transport: 'sendBeacon' } : undefined)
}

export function trackChangeFlowerColor(row: 'row1' | 'row2') {
  capture('change_single_flower_color', { row })
}
