'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { applyCamera, drawBackground, drawElement, strokeSelectionBox } from '@/lib/whiteboard/render'
import { hitTest, lassoSelect, pointInRect, translateElement, unionBbox } from '@/lib/whiteboard/geometry'
import { luminance } from '@/lib/whiteboard/color'
import {
  clampZoom,
  emptyPage,
  normRect,
  uid,
  TEMPLATE_SIZES,
  type BgMode,
  type Camera,
  type Element,
  type LineType,
  type PageState,
  type Point,
  type Shape3D,
  type TemplateKind,
  type ToolKind,
} from '@/lib/whiteboard/types'
import { SideActions, ToolsBar } from './Toolbar'
import { ColorPanel } from './ColorPanel'
import { Pager } from './Pager'

const STORAGE_KEY = 'whiteboard-state-v2'
const LEGACY_KEY = 'whiteboard-state-v1'
const DEFAULT_COLORS = ['#1f1f1f', '#e03131', '#2b8a3e']
const SELECT_COLOR = '#1971c2'
/** После вставки этих инструментов сразу возвращаемся к кисти */
const AUTO_PEN_TOOLS: ToolKind[] = ['rect', 'ellipse', 'triangle', 'shape3d', 'template']

function isEmptyDrawing(el: Element, zoom: number): boolean {
  switch (el.kind) {
    case 'pen':
      return el.points.length === 0
    case 'line':
    case 'arrow':
      return Math.hypot(el.x2 - el.x1, el.y2 - el.y1) < 3 / zoom
    default: {
      const b = normRect(el.x, el.y, el.w, el.h)
      return b.w < 4 / zoom && b.h < 4 / zoom
    }
  }
}

