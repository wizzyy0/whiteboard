'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { drawBackground, drawElement } from '@/lib/whiteboard/render'
import { hitTest } from '@/lib/whiteboard/geometry'
import { luminance } from '@/lib/whiteboard/color'
import {
  emptyPage,
  normRect,
  sanitizeSnapshot,
  uid,
  TEMPLATE_SIZES,
  type BgMode,
  type Element,
  type PageState,
  type Point,
  type Shape3D,
  type TemplateKind,
  type ToolKind,
  type WhiteboardSnapshot,
} from '@/lib/whiteboard/types'
import { Toolbar } from './Toolbar'
import { ColorPanel } from './ColorPanel'
import { Pager } from './Pager'

const STORAGE_KEY = 'whiteboard-state-v1'
const DEFAULT_COLORS = ['#1f1f1f', '#e03131', '#2b8a3e']

function isEmptyDrawing(el: Element): boolean {
  if (el.kind === 'pen') return el.points.length === 0
  if (el.kind === 'line' || el.kind === 'arrow') return Math.hypot(el.x2 - el.x1, el.y2 - el.y1) < 3
  const b = normRect(el.x, el.y, el.w, el.h)
  return b.w < 4 && b.h < 4
}

export default function Whiteboard() {
  const [pages, setPages] = useState<PageState[]>([emptyPage()])
  const [pageIndex, setPageIndex] = useState(0)
  const [bg, setBg] = useState<BgMode>('grid')
  const [tool, setTool] = useState<ToolKind>('pen')
  const [shape3d, setShape3d] = useState<Shape3D>('cube')
  const [template, setTemplate] = useState<TemplateKind>('coords')
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS)
  const [colorIdx, setColorIdx] = useState(0)
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [draft, setDraft] = useState<Element | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [loaded, setLoaded] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draftRef = useRef<Element | null>(null)
  const drawRef = useRef<{ start: Point; page: number } | null>(null)
  const eraseRef = useRef<{ last: Point; page: number; snapshot: boolean; removed: Set<string> } | null>(null)

  const safeIndex = Math.min(pageIndex, pages.length - 1)
  const page = pages[safeIndex] ?? emptyPage()
  const activeColor = colors[colorIdx] ?? DEFAULT_COLORS[0]

  /* ---------- загрузка / сохранение ---------- */

  useEffect(() => {
    let cancelled = false
    // откладываем загрузку, чтобы не вызывать setState синхронно в эффекте
    const t = setTimeout(() => {
      if (cancelled) return
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const snap = sanitizeSnapshot(JSON.parse(raw))
          if (snap) {
            setPages(snap.pages)
            setPageIndex(snap.pageIndex)
            setBg(snap.bg)
            setColors(snap.colors)
            setColorIdx(snap.colorIdx)
            setStrokeWidth(snap.strokeWidth)
          }
        }
      } catch {
        /* повреждённые данные — начинаем с чистой доски */
      }
      setLoaded(true)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => {
      const snap: WhiteboardSnapshot = { pages, pageIndex: safeIndex, bg, colors, colorIdx, strokeWidth }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snap))
      } catch {
        /* переполнение хранилища игнорируем */
      }
    }, 300)
    return () => clearTimeout(t)
  }, [loaded, pages, safeIndex, bg, colors, colorIdx, strokeWidth])

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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawBackground(ctx, bg, size.w, size.h)
    for (const el of page.elements) drawElement(ctx, el)
    if (draft) drawElement(ctx, draft)
  }, [size, bg, page.elements, draft])

  /* ---------- изменение страниц ---------- */

  const updatePage = useCallback((idx: number, updater: (p: PageState) => PageState) => {
    setPages((prev) => prev.map((p, i) => (i === idx ? updater(p) : p)))
  }, [])

  const pushElements = useCallback(
    (idx: number, elements: Element[]) => {
      updatePage(idx, (p) => ({
        elements,
        past: [...p.past, p.elements].slice(-60),
        future: [],
      }))
    },
    [updatePage],
  )

  const undo = useCallback(() => {
    updatePage(safeIndex, (p) => {
      if (p.past.length === 0) return p
      return {
        elements: p.past[p.past.length - 1],
        past: p.past.slice(0, -1),
        future: [...p.future, p.elements],
      }
    })
  }, [updatePage, safeIndex])

  const redo = useCallback(() => {
    updatePage(safeIndex, (p) => {
      if (p.future.length === 0) return p
      return {
        elements: p.future[p.future.length - 1],
        past: [...p.past, p.elements],
        future: p.future.slice(0, -1),
      }
    })
  }, [updatePage, safeIndex])

  const clearPage = useCallback(() => {
    if (page.elements.length === 0) return
    pushElements(safeIndex, [])
  }, [page.elements.length, pushElements, safeIndex])

  const addPage = useCallback(() => {
    setPages((prev) => [...prev, emptyPage()])
    setPageIndex((i) => i + 1)
  }, [])

  const deletePage = useCallback(() => {
    setPages((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, i) => i !== safeIndex)
    })
    setPageIndex((i) => Math.max(0, Math.min(i, pages.length - 2)))
  }, [safeIndex, pages.length])

  const gotoPage = useCallback(
    (delta: number) => {
      setPageIndex((i) => Math.max(0, Math.min(pages.length - 1, i + delta)))
    },
    [pages.length],
  )

  /* ---------- фон с автоподбором контрастных цветов ---------- */

  /** Тёмные цвета на чёрном фоне и светлые на белом заменяем контрастными — иначе линии пропадают */
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

  /* ---------- рисование ---------- */

  const setDraftBoth = useCallback((el: Element | null) => {
    draftRef.current = el
    setDraft(el)
  }, [])

  const getPos = (e: React.PointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const makeDraft = (p: Point): Element => {
    const base = { id: 'draft', color: activeColor, strokeWidth }
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
      const tol = Math.max(10, strokeWidth)
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
        return prev.map((q, i) => (i === er.page ? { elements: next, past, future: [] } : q))
      })
    },
    [strokeWidth],
  )

  const eraseAlong = useCallback(
    (from: Point, to: Point) => {
      const dist = Math.hypot(to.x - from.x, to.y - from.y)
      const steps = Math.max(1, Math.ceil(dist / 8))
      for (let i = 1; i <= steps; i++) {
        eraseAt({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps })
      }
    },
    [eraseAt],
  )

  const insertTemplate = useCallback(
    (p: Point) => {
      const s = TEMPLATE_SIZES[template]
      const x = Math.max(8, Math.min(p.x - s.w / 2, Math.max(8, size.w - s.w - 8)))
      const y = Math.max(8, Math.min(p.y - s.h / 2, Math.max(8, size.h - s.h - 8)))
      const el: Element = {
        id: uid(),
        kind: 'template',
        template,
        x,
        y,
        w: s.w,
        h: s.h,
        color: activeColor,
        strokeWidth: Math.max(2, strokeWidth),
      }
      pushElements(safeIndex, [...page.elements, el])
    },
    [template, size, activeColor, strokeWidth, pushElements, safeIndex, page.elements],
  )

  const commitDraft = useCallback(
    (pageIdx: number) => {
      const raw = draftRef.current
      if (!raw || isEmptyDrawing(raw)) return
      const el: Element = { ...raw, id: uid() }
      pushElements(pageIdx, [...(pages[pageIdx]?.elements ?? []), el])
    },
    [pages, pushElements],
  )

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const p = getPos(e)
    canvasRef.current?.setPointerCapture(e.pointerId)

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
    if (!drawRef.current && !eraseRef.current) return
    const p = getPos(e)

    if (eraseRef.current) {
      eraseAlong(eraseRef.current.last, p)
      eraseRef.current.last = p
      return
    }

    const dr = drawRef.current!
    const cur = draftRef.current
    if (!cur) return
    if (cur.kind === 'pen') {
      const lastPt = cur.points[cur.points.length - 1]
      if (Math.hypot(p.x - lastPt.x, p.y - lastPt.y) < 2) return
      setDraftBoth({ ...cur, points: [...cur.points, p] })
    } else if (cur.kind === 'line' || cur.kind === 'arrow') {
      setDraftBoth({ ...cur, x2: p.x, y2: p.y })
    } else if (cur.kind === 'shape3d' || cur.kind === 'template') {
      setDraftBoth({ ...cur, w: p.x - dr.start.x, h: p.y - dr.start.y })
    } else {
      setDraftBoth({ ...cur, w: p.x - dr.start.x, h: p.y - dr.start.y })
    }
    void dr
  }

  const onPointerUp = () => {
    if (eraseRef.current) {
      eraseRef.current = null
      return
    }
    if (!drawRef.current) return
    const pageIdx = drawRef.current.page
    drawRef.current = null
    commitDraft(pageIdx)
    setDraftBoth(null)
  }

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
      } else if (!mod) {
        const map: Record<string, ToolKind> = {
          p: 'pen',
          e: 'eraser',
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
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  /* ---------- экспорт PNG ---------- */

  const exportPng = useCallback(() => {
    if (!size.w || !size.h) return
    const c = document.createElement('canvas')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.round(size.w * dpr)
    c.height = Math.round(size.h * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawBackground(ctx, bg, size.w, size.h)
    for (const el of page.elements) drawElement(ctx, el)
    const a = document.createElement('a')
    a.download = `whiteboard-${safeIndex + 1}.png`
    a.href = c.toDataURL('image/png')
    a.click()
  }, [size, bg, page.elements, safeIndex])

  const empty = page.elements.length === 0 && !draft

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-background">
      <main className="absolute inset-0" aria-label="Белая доска для рисования">
        <div ref={containerRef} className="absolute inset-0">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            style={{ cursor: 'crosshair' }}
            aria-label="Холст для рисования"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="max-w-md rounded-2xl px-6 py-3 text-center text-sm text-muted-foreground/70">
              Рисуйте мышью, пальцем или стилусом. Сверху — инструменты, слева — цвета, справа внизу — холсты.
            </p>
          </div>
        )}
      </main>

      <Toolbar
        tool={tool}
        onToolChange={setTool}
        shape3d={shape3d}
        onShape3dChange={setShape3d}
        template={template}
        onTemplateChange={setTemplate}
        bg={bg}
        onBgChange={changeBg}
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
      />

      <Pager
        count={pages.length}
        index={safeIndex}
        onPrev={() => gotoPage(-1)}
        onNext={() => gotoPage(1)}
        onAdd={addPage}
        onDelete={deletePage}
      />

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden select-none text-xs text-muted-foreground/60 sm:block">
        Ctrl+Z / Ctrl+Y — отмена и возврат · P E L A R O T — инструменты · двойной клик по цвету — редактирование
      </div>
    </div>
  )
}
