import type { BgMode, Camera, Element, LineType, Shape3D, TemplateKind } from './types'
import { normRect } from './types'

export const GRID_SIZE = 28
export const GRID_COLOR = '#dcdcdc'

export const BG_COLORS: Record<BgMode, string> = {
  white: '#ffffff',
  black: '#101010',
}

const SELECT_COLOR = '#1971c2'

/* ---------- камера ---------- */

/** Устанавливает трансформацию мира: экранные = мировые * zoom + камера */
export function applyCamera(ctx: CanvasRenderingContext2D, cam: Camera, dpr: number) {
  ctx.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * cam.x, dpr * cam.y)
}

/** Фон: заливка в экранных координатах, сетка — только на белом, привязана к миру.
 *  После вызова контекст остаётся в трансформации камеры (мировые координаты). */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  mode: BgMode,
  w: number,
  h: number,
  cam: Camera,
  dpr: number,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = BG_COLORS[mode]
  ctx.fillRect(0, 0, w, h)
  applyCamera(ctx, cam, dpr)
  if (mode === 'white') {
    // сетка «как в тетради» — всегда на белом поле, шаг фиксирован в мировых координатах
    const pxStep = GRID_SIZE * cam.zoom
    if (pxStep >= 6) {
      const x0 = Math.floor(-cam.x / cam.zoom / GRID_SIZE) * GRID_SIZE
      const y0 = Math.floor(-cam.y / cam.zoom / GRID_SIZE) * GRID_SIZE
      const x1 = (w - cam.x) / cam.zoom
      const y1 = (h - cam.y) / cam.zoom
      ctx.save()
      ctx.strokeStyle = GRID_COLOR
      ctx.lineWidth = 1 / cam.zoom
      ctx.beginPath()
      for (let gx = x0; gx <= x1; gx += GRID_SIZE) {
        ctx.moveTo(gx, y0)
        ctx.lineTo(gx, y1)
      }
      for (let gy = y0; gy <= y1; gy += GRID_SIZE) {
        ctx.moveTo(x0, gy)
        ctx.lineTo(x1, gy)
      }
      ctx.stroke()
      ctx.restore()
    }
  }
}

/* ---------- вспомогательные примитивы ---------- */

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function arrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, sw: number) {
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const ah = 9 + sw * 1.8
  const a = Math.PI / 7
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - ah * Math.cos(ang - a), y2 - ah * Math.sin(ang - a))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - ah * Math.cos(ang + a), y2 - ah * Math.sin(ang + a))
  ctx.stroke()
}

/** Обычное (сглаженное) перо */
function strokePen(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  if (pts.length === 1) {
    ctx.beginPath()
    ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2
    const my = (pts[i].y + pts[i + 1].y) / 2
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
}

/* ---------- типы линии: сплошная / пунктир / волнистая ---------- */

function applyLineType(ctx: CanvasRenderingContext2D, lt: LineType, lw: number) {
  if (lt === 'dashed') ctx.setLineDash([lw * 3, lw * 2.4])
  else ctx.setLineDash([])
}

/**
 * Волновая деформация полилинии: смещение по нормали по синусу.
 * Для замкнутых контуров подбираем целое число волн — шва нет.
 * Концы открытых линий «затухают», чтобы линия точно попадала в точки.
 */
export function wavePolyline(pts: { x: number; y: number }[], closed: boolean, lw: number): { x: number; y: number }[] {
  const n = pts.length
  if (n < 2) return pts
  const segs: { ax: number; ay: number; dx: number; dy: number; len: number }[] = []
  let total = 0
  const count = closed ? n : n - 1
  for (let i = 0; i < count; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len > 1e-9) {
      segs.push({ ax: a.x, ay: a.y, dx, dy, len })
      total += len
    }
  }
  if (segs.length === 0 || total < lw * 2) return pts

  const amp = lw * 1.1
  let wl = Math.max(lw * 4.5, 2)
  if (closed) {
    const k = Math.max(1, Math.round(total / wl))
    wl = total / k
  }
  const step = Math.max(wl / 10, 0.8)
  const taper = Math.min(wl * 0.75, total / 3)

  const out: { x: number; y: number }[] = []
  let idx = 0
  let acc = 0 // накопленная длина до начала сегмента idx
  for (let d = 0; d <= total + 1e-6; d += step) {
    const dd = Math.min(d, total)
    while (idx < segs.length - 1 && dd - acc > segs[idx].len) {
      acc += segs[idx].len
      idx++
    }
    const s = segs[idx]
    const t = Math.min(1, (dd - acc) / s.len)
    const inv = 1 / s.len
    const tx = s.dx * inv
    const ty = s.dy * inv
    let a = amp * Math.sin((dd / wl) * Math.PI * 2)
    if (!closed) a *= Math.max(0, Math.min(1, dd / taper, (total - dd) / taper))
    out.push({ x: s.ax + s.dx * t - ty * a, y: s.ay + s.dy * t + tx * a })
  }
  if (!closed) {
    // точный конечный пункт (амплитуда там 0)
    const s = segs[segs.length - 1]
    out.push({ x: s.ax + s.dx, y: s.ay + s.dy })
  }
  return out
}

