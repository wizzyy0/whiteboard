'use client'

import { ChevronLeft, ChevronRight, FileX, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { MAX_ZOOM, MIN_ZOOM } from '@/lib/whiteboard/types'

interface PagerProps {
  count: number
  index: number // 0-based
  onPrev: () => void
  onNext: () => void
  onAdd: () => void
  onDelete: () => void
  zoom: number // 0.1..9
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
}

export function Pager({ count, index, onPrev, onNext, onAdd, onDelete, zoom, onZoomIn, onZoomOut, onZoomReset }: PagerProps) {
  const canDelete = count > 1
  const percent = Math.round(zoom * 100)
  return (
    <div
      role="toolbar"
      aria-label="Холсты и масштаб"
      className="pointer-events-auto absolute bottom-[calc(4.25rem_+_env(safe-area-inset-bottom))] right-2 z-20 flex items-center gap-0.5 rounded-full border bg-background/95 p-1.5 shadow-md backdrop-blur lg:bottom-3 lg:right-3"
    >
      {/* Масштаб: слева от «+» (добавление холста), 10%..900% */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Уменьшить (минимум 10%)"
        title="Уменьшить"
        onClick={onZoomOut}
        disabled={zoom <= MIN_ZOOM + 1e-9}
        className="h-9 w-9 rounded-full shrink-0"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <button
        type="button"
        aria-label={`Масштаб ${percent}%, клик вернёт 100%`}
        title="Масштаб (клик — 100%)"
        onClick={onZoomReset}
        className="min-w-12 shrink-0 select-none rounded-full py-1 text-center font-mono text-sm tabular-nums text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        {percent}%
      </button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Увеличить (максимум 900%)"
        title="Увеличить"
        onClick={onZoomIn}
        disabled={zoom >= MAX_ZOOM - 1e-9}
        className="h-9 w-9 rounded-full shrink-0"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6 shrink-0" />

      <Button
        variant="ghost"
        size="icon"
        aria-label="Новый холст"
        title="Новый холст"
        onClick={onAdd}
        className="h-9 w-9 rounded-full shrink-0"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Предыдущий холст"
        title="Предыдущий холст"
        onClick={onPrev}
        disabled={index === 0}
        className="h-9 w-9 rounded-full shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span
        aria-live="polite"
        aria-label={`Холст ${index + 1} из ${count}`}
        className="min-w-12 shrink-0 select-none text-center font-mono text-sm tabular-nums text-muted-foreground"
      >
        {index + 1}/{count}
      </span>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Следующий холст"
        title="Следующий холст"
        onClick={onNext}
        disabled={index >= count - 1}
        className="h-9 w-9 rounded-full shrink-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Удалить текущий холст"
          title="Удалить текущий холст"
          onClick={onDelete}
          className="h-9 w-9 rounded-full shrink-0 text-destructive hover:text-destructive"
        >
          <FileX className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
