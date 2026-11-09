export type BgMode = 'white' | 'black'

/** Тела, которые рисуются «как в учебнике геометрии»: видимые линии сплошные, невидимые — пунктиром */
export type Shape3D = 'cube' | 'cuboid' | 'pyramid' | 'prism' | 'cylinder' | 'cone' | 'sphere'

export type TemplateKind = 'coords' | 'numberline' | 'table' // table — легаси, больше не в меню

export type LineType = 'solid' | 'dashed' | 'wavy'

export type ToolKind =
  | 'pen'
  | 'eraser'
  | 'lasso'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'shape3d'
  | 'template'

export interface Point {
  x: number
  y: number
}

export interface Camera {
  x: number
  y: number
  zoom: number
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 9

export const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 }

interface BaseElement {
  id: string
  color: string
  strokeWidth: number
  lineType?: LineType
}

export type Element = BaseElement &
  (
    | { kind: 'pen'; points: Point[] }
    | { kind: 'line' | 'arrow'; x1: number; y1: number; x2: number; y2: number }
    | { kind: 'rect' | 'ellipse' | 'triangle'; x: number; y: number; w: number; h: number }
    | { kind: 'shape3d'; shape: Shape3D; x: number; y: number; w: number; h: number }
    | { kind: 'template'; template: TemplateKind; x: number; y: number; w: number; h: number }
  )

export interface PageState {
  elements: Element[]
  past: Element[][]
  future: Element[][]
  camera: Camera
}

export interface WhiteboardSnapshot {
  pages: PageState[]
  pageIndex: number
  bg: BgMode
  colors: string[]
  colorIdx: number
  strokeWidth: number
  lineType: LineType
}

export const SHAPE3D_LABELS: Record<Shape3D, string> = {
  cube: 'Куб',
  cuboid: 'Параллелепипед',
  pyramid: 'Пирамида',
  prism: 'Призма',
  cylinder: 'Цилиндр',
  cone: 'Конус',
  sphere: 'Шар',
}

export const SHAPE3D_ORDER: Shape3D[] = ['cube', 'cuboid', 'pyramid', 'prism', 'cylinder', 'cone', 'sphere']

export const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  coords: 'Координатная плоскость',
  numberline: 'Числовая ось',
  table: 'Таблица 4×4',
}

/** Только актуальные шаблоны для меню (таблица 4×4 убрана) */
export const TEMPLATE_ORDER: TemplateKind[] = ['coords', 'numberline']

export const TEMPLATE_SIZES: Record<TemplateKind, { w: number; h: number }> = {
  coords: { w: 440, h: 440 },
  numberline: { w: 560, h: 96 },
  table: { w: 420, h: 300 },
}

export const LINE_TYPE_LABELS: Record<LineType, string> = {
  solid: 'Сплошная',
  dashed: 'Пунктир',
  wavy: 'Волнистая',
}

export const LINE_TYPE_ORDER: LineType[] = ['solid', 'dashed', 'wavy']

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function normRect(x: number, y: number, w: number, h: number) {
  return {
    x: w >= 0 ? x : x + w,
    y: h >= 0 ? y : y + h,
    w: Math.abs(w),
    h: Math.abs(h),
  }
}

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

export function emptyPage(): PageState {
  return { elements: [], past: [], future: [], camera: { ...DEFAULT_CAMERA } }
}

function isFiniteBox(o: unknown): o is { x: number; y: number; w: number; h: number } {
  const b = o as { x: number; y: number; w: number; h: number }
  return (
    typeof b === 'object' &&
    b !== null &&
    [b.x, b.y, b.w, b.h].every((v) => typeof v === 'number' && Number.isFinite(v))
  )
}

/** Извлекает проверенный bbox из сырых данных */
function boxOf(el: Record<string, unknown>): { x: number; y: number; w: number; h: number } | null {
  if (!isFiniteBox(el)) return null
  return { x: el.x, y: el.y, w: el.w, h: el.h }
}

function sanitizeLineType(v: unknown): LineType {
  return v === 'dashed' || v === 'wavy' || v === 'solid' ? v : 'solid'
}