function strokePolyline(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
}

/* ---------- 3D-тела: сплошные видимые линии + пунктирные невидимые ---------- */

function solid(ctx: CanvasRenderingContext2D) {
  ctx.setLineDash([])
}

function hidden(ctx: CanvasRenderingContext2D, zoom: number) {
  ctx.setLineDash([7 / zoom, 5 / zoom])
}

/** Размер подписи вершин пропорционален телу, с разумными границами */
function labelFontSize(size: number): number {
  return Math.min(Math.max(size * 0.14, 12), 34)
}

/** Подпись вершины «как в учебнике»: курсивная буква, при sub — нижний индекс (A₁) */
function vertexLabel(
  ctx: CanvasRenderingContext2D,
  letter: string,
  sub: string | null,
  px: number,
  py: number,
  fs: number,
  align: CanvasTextAlign,
) {
  ctx.save()
  ctx.setLineDash([])
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.font = `italic ${fs}px Georgia, 'Times New Roman', serif`
  ctx.fillText(letter, px, py)
  if (sub) {
    const w = ctx.measureText(letter).width
    const anchor = align === 'center' ? px + w / 2 : align === 'right' ? px : px + w
    ctx.font = `italic ${fs * 0.72}px Georgia, 'Times New Roman', serif`
    ctx.fillText(sub, anchor + fs * 0.05, py + fs * 0.36)
  }
  ctx.restore()
}

