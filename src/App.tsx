import React, { useRef, useState, useCallback, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { initialState } from './data/initialState'
import { computeGradient, computePeonyGradient } from './data/gradient'
import type { AppState, FlowerType } from './types'
import { FlowerTray } from './components/FlowerTray'
import { DragManager } from './components/DragManager'
import { Screen1 } from './components/Screen1'
import { FlowerColorPicker } from './components/FlowerColorPicker'
import { LayoutPicker } from './components/LayoutPicker'
import type { DragInfo } from './components/DragManager'
import type { LayoutType } from './layout/types'
import { generateCrescent } from './layout/crescent'
import { generateWreath } from './layout/wreath'
import { generateDome } from './layout/dome'
import { trackScreen2Enter, trackScreen2Exit } from './lib/analytics'
import { useLanguage } from './i18n'
import { FeedbackModal } from './components/FeedbackModal'

const DEG = Math.PI / 180

const btnStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.06)',
  border: '1.5px solid rgba(0,0,0,0.08)',
  borderRadius: '50%',
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
  padding: 0,
}

function rgb(color: [number, number, number]): THREE.Color {
  return new THREE.Color(color[0], color[1], color[2])
}

function CameraLight() {
  const ref = useRef<THREE.DirectionalLight>(null)
  const { camera } = useThree()
  useFrame(() => { ref.current?.position.copy(camera.position) })
  return <directionalLight ref={ref} color="#fff5e6" intensity={0.5} />
}