function sanitizeCamera(v: unknown): Camera {
  const c = (v ?? {}) as Partial<Camera>
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
  return { x: num(c.x), y: num(c.y), zoom: clampZoom(num(c.zoom) || 1) }
}

/** Строгая проверка элемента при загрузке из localStorage */
function sanitizeElement(raw: unknown): Element | null {
  if (typeof raw !== 'object' || raw === null) return null
  const el = raw as Record<string, unknown>
  if (typeof el.id !== 'string' || typeof el.color !== 'string') return null
  const sw = typeof el.strokeWidth === 'number' && el.strokeWidth > 0 ? el.strokeWidth : 2
  const base = { id: el.id, color: el.color, strokeWidth: sw, lineType: sanitizeLineType(el.lineType) }
  switch (el.kind) {
    case 'pen': {
      const pts = Array.isArray(el.points)
        ? (el.points as unknown[]).filter(
            (p): p is Point =>
              typeof p === 'object' &&
              p !== null &&
              typeof (p as Point).x === 'number' &&
              typeof (p as Point).y === 'number',
          )
        : []
      if (pts.length === 0) return null
      return { ...base, kind: 'pen', points: pts }
    }
    case 'line':
    case 'arrow': {
      if (![el.x1, el.y1, el.x2, el.y2].every((v) => typeof v === 'number')) return null
      return {
        ...base,
        kind: el.kind,
        x1: el.x1 as number,
        y1: el.y1 as number,
        x2: el.x2 as number,
        y2: el.y2 as number,
      }
    }
    case 'rect':
    case 'ellipse':
    case 'triangle': {
      const b = boxOf(el)
      if (!b) return null
      return { ...base, kind: el.kind, ...b }
    }
    case 'shape3d': {
      const b = boxOf(el)
      if (!b || typeof el.shape !== 'string' || !(el.shape in SHAPE3D_LABELS)) return null
      return { ...base, kind: 'shape3d', shape: el.shape as Shape3D, ...b }
    }
    case 'template': {
      const b = boxOf(el)
      if (!b || typeof el.template !== 'string' || !(el.template in TEMPLATE_LABELS)) return null
      return { ...base, kind: 'template', template: el.template as TemplateKind, ...b }
    }
    default:
      return null
  }
}

/** Восстановление состояния из localStorage с защитой от битых данных.
 *  Старый фон «grid» превращается в «white» (сетка теперь всегда на белом). */
export function sanitizeSnapshot(raw: unknown): WhiteboardSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null
  const d = raw as Partial<WhiteboardSnapshot>
  if (!Array.isArray(d.pages) || d.pages.length === 0) return null

  const pages: PageState[] = d.pages.slice(0, 50).map((p) => {
    const page = (p ?? {}) as Partial<PageState>
    return {
      elements: Array.isArray(page.elements)
        ? (page.elements as unknown[]).map(sanitizeElement).filter((e): e is Element => e !== null)
        : [],
      past: [],
      future: [],
      camera: sanitizeCamera(page.camera),
    }
  })

  const bg: BgMode = d.bg === 'black' ? 'black' : 'white'
  const colors = Array.isArray(d.colors)
    ? (d.colors as unknown[]).filter((c): c is string => typeof c === 'string').slice(0, 3)
    : []
  while (colors.length < 3) colors.push(['#1f1f1f', '#e03131', '#2b8a3e'][colors.length])

  const colorIdx = typeof d.colorIdx === 'number' ? Math.min(Math.max(d.colorIdx, 0), 2) : 0
  const strokeWidth =
    typeof d.strokeWidth === 'number' && d.strokeWidth >= 1 && d.strokeWidth <= 16 ? d.strokeWidth : 3
  const lineType = sanitizeLineType(d.lineType)
  const pageIndex = typeof d.pageIndex === 'number' ? Math.min(Math.max(d.pageIndex, 0), pages.length - 1) : 0

  return { pages, pageIndex, bg, colors, colorIdx, strokeWidth, lineType }
}
