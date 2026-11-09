'use client'

import { useRef, useState } from 'react'
import { Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { hexToRgb, hexToHsv, isValidHex, rgbToHex, rgbToHsv, hsvToRgb, type Hsv, type Rgb } from '@/lib/whiteboard/color'
import { LINE_TYPE_LABELS, LINE_TYPE_ORDER, type LineType } from '@/lib/whiteboard/types'
import { LineTypeIcon } from './icons'

interface ColorPanelProps {
  colors: string[]
  colorIdx: number
  onSelectColor: (idx: number) => void
  onEditColor: (idx: number, hex: string) => void
  strokeWidth: number
  onStrokeWidthChange: (w: number) => void
  lineType: LineType
  onLineTypeChange: (lt: LineType) => void
}

/** Вертикальная радужная полоса оттенка (H) */
const HUE_GRADIENT =
  'linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'

export function ColorPanel({ colors, colorIdx, onSelectColor, onEditColor, strokeWidth, onStrokeWidthChange, lineType, onLineTypeChange }: ColorPanelProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [widthOpen, setWidthOpen] = useState(false)
  const [hsv, setHsv] = useState<Hsv>({ h: 0, s: 0, v: 0 })
  const [rgb, setRgb] = useState<Rgb>({ r: 0, g: 0, b: 0 })
  const [hexInput, setHexInput] = useState('#000000')
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<'sv' | 'hue' | null>(null)

  const activeColor = colors[colorIdx] ?? '#000000'

  // при открытии палитры — синхронизируем пикер с активным цветом
  const syncPalette = (open: boolean) => {
    setPaletteOpen(open)
    if (open) {
      const hex = colors[colorIdx] ?? '#000000'
      const c = hexToRgb(hex)
      setRgb(c)
      setHsv(hexToHsv(hex))
      setHexInput(rgbToHex(c))
    }
  }

  const applyHsv = (next: Hsv) => {
    setHsv(next)
    const rgbNext = hsvToRgb(next)
    setRgb(rgbNext)
    const hex = rgbToHex(rgbNext)
    setHexInput(hex)
    onEditColor(colorIdx, hex)
  }

  const applyRgb = (next: Rgb) => {
    setRgb(next)
    setHsv(rgbToHsv(next))
    const hex = rgbToHex(next)
    setHexInput(hex)
    onEditColor(colorIdx, hex)
  }

  const onHexChange = (v: string) => {
    setHexInput(v)
    if (isValidHex(v)) applyRgb(hexToRgb(v))
  }

  const trackMove = (e: React.PointerEvent, kind: 'sv' | 'hue') => {
    const el = kind === 'sv' ? svRef.current : hueRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (kind === 'sv') {
      const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
      const v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))
      applyHsv({ ...hsv, s, v })
    } else {
      const h = Math.min(359.9, Math.max(0, ((e.clientY - r.top) / r.height) * 360))
      applyHsv({ ...hsv, h })
    }
  }

  const onPickerPointerDown = (e: React.PointerEvent, kind: 'sv' | 'hue') => {
    e.preventDefault()
    dragRef.current = kind
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    trackMove(e, kind)
  }
  const onPickerPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) trackMove(e, dragRef.current)
  }
  const onPickerPointerUp = () => {
    dragRef.current = null
  }

  return (
    <div className="pointer-events-auto absolute z-20 flex gap-1 rounded-full border bg-background/95 p-1.5 shadow-md backdrop-blur
      left-1/2 top-[64px] -translate-x-1/2 flex-row items-center
      sm:left-3 sm:top-1/2 sm:bottom-auto sm:translate-x-0 sm:-translate-y-1/2 sm:flex-col"
      role="toolbar"
      aria-label="Цвета и толщина линии"
    >
      {/* 3 быстрых слота */}
      {colors.map((c, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Цвет ${i + 1}${i === colorIdx ? ' (активный)' : ''}`}
          title={`Цвет ${i + 1} — клик: выбрать, двойной клик: изменить`}
          onClick={() => onSelectColor(i)}
          onDoubleClick={() => {
            onSelectColor(i)
            setPaletteOpen(true)
          }}
          className={cn(
            'h-7 w-7 shrink-0 rounded-full border shadow-inner transition-transform',
            i === colorIdx ? 'border-foreground ring-2 ring-ring ring-offset-1 scale-105' : 'border-border',
          )}
          style={{ backgroundColor: c }}
        />
      ))}

      {/* Палитра: квадрат насыщенности + полоса оттенка */}
      <Popover open={paletteOpen} onOpenChange={syncPalette}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="RGB-палитра"
            title="RGB-палитра (редактирует активный цвет)"
            className="h-7 w-7 shrink-0 rounded-full"
          >
            <Palette className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4" side="right" align="center">
          <div className="mb-3 flex items-center gap-3">
            <div
              className="h-10 w-10 shrink-0 rounded-lg border shadow-inner"
              style={{ backgroundColor: rgbToHex(rgb) }}
              aria-hidden="true"
            />
            <div className="flex-1">
              <Label htmlFor="wb-hex" className="text-xs text-muted-foreground">HEX</Label>
              <Input
                id="wb-hex"
                value={hexInput}
                onChange={(e) => onHexChange(e.target.value)}
                className="mt-1 h-8 font-mono text-sm"
                spellCheck={false}
              />
            </div>
          </div>

          {/* квадрат насыщенности/яркости */}
          <div
            ref={svRef}
            className="relative h-40 w-full cursor-crosshair touch-none rounded-lg border"
            style={{
              background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
            }}
            role="application"
            aria-label="Насыщенность и яркость"
            onPointerDown={(e) => onPickerPointerDown(e, 'sv')}
            onPointerMove={onPickerPointerMove}
            onPointerUp={onPickerPointerUp}
            onPointerCancel={onPickerPointerUp}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>

          {/* полоса оттенка */}
          <div
            ref={hueRef}
            className="relative mt-3 h-4 w-full cursor-pointer touch-none rounded-full border"
            style={{ background: HUE_GRADIENT }}
            role="application"
            aria-label="Оттенок"
            onPointerDown={(e) => onPickerPointerDown(e, 'hue')}
            onPointerMove={onPickerPointerMove}
            onPointerUp={onPickerPointerUp}
            onPointerCancel={onPickerPointerUp}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
              style={{ left: `${(hsv.h / 360) * 100}%` }}
            />
          </div>

          <div className="mt-4">
            {(['r', 'g', 'b'] as const).map((ch) => (
              <div key={ch} className="mb-2 flex items-center gap-2 last:mb-0">
                <Label htmlFor={`wb-${ch}`} className="w-4 shrink-0 text-xs font-semibold uppercase">
                  {ch}
                </Label>
                <Slider
                  id={`wb-${ch}`}
                  min={0}
                  max={255}
                  step={1}
                  value={[rgb[ch]]}
                  onValueChange={([v]) => applyRgb({ ...rgb, [ch]: v })}
                  className="flex-1"
                />
                <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums">{rgb[ch]}</span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-6 shrink-0 sm:h-6 sm:w-px" />

      {/* Толщина + тип линии */}
      <Popover open={widthOpen} onOpenChange={setWidthOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Толщина линии: ${strokeWidth}`}
            title="Толщина и тип линии"
            className="h-7 w-7 shrink-0 rounded-full"
          >
            <span
              aria-hidden="true"
              className="block rounded-full"
              style={{
                backgroundColor: activeColor,
                width: Math.min(20, Math.max(6, strokeWidth + 3)),
                height: Math.min(20, Math.max(6, strokeWidth + 3)),
              }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-4" side="right" align="center">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Толщина линии</span>
            <span className="font-mono text-sm tabular-nums">{strokeWidth}</span>
          </div>
          <Slider
            min={1}
            max={14}
            step={1}
            value={[strokeWidth]}
            onValueChange={([v]) => onStrokeWidthChange(v)}
          />
          <div className="mt-4 flex h-10 items-center justify-center rounded-lg border bg-muted/40 px-3">
            <span
              className="block rounded-full"
              style={{ backgroundColor: activeColor, height: Math.min(28, strokeWidth + 2), width: '100%', maxWidth: 160 }}
            />
          </div>

          <div className="mt-4 mb-2 text-sm font-medium">Тип линии</div>
          <div className="grid grid-cols-3 gap-1">
            {LINE_TYPE_ORDER.map((lt) => (
              <button
                key={lt}
                type="button"
                aria-label={LINE_TYPE_LABELS[lt]}
                aria-pressed={lineType === lt}
                onClick={() => onLineTypeChange(lt)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border p-2 hover:bg-accent',
                  lineType === lt && 'border-ring bg-accent',
                )}
              >
                <LineTypeIcon lineType={lt} width={36} height={12} color={activeColor} />
                <span className="text-center text-[10px] leading-tight">{LINE_TYPE_LABELS[lt]}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
