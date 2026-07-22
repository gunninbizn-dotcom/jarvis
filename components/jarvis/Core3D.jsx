'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function Core3D({ speaking = false }) {
  const mountRef = useRef(null)
  const speakingRef = useRef(speaking)

  useEffect(() => { speakingRef.current = speaking }, [speaking])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth
    const height = mount.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 0, 6)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)

    // Lights
    scene.add(new THREE.AmbientLight(0x22d3ee, 0.5))
    const l1 = new THREE.PointLight(0x22d3ee, 2, 20); l1.position.set(5, 5, 5); scene.add(l1)
    const l2 = new THREE.PointLight(0x0ea5e9, 1.5, 20); l2.position.set(-5, -5, -5); scene.add(l2)
    const l3 = new THREE.PointLight(0x67e8f9, 1, 20); l3.position.set(0, 0, 3); scene.add(l3)

    // Group holding everything
    const group = new THREE.Group()
    scene.add(group)

    // Outer distortable sphere (using icosahedron high subdivision)
    const outerGeo = new THREE.IcosahedronGeometry(1.4, 24)
    // Save original positions for distortion effect
    const basePositions = outerGeo.attributes.position.array.slice()
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.7,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85,
    })
    const outerMesh = new THREE.Mesh(outerGeo, outerMat)
    group.add(outerMesh)

    // Inner glowing wireframe icosahedron
    const innerGeo = new THREE.IcosahedronGeometry(0.7, 1)
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, wireframe: true })
    const innerMesh = new THREE.Mesh(innerGeo, innerMat)
    group.add(innerMesh)

    // Outer wireframe shell
    const shellGeo = new THREE.IcosahedronGeometry(1.9, 2)
    const shellMat = new THREE.MeshBasicMaterial({ color: 0x0891b2, wireframe: true, transparent: true, opacity: 0.28 })
    const shellMesh = new THREE.Mesh(shellGeo, shellMat)
    group.add(shellMesh)

    // Orbital rings
    function makeRing(r, color, opacity, rot) {
      const g = new THREE.RingGeometry(r, r + 0.02, 128)
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(g, m)
      mesh.rotation.set(...rot)
      return mesh
    }
    const ring1 = makeRing(2.3, 0x22d3ee, 0.6, [Math.PI / 2, 0, 0])
    const ring2 = makeRing(2.6, 0x0ea5e9, 0.45, [Math.PI / 2.4, Math.PI / 3, 0])
    const ring3 = makeRing(2.9, 0x06b6d4, 0.3, [Math.PI / 3, Math.PI / 6, 0])
    group.add(ring1); group.add(ring2); group.add(ring3)

    // Orbiting particles
    const particleCount = 50
    const particleGeo = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const particleData = []
    for (let i = 0; i < particleCount; i++) {
      particleData.push({
        radius: 2 + Math.random() * 1.6,
        speed: 0.3 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        yTilt: (Math.random() - 0.5) * 1.4,
      })
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particleMat = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.08,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    const particles = new THREE.Points(particleGeo, particleMat)
    scene.add(particles)

    // Starfield background
    const starGeo = new THREE.BufferGeometry()
    const starCount = 1200
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const r = 20 + Math.random() * 25
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      starPos[i * 3 + 2] = r * Math.cos(phi)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    const starMat = new THREE.PointsMaterial({ color: 0xa5f3fc, size: 0.05, transparent: true, opacity: 0.65 })
    const starField = new THREE.Points(starGeo, starMat)
    scene.add(starField)

    // Animation loop
    let raf
    const clock = new THREE.Clock()
    const animate = () => {
      const t = clock.getElapsedTime()
      const spk = speakingRef.current

      // Group rotation
      outerMesh.rotation.x = t * 0.15
      outerMesh.rotation.y = t * 0.2
      innerMesh.rotation.x = -t * 0.4
      innerMesh.rotation.y = -t * 0.3
      shellMesh.rotation.y = t * 0.08
      shellMesh.rotation.x = t * 0.05

      // Inner mesh pulse
      const s = 1 + Math.sin(t * 3) * 0.06 + (spk ? Math.sin(t * 18) * 0.1 : 0)
      innerMesh.scale.set(s, s, s)

      // Distort outer sphere
      const pos = outerGeo.attributes.position.array
      const distortion = spk ? 0.28 : 0.12
      const speed = spk ? 4 : 1.6
      for (let i = 0; i < pos.length; i += 3) {
        const bx = basePositions[i], by = basePositions[i + 1], bz = basePositions[i + 2]
        const n = Math.sin(bx * 2 + t * speed) * Math.cos(by * 2 + t * speed) * Math.sin(bz * 2 + t * speed)
        const factor = 1 + n * distortion
        pos[i] = bx * factor
        pos[i + 1] = by * factor
        pos[i + 2] = bz * factor
      }
      outerGeo.attributes.position.needsUpdate = true
      outerGeo.computeVertexNormals()

      // Orbiting particles
      const pArr = particleGeo.attributes.position.array
      for (let i = 0; i < particleCount; i++) {
        const p = particleData[i]
        const angle = t * p.speed + p.phase
        pArr[i * 3] = Math.cos(angle) * p.radius
        pArr[i * 3 + 2] = Math.sin(angle) * p.radius
        pArr[i * 3 + 1] = Math.sin(angle * 0.5) * p.yTilt
      }
      particleGeo.attributes.position.needsUpdate = true

      // Ring counter-rotation
      ring1.rotation.z = t * 0.4
      ring2.rotation.z = -t * 0.3
      ring3.rotation.z = t * 0.2

      // Star slow rotate
      starField.rotation.y = t * 0.02

      renderer.render(scene, camera)
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
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.dispose()
      outerGeo.dispose(); outerMat.dispose()
      innerGeo.dispose(); innerMat.dispose()
      shellGeo.dispose(); shellMat.dispose()
      particleGeo.dispose(); particleMat.dispose()
      starGeo.dispose(); starMat.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className="w-full h-full" />
}
