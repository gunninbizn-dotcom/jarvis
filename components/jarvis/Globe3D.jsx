'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function Globe3D() {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 0, 3.6)

    const existingCanvas = mount.querySelector('canvas')
    if (existingCanvas) {
      existingCanvas.remove()
    }
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0x22d3ee, 0.6))
    const l = new THREE.PointLight(0x22d3ee, 2, 20); l.position.set(3, 3, 3); scene.add(l)

    const group = new THREE.Group()
    scene.add(group)

    // Solid dark inner sphere so wireframe reads
    const innerGeo = new THREE.SphereGeometry(1, 32, 32)
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x001820, transparent: true, opacity: 0.7 })
    group.add(new THREE.Mesh(innerGeo, innerMat))

    // Wireframe globe
    const wireGeo = new THREE.SphereGeometry(1.02, 24, 16)
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.6 })
    group.add(new THREE.Mesh(wireGeo, wireMat))

    // Dot points scattered like continents (random distribution, slightly clustered)
    const dotCount = 240
    const dotPos = new Float32Array(dotCount * 3)
    for (let i = 0; i < dotCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 1.03
      dotPos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      dotPos[i * 3 + 1] = r * Math.cos(phi)
      dotPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const dotGeo = new THREE.BufferGeometry()
    dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3))
    const dotMat = new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.03, transparent: true, opacity: 0.9 })
    group.add(new THREE.Points(dotGeo, dotMat))

    // Random "city" markers (bright pins)
    const cityGroup = new THREE.Group()
    const cities = []
    for (let i = 0; i < 8; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const x = Math.sin(phi) * Math.cos(theta)
      const y = Math.cos(phi)
      const z = Math.sin(phi) * Math.sin(theta)
      cities.push(new THREE.Vector3(x, y, z))
      const pinGeo = new THREE.SphereGeometry(0.025, 8, 8)
      const pinMat = new THREE.MeshBasicMaterial({ color: 0xef4444 })
      const pin = new THREE.Mesh(pinGeo, pinMat)
      pin.position.copy(cities[i].clone().multiplyScalar(1.04))
      cityGroup.add(pin)
    }
    group.add(cityGroup)

    // Animated arcs between random city pairs
    const arcs = []
    function makeArc(a, b) {
      const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(1.6)
      const curve = new THREE.QuadraticBezierCurve3(
        a.clone().multiplyScalar(1.04),
        mid,
        b.clone().multiplyScalar(1.04)
      )
      const points = curve.getPoints(28)
      const geo = new THREE.BufferGeometry().setFromPoints(points)
      const mat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8 })
      const line = new THREE.Line(geo, mat)
      group.add(line)
      return { line, mat, life: 0, maxLife: 2 + Math.random() * 2 }
    }

    let arcTimer = 0

    let raf
    const clock = new THREE.Clock()
    const animate = () => {
      const t = clock.getElapsedTime()
      const dt = clock.getDelta()

      group.rotation.y = t * 0.15
      group.rotation.x = Math.sin(t * 0.1) * 0.15

      arcTimer += dt
      if (arcTimer > 1.2 && arcs.length < 3) {
        const a = cities[Math.floor(Math.random() * cities.length)]
        let b = cities[Math.floor(Math.random() * cities.length)]
        while (b === a) b = cities[Math.floor(Math.random() * cities.length)]
        arcs.push(makeArc(a, b))
        arcTimer = 0
      }

      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i]
        a.life += dt
        const progress = a.life / a.maxLife
        a.mat.opacity = Math.max(0, 0.9 * (1 - progress))
        if (a.life >= a.maxLife) {
          group.remove(a.line)
          a.line.geometry.dispose()
          a.mat.dispose()
          arcs.splice(i, 1)
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
      ro.disconnect()
      try {
        renderer.forceContextLoss()
      } catch {}
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className="w-full h-full min-h-[180px]" />
}
