'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

// Palette
const PALETTE = [
  new THREE.Color('#00f0ff'),
  new THREE.Color('#00f0ff'),
  new THREE.Color('#00f0ff'),
  new THREE.Color('#00c8ff'),
  new THREE.Color('#ffffff'),
  new THREE.Color('#ffb700'),
  new THREE.Color('#ffb700'),
  new THREE.Color('#ff2a5f'),
]

export default function Constellation3D({ onNodeClick }) {
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 1)
    mount.appendChild(renderer.domElement)

    // ----- Post-processing bloom -----
    const composer = new EffectComposer(renderer)
    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.2,  // strength
      0.6,  // radius
      0.0   // threshold
    )
    composer.addPass(bloomPass)

    const root = new THREE.Group()
    scene.add(root)

    // ----- PARTICLES -----
    const PARTICLE_COUNT = 2400
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const nodes = []

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const shellBias = Math.random()
      const r = shellBias < 0.75
        ? 3.2 + (Math.random() - 0.5) * 1.4
        : 0.6 + Math.random() * 2.5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.cos(phi)
      const z = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      nodes.push({ i, x, y, z, r })
      const c = PALETTE[Math.floor(Math.random() * PALETTE.length)]
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // Round sprite
    const spriteCanvas = document.createElement('canvas')
    spriteCanvas.width = spriteCanvas.height = 64
    const sctx = spriteCanvas.getContext('2d')
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.3, 'rgba(255,255,255,0.7)')
    grad.addColorStop(0.7, 'rgba(255,255,255,0.15)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    sctx.fillStyle = grad
    sctx.fillRect(0, 0, 64, 64)
    const sprite = new THREE.CanvasTexture(spriteCanvas)

    const particleMat = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      map: sprite,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    const particles = new THREE.Points(particleGeo, particleMat)
    root.add(particles)

    // ----- CONNECTIONS -----
    const linePositions = []
    const lineColors = []
    const MAX_CONN_PER_NODE = 3
    const CONN_DIST = 0.55
    const shellIndices = nodes.filter(n => n.r > 2.4).map(n => n.i)
    for (let ii = 0; ii < shellIndices.length; ii++) {
      const i = shellIndices[ii]
      const ax = positions[i * 3], ay = positions[i * 3 + 1], az = positions[i * 3 + 2]
      let count = 0
      for (let s = 0; s < 40 && count < MAX_CONN_PER_NODE; s++) {
        const j = shellIndices[Math.floor(Math.random() * shellIndices.length)]
        if (j === i) continue
        const bx = positions[j * 3], by = positions[j * 3 + 1], bz = positions[j * 3 + 2]
        const dx = ax - bx, dy = ay - by, dz = az - bz
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d < CONN_DIST) {
          linePositions.push(ax, ay, az, bx, by, bz)
          lineColors.push(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2])
          lineColors.push(colors[j * 3], colors[j * 3 + 1], colors[j * 3 + 2])
          count++
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3))
    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const lineSegs = new THREE.LineSegments(lineGeo, lineMat)
    root.add(lineSegs)

    // ----- CENTRAL CORE -----
    const coreGroup = new THREE.Group()
    root.add(coreGroup)
    const makeGlow = (r, color, opacity) => {
      const g = new THREE.SphereGeometry(r, 32, 32)
      const m = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
      return new THREE.Mesh(g, m)
    }
    const core1 = makeGlow(0.22, 0xffffff, 1.0)
    const core2 = makeGlow(0.42, 0xa5f3fc, 0.55)
    const core3 = makeGlow(0.75, 0x22d3ee, 0.28)
    const core4 = makeGlow(1.2, 0x0ea5e9, 0.14)
    const core5 = makeGlow(2.0, 0x0891b2, 0.06)
    coreGroup.add(core1, core2, core3, core4, core5)

    // Highlight marker for selected node (small pulsing ring)
    const highlight = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.12, 24),
      new THREE.MeshBasicMaterial({
        color: 0xff2a5f, side: THREE.DoubleSide,
        transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
      })
    )
    root.add(highlight)
    let highlightUntil = 0

    // ----- Mouse interaction -----
    const targetRot = { x: 0, y: 0 }
    const onMouseMove = (e) => {
      const rect = mount.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      targetRot.y = nx * 0.5
      targetRot.x = ny * 0.3
    }
    window.addEventListener('mousemove', onMouseMove)

    // ----- Raycaster for click-to-select -----
    const raycaster = new THREE.Raycaster()
    raycaster.params.Points.threshold = 0.14
    const mouseNdc = new THREE.Vector2()
    let downXY = null
    const onPointerDown = (e) => { downXY = { x: e.clientX, y: e.clientY, t: Date.now() } }
    const onPointerUp = (e) => {
      if (!downXY) return
      const dx = e.clientX - downXY.x, dy = e.clientY - downXY.y
      const moved = Math.hypot(dx, dy)
      const elapsed = Date.now() - downXY.t
      downXY = null
      if (moved > 6 || elapsed > 500) return // treat as drag/hold
      const rect = mount.getBoundingClientRect()
      mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouseNdc, camera)
      const hits = raycaster.intersectObject(particles)
      if (hits.length > 0) {
        // Pick nearest node to camera among hits
        const hit = hits[0]
        const idx = hit.index
        // Use current world-space position of that point (accounts for rotation)
        const localVec = new THREE.Vector3(
          positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]
        )
        const worldVec = localVec.clone().applyMatrix4(root.matrixWorld)
        // Position + show highlight
        highlight.position.copy(localVec)
        highlight.lookAt(camera.position.clone().applyMatrix4(root.matrixWorld.clone().invert()))
        highlightUntil = performance.now() + 2500
        // Screen coords for the DOM detail panel
        const proj = worldVec.clone().project(camera)
        const sx = (proj.x * 0.5 + 0.5) * rect.width + rect.left
        const sy = (-proj.y * 0.5 + 0.5) * rect.height + rect.top
        if (callbackRef.current) {
          callbackRef.current({
            index: idx,
            x: sx, y: sy,
            r: Math.hypot(localVec.x, localVec.y, localVec.z),
            color: new THREE.Color(colors[idx * 3], colors[idx * 3 + 1], colors[idx * 3 + 2]).getHexString(),
          })
        }
      }
    }
    renderer.domElement.style.cursor = 'crosshair'
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    // ----- ANIMATION -----
    let raf
    const clock = new THREE.Clock()
    const animate = () => {
      const t = clock.getElapsedTime()
      root.rotation.y += (targetRot.y + t * 0.08 - root.rotation.y) * 0.02
      root.rotation.x += (targetRot.x - root.rotation.x) * 0.03

      const pulse = 1 + Math.sin(t * 2.2) * 0.08
      core1.scale.setScalar(pulse)
      core2.scale.setScalar(1 + Math.sin(t * 1.6) * 0.15)
      core3.scale.setScalar(1 + Math.sin(t * 1.1 + 1) * 0.2)
      lineSegs.material.opacity = 0.28 + Math.sin(t * 1.5) * 0.1

      // Highlight pulse
      if (performance.now() < highlightUntil) {
        const life = 1 - (highlightUntil - performance.now()) / 2500
        highlight.material.opacity = (1 - life) * 0.9
        const s = 1 + life * 2
        highlight.scale.setScalar(s)
        // billboard
        highlight.quaternion.copy(camera.quaternion)
      } else {
        highlight.material.opacity = 0
      }

      composer.render()
      raf = requestAnimationFrame(animate)
    }
    animate()

    // Resize
    const onResize = () => {
      if (!mount) return
      const w = mount.clientWidth, h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      composer.setSize(w, h)
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
      composer.dispose && composer.dispose()
      particleGeo.dispose(); particleMat.dispose()
      lineGeo.dispose(); lineMat.dispose()
      sprite.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className="absolute inset-0" />
}
