'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const PALETTE = [
  new THREE.Color('#00f0ff'), new THREE.Color('#00f0ff'), new THREE.Color('#00f0ff'),
  new THREE.Color('#00c8ff'), new THREE.Color('#ffffff'),
  new THREE.Color('#ffb700'), new THREE.Color('#ffb700'), new THREE.Color('#ff2a5f'),
]

const FLASH_POOL_SIZE = 16

export default function Constellation3D({ onNodeClick, intensityRef, flashesRef }) {
  const mountRef = useRef(null)
  const callbackRef = useRef(onNodeClick)
  useEffect(() => { callbackRef.current = onNodeClick }, [onNodeClick])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200)
    camera.position.set(0, 0, 9)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 1)
    mount.appendChild(renderer.domElement)

    const root = new THREE.Group()
    scene.add(root)

    // ------ PARTICLES ------
    const N = 650
    const positions = new Float32Array(N * 3)
    const colors = new Float32Array(N * 3)
    const baseDir = new Float32Array(N * 3) // unit direction
    const baseR = new Float32Array(N)
    const phase = new Float32Array(N)
    const colorHex = new Array(N)

    for (let i = 0; i < N; i++) {
      const shellBias = Math.random()
      const r = shellBias < 0.75
        ? 3.2 + (Math.random() - 0.5) * 1.4
        : 0.6 + Math.random() * 2.5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const dx = Math.sin(phi) * Math.cos(theta)
      const dy = Math.cos(phi)
      const dz = Math.sin(phi) * Math.sin(theta)
      baseDir[i * 3] = dx; baseDir[i * 3 + 1] = dy; baseDir[i * 3 + 2] = dz
      baseR[i] = r
      phase[i] = Math.random() * Math.PI * 2
      positions[i * 3] = dx * r
      positions[i * 3 + 1] = dy * r
      positions[i * 3 + 2] = dz * r
      const c = PALETTE[Math.floor(Math.random() * PALETTE.length)]
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
      colorHex[i] = c.getHexString()
    }

    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const spriteCanvas = document.createElement('canvas')
    spriteCanvas.width = spriteCanvas.height = 64
    const sctx = spriteCanvas.getContext('2d')
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.3, 'rgba(255,255,255,0.7)')
    grad.addColorStop(0.7, 'rgba(255,255,255,0.15)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    sctx.fillStyle = grad; sctx.fillRect(0, 0, 64, 64)
    const sprite = new THREE.CanvasTexture(spriteCanvas)

    const particleMat = new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, map: sprite,
      transparent: true, opacity: 0.95, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    })
    const particles = new THREE.Points(particleGeo, particleMat)
    root.add(particles)

    // ------ CONNECTIONS (dynamic) ------
    const lineIdx = [] // flat array [a0,b0, a1,b1, ...]
    const shellIndices = []
    for (let i = 0; i < N; i++) if (baseR[i] > 2.4) shellIndices.push(i)
    for (let ii = 0; ii < shellIndices.length; ii++) {
      const i = shellIndices[ii]
      let count = 0
      for (let s = 0; s < 20 && count < 1; s++) {
        const j = shellIndices[Math.floor(Math.random() * shellIndices.length)]
        if (j === i) continue
        const dxx = positions[i * 3] - positions[j * 3]
        const dyy = positions[i * 3 + 1] - positions[j * 3 + 1]
        const dzz = positions[i * 3 + 2] - positions[j * 3 + 2]
        const d = Math.sqrt(dxx * dxx + dyy * dyy + dzz * dzz)
        if (d < 0.55) { lineIdx.push(i, j); count++ }
      }
    }
    const lineCount = lineIdx.length / 2
    const linePositions = new Float32Array(lineCount * 6)
    const lineColors = new Float32Array(lineCount * 6)
    for (let k = 0; k < lineCount; k++) {
      const a = lineIdx[k * 2], b = lineIdx[k * 2 + 1]
      linePositions[k * 6] = positions[a * 3];     linePositions[k * 6 + 1] = positions[a * 3 + 1]; linePositions[k * 6 + 2] = positions[a * 3 + 2]
      linePositions[k * 6 + 3] = positions[b * 3]; linePositions[k * 6 + 4] = positions[b * 3 + 1]; linePositions[k * 6 + 5] = positions[b * 3 + 2]
      lineColors[k * 6] = colors[a * 3];     lineColors[k * 6 + 1] = colors[a * 3 + 1]; lineColors[k * 6 + 2] = colors[a * 3 + 2]
      lineColors[k * 6 + 3] = colors[b * 3]; lineColors[k * 6 + 4] = colors[b * 3 + 1]; lineColors[k * 6 + 5] = colors[b * 3 + 2]
    }
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3))
    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const lineSegs = new THREE.LineSegments(lineGeo, lineMat)
    root.add(lineSegs)

    // ------ CENTRAL CORE ------
    const coreGroup = new THREE.Group(); root.add(coreGroup)
    const makeGlow = (r, color, opacity) => {
      const g = new THREE.SphereGeometry(r, 32, 32)
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })
      return new THREE.Mesh(g, m)
    }
    const core1 = makeGlow(0.22, 0xffffff, 1.0)
    const core2 = makeGlow(0.42, 0xa5f3fc, 0.55)
    const core3 = makeGlow(0.75, 0x22d3ee, 0.28)
    const core4 = makeGlow(1.2, 0x0ea5e9, 0.14)
    const core5 = makeGlow(2.0, 0x0891b2, 0.06)
    coreGroup.add(core1, core2, core3, core4, core5)

    // ------ FLASH POOL (live events + selection highlight) ------
    const flashSpriteMat = new THREE.SpriteMaterial({
      map: sprite, color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const flashPool = []
    for (let k = 0; k < FLASH_POOL_SIZE; k++) {
      const s = new THREE.Sprite(flashSpriteMat.clone())
      s.scale.setScalar(0.001)
      s.visible = false
      root.add(s)
      flashPool.push({ sprite: s, activeFlash: null })
    }

    // ------ Mouse interaction ------
    const targetRot = { x: 0, y: 0 }
    const onMouseMove = (e) => {
      const rect = mount.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      targetRot.y = nx * 0.5; targetRot.x = ny * 0.3
    }
    window.addEventListener('mousemove', onMouseMove)

    // ------ Raycaster ------
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points.threshold = 0.14
    const mouseNdc = new THREE.Vector2()
    let downXY = null
    const onPointerDown = (e) => { downXY = { x: e.clientX, y: e.clientY, t: Date.now() } }
    const onPointerUp = (e) => {
      if (!downXY) return
      const moved = Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y)
      const elapsed = Date.now() - downXY.t
      downXY = null
      if (moved > 6 || elapsed > 500) return
      const rect = mount.getBoundingClientRect()
      mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouseNdc, camera)
      const hits = raycaster.intersectObject(particles)
      if (hits.length > 0) {
        const idx = hits[0].index
        const localVec = new THREE.Vector3(positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2])
        const worldVec = localVec.clone().applyMatrix4(root.matrixWorld)
        const proj = worldVec.clone().project(camera)
        const sx = (proj.x * 0.5 + 0.5) * rect.width + rect.left
        const sy = (-proj.y * 0.5 + 0.5) * rect.height + rect.top
        // Trigger a flash on click
        if (flashesRef && flashesRef.current) {
          flashesRef.current.push({
            index: idx, startTime: performance.now(), duration: 1400, color: 0xffffff, size: 0.6,
          })
        }
        if (callbackRef.current) {
          callbackRef.current({
            index: idx, x: sx, y: sy,
            r: baseR[idx], color: colorHex[idx],
          })
        }
      }
    }
    renderer.domElement.style.cursor = 'crosshair'
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    // ------ ANIMATE ------
    let raf
    const clock = new THREE.Clock()
    let smoothedIntensity = 0
    let rotVelY = 0
    let frame = 0

    const animate = () => {
      const t = clock.getElapsedTime()
      const dt = Math.min(0.05, clock.getDelta())
      const rawIntensity = intensityRef?.current || 0
      smoothedIntensity += (rawIntensity - smoothedIntensity) * 0.15
      const I = smoothedIntensity
      frame++

      // Rotation with inertia
      const targetVelY = 0.08 + I * 0.6
      rotVelY += (targetVelY - rotVelY) * 0.05
      root.rotation.y += rotVelY * dt
      root.rotation.x += (targetRot.x - root.rotation.x) * 0.03

      // Idle breathing (4s period)
      const breath = 1 + 0.025 * Math.sin(t * (Math.PI / 2))
      const burst = 0.16 * I
      const rippleAmp = 0.08 * I

      // Only update particle positions every few frames or when intensity is meaningful
      const needsUpdate = I > 0.03 || frame % 4 === 0
      if (needsUpdate) {
        const sinBase = t * 5
        for (let i = 0; i < N; i++) {
          const i3 = i * 3
          const dx = baseDir[i3], dy = baseDir[i3 + 1], dz = baseDir[i3 + 2]
          const bR = baseR[i]
          const ripple = rippleAmp > 0.001 ? rippleAmp * Math.sin(bR * 2.5 - sinBase + phase[i]) : 0
          const r = bR * (breath + burst + ripple * 0.6)
          positions[i3] = dx * r
          positions[i3 + 1] = dy * r
          positions[i3 + 2] = dz * r
        }
        particleGeo.attributes.position.needsUpdate = true

        // Update line positions less often when idle
        if (I > 0.12 || frame % 12 === 0) {
          for (let k = 0; k < lineCount; k++) {
            const k6 = k * 6
            const a3 = lineIdx[k * 2] * 3
            const b3 = lineIdx[k * 2 + 1] * 3
            linePositions[k6]     = positions[a3]
            linePositions[k6 + 1] = positions[a3 + 1]
            linePositions[k6 + 2] = positions[a3 + 2]
            linePositions[k6 + 3] = positions[b3]
            linePositions[k6 + 4] = positions[b3 + 1]
            linePositions[k6 + 5] = positions[b3 + 2]
          }
          lineGeo.attributes.position.needsUpdate = true
        }
      }

      // Core pulse
      const corePulse = breath + I * 0.3
      core1.scale.setScalar(corePulse * (1 + Math.sin(t * 2.2) * 0.05))
      core2.scale.setScalar(corePulse * (1 + Math.sin(t * 1.6) * 0.12))
      core3.scale.setScalar(corePulse * (1 + Math.sin(t * 1.1 + 1) * 0.16))
      core4.scale.setScalar(1 + I * 0.3)
      core5.scale.setScalar(1 + I * 0.4)
      lineSegs.material.opacity = 0.25 + I * 0.35 + Math.sin(t * 1.5) * 0.05

      // Live-event flashes
      const now = performance.now()
      const active = flashesRef?.current || []
      for (let a = active.length - 1; a >= 0; a--) {
        if (now - active[a].startTime > active[a].duration) active.splice(a, 1)
      }
      for (let k = 0; k < flashPool.length; k++) {
        const slot = flashPool[k]
        if (k < active.length) {
          const f = active[k]
          const life = (now - f.startTime) / f.duration
          if (life >= 1) { slot.sprite.visible = false; slot.activeFlash = null; continue }
          const idx = f.index
          slot.sprite.position.set(positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2])
          slot.sprite.material.color.setHex(f.color || 0xffffff)
          const ease = life < 0.35 ? life / 0.35 : 1
          const fade = life < 0.35 ? 1 : 1 - (life - 0.35) / 0.65
          slot.sprite.scale.setScalar((f.size || 0.35) * (0.4 + ease * 1.8))
          slot.sprite.material.opacity = fade
          slot.sprite.visible = true
        } else {
          slot.sprite.visible = false
        }
      }

      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => {
      if (!mount) return
      const w = mount.clientWidth, h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMouseMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      ro.disconnect()
      renderer.dispose()
      particleGeo.dispose(); particleMat.dispose()
      lineGeo.dispose(); lineMat.dispose()
      sprite.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className="absolute inset-0" />
}
