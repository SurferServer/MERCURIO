import React, { useEffect, useRef } from 'react'

export default function HalftoneBackground({ opacity = 0.4 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let offsetX = 0
    const spacing = 14

    // Seeded random for consistent dot sizes
    function seededRandom(seed) {
      let x = Math.sin(seed) * 43758.5453123
      return x - Math.floor(x)
    }

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#c4956a'
      const cols = Math.ceil(canvas.width / spacing) + 2
      const rows = Math.ceil(canvas.height / spacing) + 1
      const ox = offsetX % spacing

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * spacing - ox
          const y = r * spacing
          const seed = r * 1000 + c + Math.floor(offsetX / spacing)
          const radius = 0.6 + seededRandom(seed) * 2.0
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      offsetX += 0.12
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        opacity,
        pointerEvents: 'none',
      }}
    />
  )
}
