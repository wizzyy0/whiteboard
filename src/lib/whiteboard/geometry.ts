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

/* ---------- лассо ---------- */

/** Лучевой тест точки на попадание в многоугольник */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Характерные точки элемента для проверки попадания в лассо */
export function elementSamples(el: Element): Point[] {
  switch (el.kind) {
    case 'pen': {
      const pts = el.points
      if (pts.length <= 12) return pts
      const out: Point[] = []
      const step = (pts.length - 1) / 11
      for (let i = 0; i < 12; i++) out.push(pts[Math.round(i * step)])
      out.push(pts[pts.length - 1])
      return out
    }
    case 'line':
    case 'arrow':
      return [
        { x: el.x1, y: el.y1 },
        { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 },
        { x: el.x2, y: el.y2 },
      ]
    case 'ellipse': {
      const b = normRect(el.x, el.y, el.w, el.h)
      const cx = b.x + b.w / 2
      const cy = b.y + b.h / 2
      return [
        { x: cx, y: b.y },
        { x: cx, y: b.y + b.h },
        { x: b.x, y: cy },
        { x: b.x + b.w, y: cy },
        { x: cx, y: cy },
      ]
    }
    case 'triangle': {
      const b = normRect(el.x, el.y, el.w, el.h)
      return [
        { x: b.x + b.w / 2, y: b.y },
        { x: b.x + b.w, y: b.y + b.h },
        { x: b.x, y: b.y + b.h },
        { x: b.x + b.w / 2, y: b.y + b.h / 2 },
      ]
    }
    default: {
      const b = bboxOf(el)
      return [
        { x: b.x, y: b.y },
        { x: b.x + b.w, y: b.y },
        { x: b.x, y: b.y + b.h },
        { x: b.x + b.w, y: b.y + b.h },
        { x: b.x + b.w / 2, y: b.y + b.h / 2 },
      ]
    }
  }
}

/** Лассо: элементы, у которых хотя бы одна характерная точка внутри обводки */
export function lassoSelect(elements: Element[], poly: Point[]): string[] {
  if (poly.length < 3) return []
  return elements.filter((el) => elementSamples(el).some((pt) => pointInPolygon(pt, poly))).map((el) => el.id)
}

/** Смещение элемента на (dx, dy) — для перетаскивания лассо */
export function translateElement(el: Element, dx: number, dy: number): Element {
  switch (el.kind) {
    case 'pen':
      return { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
    case 'line':
    case 'arrow':
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy }
    default:
      return { ...el, x: el.x + dx, y: el.y + dy }
  }
}

/** Общий bbox набора элементов (для рамки выделения и старта перетаскивания) */
export function unionBbox(elements: Element[]): { x: number; y: number; w: number; h: number } | null {
  if (elements.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const el of elements) {
    const b = bboxOf(el)
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function pointInRect(p: Point, r: { x: number; y: number; w: number; h: number }, pad = 0): boolean {
  return p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad
}
