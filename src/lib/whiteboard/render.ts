import type { BgMode, Element, Shape3D, TemplateKind } from './types'

export const GRID_SIZE = 28
export const GRID_COLOR = '#dcdcdc'

export const BG_COLORS: Record<BgMode, string> = {
  white: '#ffffff',
  grid: '#ffffff',
  black: '#101010',
}

const DASH: number[] = [7, 5]

export function drawBackground(ctx: CanvasRenderingContext2D, mode: BgMode, w: number, h: number) {
  ctx.fillStyle = BG_COLORS[mode]
  ctx.fillRect(0, 0, w, h)
  if (mode === 'grid') {
    ctx.save()
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let gx = 0.5; gx <= w; gx += GRID_SIZE) {
      ctx.moveTo(gx, 0)
      ctx.lineTo(gx, h)
    }
    for (let gy = 0.5; gy <= h; gy += GRID_SIZE) {
      ctx.moveTo(0, gy)
      ctx.lineTo(w, gy)
    }
    ctx.stroke()
    ctx.restore()
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
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - ah * Math.cos(ang - a), y2 - ah * Math.sin(ang - a))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - ah * Math.cos(ang + a), y2 - ah * Math.sin(ang + a))
  ctx.stroke()
}

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

/* ---------- 3D-тела: сплошные видимые линии + пунктирные невидимые ---------- */

function solid(ctx: CanvasRenderingContext2D) {
  ctx.setLineDash([])
}

function hidden(ctx: CanvasRenderingContext2D) {
  ctx.setLineDash(DASH)
}

export function drawShape3D(
  ctx: CanvasRenderingContext2D,
  shape: Shape3D,
  x0: number,
  y0: number,
  w0: number,
  h0: number,
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
      hidden(ctx)
      line(ctx, x, y2, x + dx, y2 + dy)
      line(ctx, x + dx, y2 + dy, x2 + dx, y2 + dy)
      line(ctx, x + dx, y2 + dy, x + dx, y + dy)
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
      hidden(ctx)
      line(ctx, bl.x, bl.y, blp.x, blp.y)
      line(ctx, blp.x, blp.y, brp.x, brp.y)
      line(ctx, blp.x, blp.y, apex.x, apex.y)
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
      hidden(ctx)
      line(ctx, bl.x, bl.y, blp.x, blp.y)
      line(ctx, blp.x, blp.y, brp.x, brp.y)
      line(ctx, blp.x, blp.y, topp.x, topp.y)
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
      hidden(ctx)
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
      hidden(ctx)
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
      hidden(ctx)
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
    if (!mini) {
      ctx.font = templateFont(unit)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const step = unit >= 20 ? 1 : 2
      for (let n = -10; n <= 10; n++) {
        if (n === 0) continue
        const px = cx + n * unit
        if (px < x + m + 2 || px > x + w - m - 2) continue
        line(ctx, px, cy - 3, px, cy + 3)
        ctx.fillText(String(n), px, cy + 7)
      }
      for (let n = -10; n <= 10; n++) {
        if (n === 0) continue
        const py = cy - n * unit
        if (py < y + m + 2 || py > y + h - m - 2) continue
        line(ctx, cx - 3, py, cx + 3, py)
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(n), cx - 7, py)
      }
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText('0', cx - 6, cy + 6)
      ctx.textAlign = 'right'
      ctx.fillText('x', x + w - 4, cy + 8)
      ctx.textAlign = 'left'
      ctx.fillText('y', cx + 8, y + 4)
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
    const cols = 4
    const rows = 4
    ctx.strokeRect(x, y, w, h)
    for (let i = 1; i < cols; i++) line(ctx, x + (w * i) / cols, y, x + (w * i) / cols, y + h)
    for (let j = 1; j < rows; j++) line(ctx, x, y + (h * j) / rows, x + w, y + (h * j) / rows)
  }
  ctx.restore()
}

/* ---------- диспетчер отрисовки элементов ---------- */

export function drawElement(ctx: CanvasRenderingContext2D, el: Element) {
  ctx.save()
  ctx.strokeStyle = el.color
  ctx.fillStyle = el.color
  ctx.lineWidth = el.strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash([])

  switch (el.kind) {
    case 'pen':
      strokePen(ctx, el.points)
      break
    case 'line':
      line(ctx, el.x1, el.y1, el.x2, el.y2)
      break
    case 'arrow':
      line(ctx, el.x1, el.y1, el.x2, el.y2)
      arrowHead(ctx, el.x1, el.y1, el.x2, el.y2, el.strokeWidth)
      break
    case 'rect': {
      const b = norm(el.x, el.y, el.w, el.h)
      if (b.w < 1 && b.h < 1) {
        ctx.beginPath()
        ctx.arc(el.x, el.y, ctx.lineWidth / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.strokeRect(b.x, b.y, b.w, b.h)
      }
      break
    }
    case 'ellipse': {
      const b = norm(el.x, el.y, el.w, el.h)
      ctx.beginPath()
      ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w / 2, 0.5), Math.max(b.h / 2, 0.5), 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'triangle': {
      const b = norm(el.x, el.y, el.w, el.h)
      ctx.beginPath()
      ctx.moveTo(b.x + b.w / 2, b.y)
      ctx.lineTo(b.x + b.w, b.y + b.h)
      ctx.lineTo(b.x, b.y + b.h)
      ctx.closePath()
      ctx.stroke()
      break
    }
    case 'shape3d':
      drawShape3D(ctx, el.shape, el.x, el.y, el.w, el.h)
      break
    case 'template':
      drawTemplate(ctx, el.template, el.x, el.y, el.w, el.h, el.color, Math.min(el.strokeWidth, 2.5))
      break
  }
  ctx.restore()
}

function norm(x: number, y: number, w: number, h: number) {
  return {
    x: w >= 0 ? x : x + w,
    y: h >= 0 ? y : y + h,
    w: Math.abs(w),
    h: Math.abs(h),
  }
}
