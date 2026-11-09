import type { Element, Point } from './types'
import { normRect } from './types'

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export function bboxOf(el: Element): { x: number; y: number; w: number; h: number } {
  switch (el.kind) {
    case 'pen': {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of el.points) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    }
    case 'line':
    case 'arrow':
      return normRect(Math.min(el.x1, el.x2), Math.min(el.y1, el.y2), Math.abs(el.x2 - el.x1), Math.abs(el.y2 - el.y1))
    default:
      return normRect(el.x, el.y, el.w, el.h)
  }
}

/** Проверка попадания курсора в элемент (для ластика) */
export function hitTest(el: Element, p: Point, tol = 10): boolean {
  switch (el.kind) {
    case 'pen': {
      const t = tol + el.strokeWidth / 2
      if (el.points.length === 1) return Math.hypot(p.x - el.points[0].x, p.y - el.points[0].y) <= t
      for (let i = 0; i < el.points.length - 1; i++) {
        if (distToSegment(p, el.points[i], el.points[i + 1]) <= t) return true
      }
      return false
    }
    case 'line':
    case 'arrow':
      return distToSegment(p, { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }) <= tol + el.strokeWidth / 2
    default: {
      const b = bboxOf(el)
      const pad = 6
      return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad
    }
  }
}