export default function Whiteboard() {
  const [pages, setPages] = useState<PageState[]>([emptyPage()])
  const [pageIndex, setPageIndex] = useState(0)
  const [bg, setBg] = useState<BgMode>('white')
  const [tool, setTool] = useState<ToolKind>('pen')
  const [shape3d, setShape3d] = useState<Shape3D>('cube')
  const [template, setTemplate] = useState<TemplateKind>('coords')
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS)
  const [colorIdx, setColorIdx] = useState(0)
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [lineType, setLineType] = useState<LineType>('solid')
  const [draft, setDraft] = useState<Element | null>(null)
  const [lasso, setLasso] = useState<Point[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [panning, setPanning] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draftRef = useRef<Element | null>(null)
  const drawRef = useRef<{ start: Point; page: number } | null>(null)
  const eraseRef = useRef<{ last: Point; page: number; snapshot: boolean; removed: Set<string> } | null>(null)
  const panRef = useRef<{ startScreen: Point } | null>(null)
  const moveRef = useRef<{ ids: Set<string>; startWorld: Point; page: number; original: Element[]; dx: number; dy: number } | null>(null)
  const spaceRef = useRef(false)
  const pointersRef = useRef<Map<number, Point>>(new Map())
  const pinchRef = useRef<{ dist: number; center: Point; cam: Camera } | null>(null)

  const safeIndex = Math.min(pageIndex, pages.length - 1)
  const page = pages[safeIndex] ?? emptyPage()
  const cam = page.camera
  const activeColor = colors[colorIdx] ?? DEFAULT_COLORS[0]

  const camRef = useRef(cam)
  const safeIndexRef = useRef(safeIndex)
  const sizeRef = useRef(size)
  // актуальные значения для обработчиков-«слушателей» (wheel/keydown)
  useEffect(() => {
    camRef.current = cam
    safeIndexRef.current = safeIndex
    sizeRef.current = size
  })

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectionBox = useMemo(() => {
    const sel = page.elements.filter((el) => selectedSet.has(el.id))
    return unionBbox(sel)
  }, [page.elements, selectedSet])

  /* ---------- очистка при перезаходе ---------- */

  // Каждое открытие сайта начинается с чистой доски: прошлое состояние не
  // восстанавливается и сразу удаляется из хранилища браузера
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(LEGACY_KEY)
    } catch {
      /* приватный режим — просто начинаем с чистой доски */
    }
  }, [])

  /* ---------- размер канваса ---------- */

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize({ w: Math.round(r.width), h: Math.round(r.height) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ---------- отрисовка ---------- */

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.w || !size.h) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pw = Math.round(size.w * dpr)
    const ph = Math.round(size.h * dpr)
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawBackground(ctx, bg, size.w, size.h, cam, dpr) // далее — мировые координаты
    for (const el of page.elements) drawElement(ctx, el, cam.zoom)
    if (draft) drawElement(ctx, draft, cam.zoom)

    if (selectionBox) {
      const pad = 6 / cam.zoom
      strokeSelectionBox(
        ctx,
        selectionBox.x - pad,
        selectionBox.y - pad,
        selectionBox.w + pad * 2,
        selectionBox.h + pad * 2,
        cam.zoom,
      )
    }
    if (lasso && lasso.length > 1) {
      ctx.save()
      ctx.strokeStyle = SELECT_COLOR
      ctx.lineWidth = 1.5 / cam.zoom
      ctx.setLineDash([5 / cam.zoom, 4 / cam.zoom])
      ctx.beginPath()
      ctx.moveTo(lasso[0].x, lasso[0].y)
      for (let i = 1; i < lasso.length; i++) ctx.lineTo(lasso[i].x, lasso[i].y)
      ctx.stroke()
      ctx.restore()
    }
  }, [size, bg, page, cam, draft, lasso, selectionBox])

  /* ---------- страницы ---------- */

  const updatePage = useCallback((idx: number, updater: (p: PageState) => PageState) => {
    setPages((prev) => prev.map((p, i) => (i === idx ? updater(p) : p)))
  }, [])

  const setCamera = useCallback(
    (idx: number, next: Camera) => {
      updatePage(idx, (p) => ({ ...p, camera: next }))
    },
    [updatePage],
  )

  /** Зум вокруг экранной точки: точка мира под курсором остаётся на месте */
  const zoomAt = useCallback(
    (idx: number, screen: Point, factor: number) => {
      const c = camRef.current
      const zoom = clampZoom(c.zoom * factor)
      if (Math.abs(zoom - c.zoom) < 1e-9) return
      const wx = (screen.x - c.x) / c.zoom
      const wy = (screen.y - c.y) / c.zoom
      setCamera(idx, { zoom, x: screen.x - wx * zoom, y: screen.y - wy * zoom })
    },
    [setCamera],
  )

  const viewCenter = useCallback((): Point => ({ x: sizeRef.current.w / 2, y: sizeRef.current.h / 2 }), [])

  const zoomIn = useCallback(() => zoomAt(safeIndexRef.current, viewCenter(), 1.25), [zoomAt, viewCenter])
  const zoomOut = useCallback(() => zoomAt(safeIndexRef.current, viewCenter(), 0.8), [zoomAt, viewCenter])

  const zoomReset = useCallback(() => {
    const c = camRef.current
    const center = viewCenter()
    const wx = (center.x - c.x) / c.zoom
    const wy = (center.y - c.y) / c.zoom
    setCamera(safeIndexRef.current, { zoom: 1, x: center.x - wx, y: center.y - wy })
  }, [setCamera, viewCenter])

  const pushElements = useCallback(
    (idx: number, elements: Element[]) => {
      updatePage(idx, (p) => ({
        ...p,
        elements,
        past: [...p.past, p.elements].slice(-60),
        future: [],
      }))
    },
    [updatePage],
  )

  const undo = useCallback(() => {
    updatePage(safeIndexRef.current, (p) => {
      if (p.past.length === 0) return p
      return {
        ...p,
        elements: p.past[p.past.length - 1],
        past: p.past.slice(0, -1),
        future: [...p.future, p.elements],
      }
    })
  }, [updatePage])

  const redo = useCallback(() => {
    updatePage(safeIndexRef.current, (p) => {
      if (p.future.length === 0) return p
      return {
        ...p,
        elements: p.future[p.future.length - 1],
        past: [...p.past, p.elements],
        future: p.future.slice(0, -1),
      }
    })
  }, [updatePage])

  const clearPage = useCallback(() => {
    const idx = safeIndexRef.current
    updatePage(idx, (p) => {
      if (p.elements.length === 0) return p
      return { ...p, elements: [], past: [...p.past, p.elements].slice(-60), future: [] }
    })
    setSelectedIds([])
  }, [updatePage])

  const addPage = useCallback(() => {
    setPages((prev) => [...prev, emptyPage()])
    setPageIndex((i) => i + 1)
  }, [])

  const deletePage = useCallback(() => {
    setPages((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== safeIndexRef.current)
    })
    setPageIndex((i) => Math.max(0, Math.min(i, pages.length - 2)))
  }, [pages.length])

  const gotoPage = useCallback(
    (delta: number) => {
      setPageIndex((i) => Math.max(0, Math.min(pages.length - 1, i + delta)))
    },
    [pages.length],
  )

  /* ---------- фон: белый ↔ чёрный одной кнопкой, авто-контраст ---------- */

  const contrastColor = (hex: string, mode: BgMode): string => {
    const lum = luminance(hex)
    if (mode === 'black' && lum < 0.3) return '#f1f3f5'
    if (mode !== 'black' && lum > 0.85) return '#1f1f1f'
    return hex
  }

  const changeBg = useCallback(
    (mode: BgMode) => {
      if (mode === bg) return
      setBg(mode)
      setColors((prev) => prev.map((c) => contrastColor(c, mode)))
      // Перекрашиваем уже нарисованные элементы на всех холстах, чтобы они не потерялись
      setPages((prev) =>
        prev.map((p) => ({
          ...p,
          elements: p.elements.map((el) => ({ ...el, color: contrastColor(el.color, mode) })),
        })),
      )
    },
    [bg],
  )

  const toggleBg = useCallback(() => {
    changeBg(bg === 'black' ? 'white' : 'black')
  }, [bg, changeBg])

  /* ---------- рисование ---------- */

  const setDraftBoth = useCallback((el: Element | null) => {
    draftRef.current = el
    setDraft(el)
  }, [])

  const getPos = (e: React.PointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const screenToWorld = (p: Point, c: Camera): Point => ({ x: (p.x - c.x) / c.zoom, y: (p.y - c.y) / c.zoom })

  const makeDraft = (p: Point): Element => {
    const base = { id: 'draft', color: activeColor, strokeWidth, lineType }
    switch (tool) {
      case 'pen':
        return { ...base, kind: 'pen', points: [p] }
      case 'line':
      case 'arrow':
        return { ...base, kind: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y }
      case 'rect':
      case 'ellipse':
      case 'triangle':
        return { ...base, kind: tool, x: p.x, y: p.y, w: 0, h: 0 }
      case 'shape3d':
        return { ...base, kind: 'shape3d', shape: shape3d, x: p.x, y: p.y, w: 0, h: 0 }
      default:
        return { ...base, kind: 'pen', points: [p] }
    }
  }

  const eraseAt = useCallback(
    (p: Point) => {
      const er = eraseRef.current
      if (!er) return
      const tol = Math.max(10, strokeWidth) / camRef.current.zoom
      setPages((prev) => {
        const pg = prev[er.page] ?? emptyPage()
        let removed = false
        const next = pg.elements.filter((el) => {
          if (er.removed.has(el.id)) return false
          if (hitTest(el, p, tol)) {
            er.removed.add(el.id)
            removed = true
            return false
          }
          return true
        })
        if (!removed) return prev
        const past = er.snapshot ? pg.past : [...pg.past, pg.elements].slice(-60)
        er.snapshot = true
        return prev.map((q, i) => (i === er.page ? { ...q, elements: next, past, future: [] } : q))
      })
    },
    [strokeWidth],
  )

  const eraseAlong = useCallback(
    (from: Point, to: Point) => {
      const step = 8 / camRef.current.zoom
      const dist = Math.hypot(to.x - from.x, to.y - from.y)
      const steps = Math.max(1, Math.ceil(dist / step))
      for (let i = 1; i <= steps; i++) {
        eraseAt({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps })
      }
    },
    [eraseAt],
  )

  /** Шаблон вставляется в точку клика, без привязки к экрану — поле безграничное */
  const insertTemplate = useCallback(
    (p: Point) => {
      const s = TEMPLATE_SIZES[template]
      const el: Element = {
        id: uid(),
        kind: 'template',
        template,
        x: p.x - s.w / 2,
        y: p.y - s.h / 2,
        w: s.w,
        h: s.h,
        color: activeColor,
        strokeWidth: Math.max(2, strokeWidth),
      }
      pushElements(safeIndexRef.current, [...(pages[safeIndexRef.current]?.elements ?? []), el])
      setTool('pen') // после вставки шаблона сразу кисть
    },
    [template, activeColor, strokeWidth, pushElements, pages],
  )

  const commitDraft = useCallback(
    (pageIdx: number): boolean => {
      const raw = draftRef.current
      if (!raw || isEmptyDrawing(raw, camRef.current.zoom)) return false
      const el: Element = { ...raw, id: uid() }
      pushElements(pageIdx, [...(pages[pageIdx]?.elements ?? []), el])
      return true
    },
    [pages, pushElements],
  )

  const cancelActiveOps = useCallback(() => {
    drawRef.current = null
    eraseRef.current = null
    moveRef.current = null
    panRef.current = null
    setDraftBoth(null)
    setLasso(null)
    setPanning(false)
  }, [setDraftBoth])

  const deleteSelection = useCallback(() => {
    const ids = selectedIds
    if (ids.length === 0) return
    const set = new Set(ids)
    const idx = safeIndexRef.current
    updatePage(idx, (p) => ({
      ...p,
      elements: p.elements.filter((el) => !set.has(el.id)),
      past: [...p.past, p.elements].slice(-60),
      future: [],
    }))
    setSelectedIds([])
  }, [selectedIds, updatePage])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pScreen = getPos(e)
    pointersRef.current.set(e.pointerId, pScreen)

    // два пальца — щипок (зум + панорама), отменяем текущую операцию
    if (e.pointerType !== 'mouse' && pointersRef.current.size === 2) {
      cancelActiveOps()
      const pts = [...pointersRef.current.values()]
      pinchRef.current = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        center: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        cam: camRef.current,
      }
      return
    }
    if (pinchRef.current) return

    // панорама поля: пробел или средняя кнопка мыши
    if ((e.pointerType === 'mouse' && e.button === 1) || spaceRef.current) {
      e.preventDefault()
      panRef.current = { startScreen: pScreen }
      setPanning(true)
      canvasRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return
    canvasRef.current?.setPointerCapture(e.pointerId)

    const p = screenToWorld(pScreen, camRef.current)

    if (tool === 'lasso') {
      // клик внутри рамки выделения — начинаем перетаскивание
      if (selectionBox && pointInRect(p, selectionBox, 8 / cam.zoom)) {
        moveRef.current = {
          ids: new Set(selectedIds),
          startWorld: p,
          page: safeIndex,
          original: page.elements,
          dx: 0,
          dy: 0,
        }
      } else {
        setLasso([p])
      }
      return
    }

    if (tool === 'eraser') {
      eraseRef.current = { last: p, page: safeIndex, snapshot: false, removed: new Set() }
      eraseAt(p)
      return
    }
    if (tool === 'template') {
      insertTemplate(p)
      return
    }
    drawRef.current = { start: p, page: safeIndex }
    setDraftBoth(makeDraft(p))
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, getPos(e))

    // щипок двумя пальцами
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const pts = [...pointersRef.current.values()]
      const pr = pinchRef.current
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      if (pr.dist > 1) {
        const zoom = clampZoom(pr.cam.zoom * (dist / pr.dist))
        const wx = (pr.center.x - pr.cam.x) / pr.cam.zoom
        const wy = (pr.center.y - pr.cam.y) / pr.cam.zoom
        setCamera(safeIndexRef.current, { zoom, x: center.x - wx * zoom, y: center.y - wy * zoom })
      }
      return
    }

    // панорама
    if (panRef.current) {
      const d = getPos(e)
      const c = camRef.current
      const s = panRef.current.startScreen
      setCamera(safeIndexRef.current, { ...c, x: c.x + d.x - s.x, y: c.y + d.y - s.y })
      panRef.current.startScreen = d
      return
    }

    const p = screenToWorld(getPos(e), camRef.current)

    if (eraseRef.current) {
      eraseAlong(eraseRef.current.last, p)
      eraseRef.current.last = p
      return
    }

    // лассо
    if (lasso) {
      const last = lasso[lasso.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) > 3 / cam.zoom) setLasso([...lasso, p])
      return
    }

    // перетаскивание выделения
    if (moveRef.current) {
      const mv = moveRef.current
      mv.dx = p.x - mv.startWorld.x
      mv.dy = p.y - mv.startWorld.y
      const moved = mv.original.map((el) => (mv.ids.has(el.id) ? translateElement(el, mv.dx, mv.dy) : el))
      updatePage(mv.page, (pp) => ({ ...pp, elements: moved }))
      return
    }

    const dr = drawRef.current
    const cur = draftRef.current
    if (!cur) return
    switch (cur.kind) {
      case 'pen': {
        const lastPt = cur.points[cur.points.length - 1]
        if (Math.hypot(p.x - lastPt.x, p.y - lastPt.y) < 2 / cam.zoom) return
        setDraftBoth({ ...cur, points: [...cur.points, p] })
        break
      }
      case 'line':
      case 'arrow':
        setDraftBoth({ ...cur, x2: p.x, y2: p.y })
        break
      default:
        setDraftBoth({ ...cur, w: p.x - dr!.start.x, h: p.y - dr!.start.y })
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId)
    if (pinchRef.current && pointersRef.current.size < 2) pinchRef.current = null

    if (panRef.current) {
      panRef.current = null
      setPanning(false)
      return
    }

    // завершение лассо → выделение
    if (lasso) {
      const ids = lassoSelect(page.elements, lasso)
      setSelectedIds(ids)
      setLasso(null)
      return
    }

    // фиксация перетаскивания выделения в историю
    if (moveRef.current) {
      const mv = moveRef.current
      const moved = mv.original.map((el) => (mv.ids.has(el.id) ? translateElement(el, mv.dx, mv.dy) : el))
      updatePage(mv.page, (pp) => ({
        ...pp,
        elements: moved,
        past: [...pp.past, mv.original].slice(-60),
        future: [],
      }))
      moveRef.current = null
      return
    }

    if (eraseRef.current) {
      eraseRef.current = null
      return
    }
    if (!drawRef.current) return
    const pageIdx = drawRef.current.page
    drawRef.current = null
    const committed = commitDraft(pageIdx)
    setDraftBoth(null)
    // после вставки фигуры — сразу кисть
    if (committed && AUTO_PEN_TOOLS.includes(tool)) setTool('pen')
  }

  /* ---------- колесо: Ctrl+колесо — зум, просто колесо — прокрутка поля ---------- */

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0022)
        zoomAt(safeIndexRef.current, { x: sx, y: sy }, factor)
      } else {
        const c = camRef.current
        setCamera(safeIndexRef.current, { ...c, x: c.x - e.deltaX, y: c.y - e.deltaY })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt, setCamera])

  /* ---------- горячие клавиши ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (mod && e.key === '0') {
        e.preventDefault()
        zoomReset()
      } else if (e.key === ' ') {
        if (!spaceRef.current) {
          spaceRef.current = true
          setPanning(true)
          if (t && t.tagName === 'BUTTON') t.blur()
        }
        e.preventDefault()
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === 'Escape') {
        setSelectedIds([])
        setLasso(null)
        moveRef.current = null
        setDraftBoth(null)
        drawRef.current = null
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          deleteSelection()
        }
      } else if (!mod) {
        const map: Record<string, ToolKind> = {
          p: 'pen',
          e: 'eraser',
          s: 'lasso',
          l: 'line',
          a: 'arrow',
          r: 'rect',
          o: 'ellipse',
          t: 'triangle',
        }
        const tk = map[e.key.toLowerCase()]
        if (tk) setTool(tk)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        spaceRef.current = false
        setPanning(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [undo, redo, zoomReset, zoomIn, zoomOut, deleteSelection, selectedIds.length, setDraftBoth])

  /* ---------- экспорт PNG: текущий вид в 2× качестве ---------- */

  const exportPng = useCallback(() => {
    if (!size.w || !size.h) return
    const c = document.createElement('canvas')
    const scale = 2
    c.width = Math.round(size.w * scale)
    c.height = Math.round(size.h * scale)
    const ctx = c.getContext('2d')
    if (!ctx) return
    drawBackground(ctx, bg, size.w, size.h, cam, scale)
    applyCamera(ctx, cam, scale)
    for (const el of page.elements) drawElement(ctx, el, cam.zoom)
    const a = document.createElement('a')
    a.download = `whiteboard-${safeIndex + 1}.png`
    a.href = c.toDataURL('image/png')
    a.click()
  }, [size, bg, page.elements, cam, safeIndex])

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-background">
      <main className="absolute inset-0" aria-label="Белая доска для рисования">
        <div ref={containerRef} className="absolute inset-0">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            style={{ cursor: panning ? 'grabbing' : 'crosshair' }}
            aria-label="Холст для рисования"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onMouseDown={(e) => {
              if (e.button === 1) e.preventDefault()
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      </main>

      {/* Служебные кнопки и цвета — компактная колонка слева */}
      <div
        className="pointer-events-auto absolute left-3 top-3 z-20 flex max-h-[calc(100dvh-24px)] flex-col items-center gap-2 overflow-y-auto no-scrollbar"
      >
        <SideActions
          bg={bg}
          onBgToggle={toggleBg}
          canUndo={page.past.length > 0}
          canRedo={page.future.length > 0}
          onUndo={undo}
          onRedo={redo}
          onClear={clearPage}
          onExport={exportPng}
        />

        <ColorPanel
          colors={colors}
          colorIdx={colorIdx}
          onSelectColor={setColorIdx}
          onEditColor={(idx, hex) =>
            setColors((prev) => prev.map((c, i) => (i === idx ? hex : c)))
          }
          strokeWidth={strokeWidth}
          onStrokeWidthChange={setStrokeWidth}
          lineType={lineType}
          onLineTypeChange={setLineType}
        />
      </div>

      {/* Основные инструменты рисования — внизу по центру */}
      <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 max-w-[calc(100vw-24px)] -translate-x-1/2 overflow-x-auto no-scrollbar">
        <ToolsBar
          tool={tool}
          onToolChange={setTool}
          shape3d={shape3d}
          onShape3dChange={setShape3d}
          template={template}
          onTemplateChange={setTemplate}
        />
      </div>

      <Pager
        count={pages.length}
        index={safeIndex}
        onPrev={() => gotoPage(-1)}
        onNext={() => gotoPage(1)}
        onAdd={addPage}
        onDelete={deletePage}
        zoom={cam.zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
      />
    </div>
  )
}