function CakeScene({
  state,
  cakeMeshRef,
}: {
  state: AppState
  cakeMeshRef: React.RefObject<THREE.Mesh | null>
}) {
  const cake = state.cake.layers[0]
  const board = state.board
  const boardY = -cake.height / 2 - board.height / 2
  return (
    <>
      <mesh ref={cakeMeshRef} castShadow receiveShadow>
        <cylinderGeometry args={[cake.radius, cake.radius, cake.height, 64]} />
        <meshStandardMaterial color={rgb(cake.color)} />
      </mesh>
      <mesh position={[0, boardY, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[board.radius, board.radius, board.height, 64]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </>
  )
}

function SceneCapture({
  glRef,
  cameraRef,
}: {
  glRef: React.RefObject<THREE.WebGLRenderer | null>
  cameraRef: React.RefObject<THREE.Camera | null>
}) {
  const { gl, camera } = useThree()
  glRef.current = gl
  cameraRef.current = camera
  return null
}

const FEEDBACK_LS_KEY = 'cake_feedback_shown_v1'

const FEEDBACK_ICON = (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1.5 1.5h12v9H8.2l-2.7 2.5V10.5H1.5V1.5z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
)

export default function App() {
  const { t } = useLanguage()
  const [state, setState] = useState<AppState>(initialState)
  const [creditsHover, setCreditsHover] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackTrigger, setFeedbackTrigger] = useState('manual')

  // All refs must be declared unconditionally (React rules of hooks)
  const cakeMeshRef = useRef<THREE.Mesh>(null)
  const orbitRef = useRef<{ enabled: boolean }>(null)
  const dragRef = useRef<DragInfo | null>(null)
  const glRef = useRef<THREE.WebGLRenderer>(null)
  const cameraRef = useRef<THREE.Camera>(null)
  // Prevent duplicate auto-triggers (also initialised to true if already shown)
  const feedbackTriggeredRef = useRef(!!localStorage.getItem(FEEDBACK_LS_KEY))
  const prevCakeCountRef = useRef(0)

  // ── Feedback auto-trigger ───────────────────────────────────────────────
  function tryShowFeedback(source: string) {
    if (feedbackTriggeredRef.current) return
    feedbackTriggeredRef.current = true
    localStorage.setItem(FEEDBACK_LS_KEY, '1')
    setTimeout(() => {
      setFeedbackTrigger(source)
      setFeedbackOpen(true)
    }, 2000)
  }

  // Condition b: 4th flower placed on cake
  useEffect(() => {
    if (state.currentScreen !== 'screen2') return
    const count = state.flowers.filter(f => f.onCake).length
    if (prevCakeCountRef.current < 4 && count >= 4) tryShowFeedback('flower_count')
    prevCakeCountRef.current = count
  }, [state.flowers, state.currentScreen])

  // Condition c: 90 seconds on Screen 2
  useEffect(() => {
    if (state.currentScreen !== 'screen2') return
    const timer = setTimeout(() => tryShowFeedback('time'), 90000)
    return () => clearTimeout(timer)
  }, [state.currentScreen])
  // ────────────────────────────────────────────────────────────────────────

  // Screen 2: change shade only — keeps baseColor, changes color
  function handleFlowerShadeChange(color: [number, number, number]) {
    setState(s => ({
      ...s,
      flowers: s.flowers.map(f =>
        f.id === s.selectedId ? { ...f, color } : f
      ),
    }))
  }

  // Screen 2: change family — sets new baseColor, applies middle shade (index 2 of 5)
  function handleFlowerFamilyChange(baseHex: string) {
    setState(s => {
      const flower = s.flowers.find(f => f.id === s.selectedId)
      if (!flower) return s
      const gradient = flower.type === 'peony'
        ? computePeonyGradient(baseHex, 5)
        : computeGradient(baseHex, 5)
      return {
        ...s,
        flowers: s.flowers.map(f =>
          f.id === s.selectedId ? { ...f, baseColor: baseHex, color: gradient[2] } : f
        ),
      }
    })
  }

  // Screen 1: assign a palette color to all tray flowers of one type, with gradient
  function handleColorAssign(type: FlowerType, hex: string) {
    setState(s => {
      const trayCount = s.flowers.filter(f => f.type === type && !f.onCake).length
      const gradient = type === 'peony'
        ? computePeonyGradient(hex, trayCount)
        : computeGradient(hex, trayCount)
      let gi = 0
      return {
        ...s,
        typeColorMap: { ...s.typeColorMap, [type]: hex },
        flowers: s.flowers.map(f => {
          if (f.type !== type || f.onCake) return f
          return { ...f, baseColor: hex, color: gradient[gi++] }
        }),
      }
    })
  }

  // Screen 2: apply a layout prototype (layout-engine-spec §6)
  // D4 決議：套用佈局 = 重排整顆蛋糕，已在蛋糕上的花先收回 tray 再重新佈局
  function handleApplyLayout(layout: LayoutType) {
    // 生成放在 setState 外（StrictMode 下 updater 會被雙重呼叫，生成含隨機性）
    const cake = { radius: state.cake.layers[0].radius, height: state.cake.layers[0].height }
    const generate =
      layout === 'crescent' ? generateCrescent :
      layout === 'wreath'   ? generateWreath :
                              generateDome
    const seed = Math.floor(Math.random() * 0xffffffff) >>> 0
    const { result, report } = generate(state.flowers, cake, seed)
    if (!report.pass) {
      // 已知情況：dome 覆蓋率受庫存上限限制（backlog.md 設計提議），回傳違規最少版本
      console.warn(
        `[layout] ${layout} 硬約束未全數通過（seed ${result.seed}）：`,
        report.checks.filter(c => !c.pass).map(c => `${c.id}: ${c.value}（limit ${c.limit}）`),
      )
    }
    const placementById = new Map(result.placements.map(p => [p.flowerId, p]))
    setState(s => ({
      ...s,
      selectedId: null,
      draggingId: null,
      flowers: s.flowers.map(f => {
        const p = placementById.get(f.id)
        if (p) {
          return { ...f, position: p.position, rotation: p.rotation, scale: p.scale, onCake: true }
        }
        // 未被佈局選用的花收回 tray（scale 重置比照 DragManager 拖回行為）
        return { ...f, position: f.slotPosition, rotation: [0, 0, 0] as [number, number, number], scale: 1, onCake: false }
      }),
    }))
  }

  // Screen 1 → Screen 2 transition
  function handleStart() {
    trackScreen2Enter()
    setState(s => ({ ...s, currentScreen: 'screen2' }))
  }

  function onFlowerPointerDown(flowerId: string, e: PointerEvent) {
    dragRef.current = { flowerId, startX: e.clientX, startY: e.clientY, didDrag: false }
  }

  const onCakeClick = useCallback(() => {
    setState(s => ({ ...s, selectedId: null }))
  }, [])

  function handleReset() {
    trackScreen2Exit('reset')
    setState({ ...initialState })
    const camera = cameraRef.current as THREE.PerspectiveCamera | null
    if (camera) camera.position.set(2, 18, 28)
    const controls = orbitRef.current as any
    if (controls) { controls.target.set(5, 0, 0); controls.update() }
  }

  function handleScreenshot() {
    const gl = glRef.current
    if (!gl) return
    gl.domElement.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cake.png'
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
    tryShowFeedback('screenshot')
  }

  // Fire screen2_exit when the user closes/navigates away while on screen2
  useEffect(() => {
    if (state.currentScreen !== 'screen2') return
    const handler = () => trackScreen2Exit('page_close')
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state.currentScreen])

  // Screen 1
  if (state.currentScreen === 'screen1') {
    return (
      <Screen1
        flowers={state.flowers}
        onColorAssign={handleColorAssign}
        onStart={handleStart}
      />
    )
  }

  // Screen 2 — arrangement view
  const selectedFlower = state.selectedId
    ? (state.flowers.find(f => f.id === state.selectedId) ?? null)
    : null

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: 'linear-gradient(to bottom, #f0ebe4 0%, #e0d5c8 55%, #d4b896 100%)' }}>
      <Canvas
        camera={{ position: [2, 18, 28], fov: 50 }}
        shadows
        gl={{ toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true, alpha: true }}
      >
        <ambientLight color="#fff5e6" intensity={1.5} />
        <hemisphereLight args={['#fff5e6', '#d4b896', 1.0]} />
        <directionalLight
          castShadow
          color="#fff5e6"
          position={[5, 15, 8]}
          intensity={0.5}
          shadow-mapSize={[1024, 1024] as [number, number]}
          shadow-camera-left={-20}
          shadow-camera-right={30}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
          shadow-camera-near={1}
          shadow-camera-far={70}
        />
        {/* Table surface — aligned with board bottom (y = -2.3) */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[5, -2.3, 3]}>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#d4b896" roughness={0.85} />
        </mesh>
        <CameraLight />
        <SceneCapture glRef={glRef} cameraRef={cameraRef} />

        <CakeScene state={state} cakeMeshRef={cakeMeshRef} />

        <Suspense fallback={null}>
          <FlowerTray
            flowers={state.flowers}
            draggingId={state.draggingId}
            selectedId={state.selectedId}
            onFlowerPointerDown={onFlowerPointerDown}
          />
          <DragManager
            state={state}
            setState={setState}
            cakeMeshRef={cakeMeshRef}
            orbitRef={orbitRef}
            dragRef={dragRef}
            onCakeClick={onCakeClick}
          />
        </Suspense>

        <OrbitControls
          ref={orbitRef as any}
          target={[5, 0, 0]}
          minPolarAngle={0}
          maxPolarAngle={85 * DEG}
          minDistance={15}
          maxDistance={35}
          enablePan={true}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
        />
      </Canvas>

      <LayoutPicker onApply={handleApplyLayout} />

      {selectedFlower && (
        <FlowerColorPicker
          flower={selectedFlower}
          onShadeChange={handleFlowerShadeChange}
          onFamilyChange={handleFlowerFamilyChange}
        />
      )}

      {/* Feedback button — top right, to the left of LanguageSwitcher */}
      <button
        onClick={() => {
          feedbackTriggeredRef.current = true
          localStorage.setItem(FEEDBACK_LS_KEY, '1')
          setFeedbackTrigger('manual')
          setFeedbackOpen(true)
        }}
        style={{
          position: 'fixed',
          top: 16,
          right: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 40,
          padding: '0 14px',
          background: 'rgba(0,0,0,0.06)',
          border: '1.5px solid rgba(0,0,0,0.08)',
          borderRadius: 20,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          fontFamily: 'sans-serif',
          fontSize: 13,
          color: '#555',
          zIndex: 20,
          letterSpacing: '0.01em',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.12)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.06)' }}
      >
        {FEEDBACK_ICON}
        {t('feedback.button')}
      </button>

      {feedbackOpen && (
        <FeedbackModal
          triggerSource={feedbackTrigger}
          onClose={() => setFeedbackOpen(false)}
        />
      )}

      <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          onClick={handleScreenshot}
          title={t('btn.screenshot')}
          style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.12)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 3V12M9 12L5.5 8.5M9 12L12.5 8.5" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="3" y1="15.5" x2="15" y2="15.5" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          onClick={handleReset}
          title={t('btn.reset')}
          style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.12)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.5 9A5.5 5.5 0 1 0 5.2 5.2" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
            <polyline points="2,3 2,6.5 5.5,6.5" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </button>

        {/* Credits */}
        <div style={{ position: 'relative' }}
          onMouseEnter={() => setCreditsHover(true)}
          onMouseLeave={() => setCreditsHover(false)}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            height: 28,
            cursor: 'default',
            userSelect: 'none',
            justifyContent: 'flex-end',
          }}>
            <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', letterSpacing: 0.2 }}>{t('credits.label')}</span>
            <span style={{ fontSize: 15, color: 'rgba(0,0,0,0.5)', lineHeight: 1 }}>ⓘ</span>
          </div>

          {creditsHover && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: 6,
              background: 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 8,
              padding: '8px 10px',
              width: 240,
              boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
              fontSize: 11,
              lineHeight: 1.6,
              color: 'rgba(0,0,0,0.45)',
            }}>
              <div style={{ marginBottom: 4, color: 'rgba(0,0,0,0.35)', fontWeight: 500 }}>{t('credits.3dmodels')}</div>
              <div>
                "Rose" by Heliona —{' '}
                <span style={{ color: 'rgba(0,0,0,0.35)' }}>CC BY</span>{' '}
                <a href="https://skfb.ly/ouCso" target="_blank" rel="noreferrer"
                  style={{ color: 'rgba(0,0,0,0.38)', textDecoration: 'underline' }}>
                  skfb.ly/ouCso
                </a>
              </div>
              <div>
                "Hydrangea" by heyyodd —{' '}
                <span style={{ color: 'rgba(0,0,0,0.35)' }}>CC BY-NC</span>{' '}
                <a href="https://skfb.ly/opZrM" target="_blank" rel="noreferrer"
                  style={{ color: 'rgba(0,0,0,0.38)', textDecoration: 'underline' }}>
                  skfb.ly/opZrM
                </a>
              </div>
              <div>
                "Peony" by Terrie Simmons-Ehrhardt —{' '}
                <span style={{ color: 'rgba(0,0,0,0.35)' }}>CC BY-NC-SA</span>{' '}
                <a href="https://skfb.ly/ouDZC" target="_blank" rel="noreferrer"
                  style={{ color: 'rgba(0,0,0,0.38)', textDecoration: 'underline' }}>
                  skfb.ly/ouDZC
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
