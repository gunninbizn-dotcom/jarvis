'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// Palette (matches spec)
const PALETTE = [
  new THREE.Color('#00f0ff'), // cyan (dominant)
  new THREE.Color('#00f0ff'),
  new THREE.Color('#00f0ff'),
  new THREE.Color('#00c8ff'),
  new THREE.Color('#ffffff'), // white sparks
  new THREE.Color('#ffb700'), // amber
  new THREE.Color('#ffb700'),
  new THREE.Color('#ff2a5f'), // magenta/red rare
]

export default function Constellation3D() {
  const mountRef = useRef(null)

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

    const root = new THREE.Group()
    scene.add(root)

    // ------ PARTICLE CLOUD ------
    const PARTICLE_COUNT = 2400
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT)
    const nodes = [] // Vector3 array for connection graph

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Distribute mostly on sphere shell with some inner scatter
      const shellBias = Math.random()
      const r = shellBias < 0.75
        ? 3.2 + (Math.random() - 0.5) * 1.4          // dense shell
        : 0.6 + Math.random() * 2.5                   // inner sparks

      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.cos(phi)
      const z = r * Math.sin(phi) * Math.sin(theta)

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      nodes.push(new THREE.Vector3(x, y, z))

      const c = PALETTE[Math.floor(Math.random() * PALETTE.length)]
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b

      sizes[i] = 0.02 + Math.random() * 0.055
    }

    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // Soft round sprite texture (procedural)
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

    // ------ CONNECTION LINES (network graph) ------
    // For each shell node, connect to a few nearest neighbors within a threshold
    const linePositions = []
    const lineColors = []
    const MAX_CONN_PER_NODE = 3
    const CONN_DIST = 0.55

    // Only consider outer shell nodes for connections (indices where r ~ 3.2)
    const shellIndices = []
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].length() > 2.4) shellIndices.push(i)
    }

    // Naive O(n^2) but limited to shell nodes
    for (let ii = 0; ii < shellIndices.length; ii++) {
      const i = shellIndices[ii]
      const a = nodes[i]
      let count = 0
      // Sample up to 40 random other shell indices for candidates
      for (let s = 0; s < 40 && count < MAX_CONN_PER_NODE; s++) {
        const j = shellIndices[Math.floor(Math.random() * shellIndices.length)]
        if (j === i) continue
        const b = nodes[j]
        const d = a.distanceTo(b)
        if (d < CONN_DIST) {
          linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z)
          const cA = new THREE.Color(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2])
          const cB = new THREE.Color(colors[j * 3], colors[j * 3 + 1], colors[j * 3 + 2])
          lineColors.push(cA.r, cA.g, cA.b, cB.r, cB.g, cB.b)
          count++
        }
      }
    }

    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3))
    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const lineSegs = new THREE.LineSegments(lineGeo, lineMat)
    root.add(lineSegs)

    // ------ GLOWING CENTRAL CORE ------
    // Multi-layer additive spheres to fake bloom
    const coreGroup = new THREE.Group()
    root.add(coreGroup)

    const makeGlow = (r, color, opacity) => {
      const g = new THREE.SphereGeometry(r, 32, 32)
      const m = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      return new THREE.Mesh(g, m)
    }
    const core1 = makeGlow(0.22, 0xffffff, 1.0)
    const core2 = makeGlow(0.42, 0xa5f3fc, 0.55)
    const core3 = makeGlow(0.75, 0x22d3ee, 0.28)
    const core4 = makeGlow(1.2, 0x0ea5e9, 0.14)
    const core5 = makeGlow(2.0, 0x0891b2, 0.06)
    coreGroup.add(core1, core2, core3, core4, core5)

    // Volumetric "god rays" spikes (subtle)
    const spikeGroup = new THREE.Group()
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.PlaneGeometry(0.05, 5)
      const mat = new THREE.MeshBasicMaterial({
        color: 0xa5f3fc,
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const spike = new THREE.Mesh(geo, mat)
      spike.rotation.z = (i / 6) * Math.PI * 2
      spikeGroup.add(spike)
    }
    coreGroup.add(spikeGroup)

    // ------ MOUSE INTERACTION ------
    const targetRot = { x: 0, y: 0 }
    const onMouseMove = (e) => {
      const rect = mount.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      targetRot.y = nx * 0.5
      targetRot.x = ny * 0.3
    }
    window.addEventListener('mousemove', onMouseMove)

    // ------ ANIMATION ------
    let raf
    const clock = new THREE.Clock()
    const animate = () => {
      const t = clock.getElapsedTime()

      // Slow auto-rotate + mouse influence
      root.rotation.y += (targetRot.y + t * 0.08 - root.rotation.y) * 0.02
      root.rotation.x += (targetRot.x - root.rotation.x) * 0.03

      // Core pulse
      const pulse = 1 + Math.sin(t * 2.2) * 0.08
      core1.scale.setScalar(pulse)
      core2.scale.setScalar(1 + Math.sin(t * 1.6) * 0.15)
      core3.scale.setScalar(1 + Math.sin(t * 1.1 + 1) * 0.2)

      spikeGroup.rotation.z = t * 0.15
      lineSegs.material.opacity = 0.28 + Math.sin(t * 1.5) * 0.1

      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    // ------ RESIZE ------
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
