'use client'

import { ChevronLeft, ChevronRight, FileX, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PagerProps {
  count: number
  index: number // 0-based
  onPrev: () => void
  onNext: () => void
  onAdd: () => void
  onDelete: () => void
}

export function Pager({ count, index, onPrev, onNext, onAdd, onDelete }: PagerProps) {
  const canDelete = count > 1
  return (
    <div
      role="toolbar"
      aria-label="Холсты"
      className="pointer-events-auto absolute bottom-3 right-3 z-20 flex items-center gap-0.5 rounded-full border bg-background/95 p-1.5 shadow-md backdrop-blur"
    >
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
