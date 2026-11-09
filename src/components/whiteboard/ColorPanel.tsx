'use client'

import { useState } from 'react'
import { Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { hexToRgb, isValidHex, rgbToHex, type Rgb } from '@/lib/whiteboard/color'

interface ColorPanelProps {
  colors: string[]
  colorIdx: number
  onSelectColor: (idx: number) => void
  onEditColor: (idx: number, hex: string) => void
  strokeWidth: number
  onStrokeWidthChange: (w: number) => void
}

export function ColorPanel({ colors, colorIdx, onSelectColor, onEditColor, strokeWidth, onStrokeWidthChange }: ColorPanelProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [widthOpen, setWidthOpen] = useState(false)
  const [rgb, setRgb] = useState<Rgb>({ r: 0, g: 0, b: 0 })
  const [hexInput, setHexInput] = useState('#000000')

  const activeColor = colors[colorIdx] ?? '#000000'

  // при открытии палитры — синхронизируем ползунки с активным цветом
  const syncPalette = (open: boolean) => {
    setPaletteOpen(open)
    if (open) {
      const c = hexToRgb(colors[colorIdx] ?? '#000000')
      setRgb(c)
      setHexInput(rgbToHex(c))
    }
  }

  const applyRgb = (next: Rgb) => {
    setRgb(next)
    onEditColor(colorIdx, rgbToHex(next))
  }

  const onHexChange = (v: string) => {
    setHexInput(v)
    if (isValidHex(v)) applyRgb(hexToRgb(v))
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

      {/* RGB-палитра */}
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
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-6 shrink-0 sm:h-6 sm:w-px" />

      {/* Толщина */}
      <Popover open={widthOpen} onOpenChange={setWidthOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Толщина линии: ${strokeWidth}`}
            title="Толщина линии"
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
        </PopoverContent>
      </Popover>
    </div>
  )
}