export function drawShape3D(
  ctx: CanvasRenderingContext2D,
  shape: Shape3D,
  x0: number,
  y0: number,
  w0: number,
  h0: number,
  zoom = 1,
) {
  // нормализация к положительным размерам
  let x = x0
  let y = y0
  let w = w0
  let h = h0
  if (w < 0) {
    x += w
    w = -w
  }
  if (h < 0) {
    y += h
    h = -h
  }
  w = Math.max(w, 1)
  h = Math.max(h, 1)
  const d = Math.min(w, h) * 0.45
  const dx = d
  const dy = -d // глубина «вверх-вправо», как в школьных чертежах

  switch (shape) {
    case 'cube':
    case 'cuboid': {
      const s = shape === 'cube' ? Math.min(w, h) : w
      const sh = shape === 'cube' ? Math.min(w, h) : h
      const x2 = x + s
      const y2 = y + sh
      // видимые: передняя грань + рёбра глубины + верхнее/правое задние рёбра
      solid(ctx)
      ctx.strokeRect(x, y, s, sh)
      line(ctx, x, y, x + dx, y + dy) // верх-лево → назад
      line(ctx, x2, y, x2 + dx, y + dy) // верх-право → назад
      line(ctx, x2, y2, x2 + dx, y2 + dy) // низ-право → назад
      line(ctx, x + dx, y + dy, x2 + dx, y + dy) // заднее верхнее
      line(ctx, x2 + dx, y + dy, x2 + dx, y2 + dy) // заднее правое вертикальное
      // невидимые: три ребра сходятся в дальнюю нижне-левую вершину
      hidden(ctx, zoom)
      line(ctx, x, y2, x + dx, y2 + dy)
      line(ctx, x + dx, y2 + dy, x2 + dx, y2 + dy)
      line(ctx, x + dx, y2 + dy, x + dx, y + dy)
      // подписи вершин «как в учебнике»: ABCD внизу, A₁B₁C₁D₁ вверху
      solid(ctx)
      const fs = labelFontSize(Math.min(s, sh))
      const m = fs * 0.55
      vertexLabel(ctx, 'A', null, x - m * 0.8, y2 + m * 0.8, fs, 'right')
      vertexLabel(ctx, 'B', null, x + dx - m, y2 + dy - m * 0.3, fs, 'right')
      vertexLabel(ctx, 'C', null, x2 + dx + m, y2 + dy, fs, 'left')
      vertexLabel(ctx, 'D', null, x2 + m * 0.8, y2 + m * 0.8, fs, 'left')
      vertexLabel(ctx, 'A', '1', x - m, y + m * 0.5, fs, 'right')
      vertexLabel(ctx, 'B', '1', x + dx, y + dy - m * 1.2, fs, 'center')
      vertexLabel(ctx, 'C', '1', x2 + dx + m, y + dy - m * 0.4, fs, 'left')
      vertexLabel(ctx, 'D', '1', x2 - m * 0.6, y - m * 0.9, fs, 'center')
      break
    }
    case 'pyramid': {
      const x2 = x + w
      const y2 = y + h
      const bl = { x, y: y2 }
      const br = { x: x2, y: y2 }
      const brp = { x: x2 + dx, y: y2 + dy }
      const blp = { x: x + dx, y: y2 + dy }
      const apex = { x: x + (w + d) / 2, y }
      solid(ctx)
      line(ctx, bl.x, bl.y, br.x, br.y)
      line(ctx, br.x, br.y, brp.x, brp.y)
      line(ctx, apex.x, apex.y, bl.x, bl.y)
      line(ctx, apex.x, apex.y, br.x, br.y)
      line(ctx, apex.x, apex.y, brp.x, brp.y)
      hidden(ctx, zoom)
      line(ctx, bl.x, bl.y, blp.x, blp.y)
      line(ctx, blp.x, blp.y, brp.x, brp.y)
      line(ctx, blp.x, blp.y, apex.x, apex.y)
      // подписи вершин: основание ABCD и вершина S
      solid(ctx)
      const fs = labelFontSize(Math.min(w, h))
      const m = fs * 0.55
      vertexLabel(ctx, 'A', null, bl.x - m * 0.8, bl.y + m * 0.8, fs, 'right')
      vertexLabel(ctx, 'B', null, br.x + m * 0.8, br.y + m * 0.8, fs, 'left')
      vertexLabel(ctx, 'C', null, brp.x + m, brp.y, fs, 'left')
      vertexLabel(ctx, 'D', null, blp.x - m, blp.y - m * 0.4, fs, 'right')
      vertexLabel(ctx, 'S', null, apex.x, apex.y - m * 1.4, fs, 'center')
      break
    }
    case 'prism': {
      const x2 = x + w
      const y2 = y + h
      const bl = { x, y: y2 }
      const br = { x: x2, y: y2 }
      const top = { x: x + w / 2, y }
      const off = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy })
      const blp = off(bl)
      const brp = off(br)
      const topp = off(top)
      solid(ctx)
      line(ctx, bl.x, bl.y, br.x, br.y)
      line(ctx, br.x, br.y, top.x, top.y)
      line(ctx, top.x, top.y, bl.x, bl.y)
      line(ctx, br.x, br.y, brp.x, brp.y)
      line(ctx, top.x, top.y, topp.x, topp.y)
      line(ctx, brp.x, brp.y, topp.x, topp.y)
      hidden(ctx, zoom)
      line(ctx, bl.x, bl.y, blp.x, blp.y)
      line(ctx, blp.x, blp.y, brp.x, brp.y)
      line(ctx, blp.x, blp.y, topp.x, topp.y)
      // подписи вершин: основания ABC и A₁B₁C₁
      solid(ctx)
      const fs = labelFontSize(Math.min(w, h))
      const m = fs * 0.55
      vertexLabel(ctx, 'A', null, bl.x - m * 0.8, bl.y + m * 0.8, fs, 'right')
      vertexLabel(ctx, 'B', null, br.x + m * 0.8, br.y + m * 0.8, fs, 'left')
      vertexLabel(ctx, 'C', null, top.x, top.y - m * 1.3, fs, 'center')
      vertexLabel(ctx, 'A', '1', blp.x - m, blp.y - m * 0.4, fs, 'right')
      vertexLabel(ctx, 'B', '1', brp.x + m, brp.y, fs, 'left')
      vertexLabel(ctx, 'C', '1', topp.x + m, topp.y - m * 0.4, fs, 'left')
      break
    }
    case 'cylinder': {
      const cx = x + w / 2
      const rx = w / 2
      const ry = Math.min(rx * 0.3, Math.max(h * 0.18, 4))
      const topCy = y + ry
      const botCy = y + h - ry
      solid(ctx)
      ctx.beginPath()
      ctx.ellipse(cx, topCy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
      line(ctx, cx - rx, topCy, cx - rx, botCy)
      line(ctx, cx + rx, topCy, cx + rx, botCy)
      ctx.beginPath()
      ctx.ellipse(cx, botCy, rx, ry, 0, 0, Math.PI) // передняя (нижняя) половина
      ctx.stroke()
      hidden(ctx, zoom)
      ctx.beginPath()
      ctx.ellipse(cx, botCy, rx, ry, 0, Math.PI, Math.PI * 2) // задняя половина
      ctx.stroke()
      break
    }
    case 'cone': {
      const cx = x + w / 2
      const rx = w / 2
      const ry = Math.min(rx * 0.3, Math.max(h * 0.18, 4))
      const botCy = y + h - ry
      solid(ctx)
      line(ctx, cx, y, cx - rx, botCy)
      line(ctx, cx, y, cx + rx, botCy)
      ctx.beginPath()
      ctx.ellipse(cx, botCy, rx, ry, 0, 0, Math.PI)
      ctx.stroke()
      hidden(ctx, zoom)
      ctx.beginPath()
      ctx.ellipse(cx, botCy, rx, ry, 0, Math.PI, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'sphere': {
      const r = Math.min(w, h) / 2
      const cx = x + w / 2
      const cy = y + h / 2
      solid(ctx)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
      hidden(ctx, zoom)
      ctx.beginPath()
      ctx.ellipse(cx, cy, r, r * 0.32, 0, 0, Math.PI * 2) // экватор
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(cx, cy, r * 0.32, r, 0, 0, Math.PI * 2) // меридиан
      ctx.stroke()
      break
    }
  }
  solid(ctx)
}

/* ---------- шаблоны для уроков ---------- */

function templateFont(unit: number): string {
  const size = Math.round(Math.min(Math.max(unit * 0.45, 9), 13))
  return `${size}px sans-serif`
}

/** Координатная плоскость: оси со стрелками и засечками, БЕЗ числовых значений */
export function drawTemplate(
  ctx: CanvasRenderingContext2D,
  kind: TemplateKind,
  x0: number,
  y0: number,
  w0: number,
  h0: number,
  color: string,
  sw: number,
  mini = false,
) {
  let x = x0
  let y = y0
  let w = w0
  let h = h0
  if (w < 0) {
    x += w
    w = -w
  }
  if (h < 0) {
    y += h
    h = -h
  }
  w = Math.max(w, 2)
  h = Math.max(h, 2)
  ctx.save()
  ctx.setLineDash([])
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = sw
  ctx.lineCap = 'round'

  if (kind === 'coords') {
    const cx = x + w / 2
    const cy = y + h / 2
    const unit = Math.min(w, h) / 20
    const m = mini ? 3 : 8
    // оси со стрелками
    line(ctx, x + m, cy, x + w - m, cy)
    arrowHead(ctx, x + w - m - 0.1, cy, x + w - m, cy, mini ? 1 : Math.min(sw, 2.5))
    line(ctx, cx, y + h - m, cx, y + m)
    arrowHead(ctx, cx, y + m + 0.1, cx, y + m, mini ? 1 : Math.min(sw, 2.5))
    // засечки без подписей значений
    const tick = mini ? 2 : 3.5
    for (let n = -10; n <= 10; n++) {
      if (n === 0) continue
      const px = cx + n * unit
      if (px >= x + m + 2 && px <= x + w - m - 2) line(ctx, px, cy - tick, px, cy + tick)
      const py = cy - n * unit
      if (py >= y + m + 2 && py <= y + h - m - 2) line(ctx, cx - tick, py, cx + tick, py)
    }
  }

  if (kind === 'numberline') {
    const cy = y + h * 0.42
    const m = mini ? 4 : 12
    line(ctx, x + m, cy, x + w - m, cy)
    arrowHead(ctx, x + w - m - 0.1, cy, x + w - m, cy, mini ? 1 : Math.min(sw, 2.5))
    if (mini) {
      for (let i = 0; i <= 10; i++) {
        const px = x + m + ((w - 2 * m) * i) / 10
        line(ctx, px, cy - 3, px, cy + 3)
      }
    } else {
      const unit = (w - 2 * m) / 20
      ctx.font = templateFont(unit)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (let n = -10; n <= 10; n++) {
        const px = x + m + (n + 10) * unit
        line(ctx, px, cy - 4, px, cy + 4)
        ctx.fillText(String(n), px, cy + 8)
      }
    }
  }

  if (kind === 'table') {
    // легаси: раньше был в меню
    const cols = 4
    const rows = 4
    ctx.strokeRect(x, y, w, h)
    for (let i = 1; i < cols; i++) line(ctx, x + (w * i) / cols, y, x + (w * i) / cols, y + h)
    for (let j = 1; j < rows; j++) line(ctx, x, y + (h * j) / rows, x + w, y + (h * j) / rows)
  }
  ctx.restore()
}

/* ---------- диспетчер отрисовки элементов ---------- */

/** zoom нужен, чтобы толщина линии оставалась постоянной НА ЭКРАНЕ при любом зуме */
export function drawElement(ctx: CanvasRenderingContext2D, el: Element, zoom = 1) {
  ctx.save()
  ctx.strokeStyle = el.color
  ctx.fillStyle = el.color
  const lw = el.strokeWidth / zoom
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash([])
  const lt: LineType = el.lineType ?? 'solid'

  switch (el.kind) {
    case 'pen': {
      if (lt === 'wavy') {
        const waved = wavePolyline(el.points, false, lw)
        if (waved.length === 1) {
          ctx.beginPath()
          ctx.arc(waved[0].x, waved[0].y, lw / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          strokePolyline(ctx, waved)
        }
      } else {
        applyLineType(ctx, lt, lw)
        strokePen(ctx, el.points)
      }
      break
    }
    case 'line': {
      const a = { x: el.x1, y: el.y1 }
      const b = { x: el.x2, y: el.y2 }
      if (lt === 'wavy') {
        ctx.setLineDash([])
        strokePolyline(ctx, wavePolyline([a, b], false, lw))
      } else {
        applyLineType(ctx, lt, lw)
        line(ctx, a.x, a.y, b.x, b.y)
      }
      break
    }
    case 'arrow': {
      const a = { x: el.x1, y: el.y1 }
      const b = { x: el.x2, y: el.y2 }
      if (lt === 'wavy') {
        ctx.setLineDash([])
        strokePolyline(ctx, wavePolyline([a, b], false, lw))
      } else {
        applyLineType(ctx, lt, lw)
        line(ctx, a.x, a.y, b.x, b.y)
      }
      arrowHead(ctx, a.x, a.y, b.x, b.y, el.strokeWidth)
      break
    }
    case 'rect': {
      const b = normRect(el.x, el.y, el.w, el.h)
      if (b.w < 1 && b.h < 1) {
        ctx.beginPath()
        ctx.arc(el.x, el.y, lw / 2, 0, Math.PI * 2)
        ctx.fill()
      } else if (lt === 'wavy') {
        ctx.setLineDash([])
        const pts = [
          { x: b.x, y: b.y },
          { x: b.x + b.w, y: b.y },
          { x: b.x + b.w, y: b.y + b.h },
          { x: b.x, y: b.y + b.h },
        ]
        strokePolyline(ctx, wavePolyline(pts, true, lw))
      } else {
        applyLineType(ctx, lt, lw)
        ctx.strokeRect(b.x, b.y, b.w, b.h)
      }
      break
    }
    case 'ellipse': {
      const b = normRect(el.x, el.y, el.w, el.h)
      const rx = Math.max(b.w / 2, 0.5)
      const ry = Math.max(b.h / 2, 0.5)
      const cx = b.x + rx
      const cy = b.y + ry
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      if (lt === 'wavy') {
        ctx.setLineDash([])
        const pts: { x: number; y: number }[] = []
        const N = 64
        for (let i = 0; i < N; i++) {
          const t = (i / N) * Math.PI * 2
          pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) })
        }
        strokePolyline(ctx, wavePolyline(pts, true, lw))
      } else {
        applyLineType(ctx, lt, lw)
        ctx.stroke()
      }
      break
    }
    case 'triangle': {
      const b = normRect(el.x, el.y, el.w, el.h)
      const pts = [
        { x: b.x + b.w / 2, y: b.y },
        { x: b.x + b.w, y: b.y + b.h },
        { x: b.x, y: b.y + b.h },
      ]
      if (lt === 'wavy') {
        ctx.setLineDash([])
        strokePolyline(ctx, wavePolyline(pts, true, lw))
      } else {
        applyLineType(ctx, lt, lw)
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        ctx.lineTo(pts[1].x, pts[1].y)
        ctx.lineTo(pts[2].x, pts[2].y)
        ctx.closePath()
        ctx.stroke()
      }
      break
    }
    case 'shape3d':
      drawShape3D(ctx, el.shape, el.x, el.y, el.w, el.h, zoom)
      break
    case 'template':
      drawTemplate(
        ctx,
        el.template,
        el.x,
        el.y,
        el.w,
        el.h,
        el.color,
        Math.min(el.strokeWidth, 2.5) / zoom,
      )
      break
  }
  ctx.restore()
}

/* ---------- оверлеи выделения и лассо (в мировых координатах) ---------- */

function dashedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, zoom: number) {
  ctx.save()
  ctx.strokeStyle = SELECT_COLOR
  ctx.lineWidth = 1.5 / zoom
  ctx.setLineDash([5 / zoom, 4 / zoom])
  ctx.strokeRect(x, y, w, h)
  ctx.restore()
}

/* оверлеи выделения и лассо рисуются в Whiteboard — здесь утилита рамки */
export function strokeSelectionBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  zoom: number,
) {
  dashedRect(ctx, x, y, w, h, zoom)
}
