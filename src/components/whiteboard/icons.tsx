'use client'

import { useEffect, useRef } from 'react'
import { drawShape3D } from '@/lib/whiteboard/render'
import { drawTemplate } from '@/lib/whiteboard/render'
import type { Shape3D, TemplateKind } from '@/lib/whiteboard/types'

/** Габариты фигур внутри иконки 24×24, подобраны так, чтобы тело целиком влезало */
const SHAPE_ICON_BOX: Record<Shape3D, [number, number, number, number]> = {
  cube: [4, 8, 14, 14],
  cuboid: [3, 9, 16, 11],
  pyramid: [2, 6, 14, 14],
  prism: [2, 8, 14, 12],
  cylinder: [4, 3, 15, 18],
  cone: [4, 3, 15, 18],
  sphere: [3, 3, 18, 18],
}

const TEMPLATE_ICON_BOX: Record<TemplateKind, [number, number, number, number]> = {
  coords: [2, 2, 20, 20],
  numberline: [1, 8, 22, 8],
  table: [2, 4, 20, 16],
}

interface CanvasIconProps {
  size?: number
  color?: string
  className?: string
}

function useCanvasIcon(
  draw: (ctx: CanvasRenderingContext2D) => void,
  size: number,
  deps: unknown[],
) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const s = 2
    c.width = size * s
    c.height = size * s
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(s, 0, 0, s, 0, 0)
    ctx.clearRect(0, 0, size, size)
    draw(ctx)
  }, [size, ...deps])
  return ref
}

export function Shape3DIcon({ shape, size = 24, color = '#343a40', className }: CanvasIconProps & { shape: Shape3D }) {
  const ref = useCanvasIcon(
    (ctx) => {
      const [x, y, w, h] = SHAPE_ICON_BOX[shape]
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      drawShape3D(ctx, shape, x, y, w, h)
    },
    size,
    [shape, color],
  )
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" className={className} />
}

export function TemplateIcon({ template, size = 24, color = '#343a40', className }: CanvasIconProps & { template: TemplateKind }) {
  const ref = useCanvasIcon(
    (ctx) => {
      const [x, y, w, h] = TEMPLATE_ICON_BOX[template]
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = 1.4
      ctx.lineCap = 'round'
      drawTemplate(ctx, template, x, y, w, h, color, 1.4, true)
    },
    size,
    [template, color],
  )
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" className={className} />
}
