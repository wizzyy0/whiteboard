'use client'

import { useState } from 'react'
import { Pencil, Eraser, Lasso, Slash, ArrowUpRight, Square, Circle, Triangle, Box, LayoutGrid, Sun, Moon, Undo2, Redo2, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { BgMode, Shape3D, TemplateKind, ToolKind } from '@/lib/whiteboard/types'
import { SHAPE3D_LABELS, SHAPE3D_ORDER, TEMPLATE_LABELS, TEMPLATE_ORDER } from '@/lib/whiteboard/types'
import { Shape3DIcon, TemplateIcon } from './icons'

interface ToolbarProps {
  tool: ToolKind
  onToolChange: (t: ToolKind) => void
  shape3d: Shape3D
  onShape3dChange: (s: Shape3D) => void
  template: TemplateKind
  onTemplateChange: (t: TemplateKind) => void
  bg: BgMode
  onBgToggle: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onExport: () => void
}

function Divider() {
  return <Separator orientation="horizontal" className="my-0.5 h-px w-6 shrink-0" />
}

interface ToolBtnProps {
  active?: boolean
  disabled?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
  className?: string
}

function ToolBtn({ active, disabled, label, onClick, children, className }: ToolBtnProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn('h-8 w-8 rounded-full shrink-0', active && 'bg-accent text-accent-foreground', className)}
    >
      {children}
    </Button>
  )
}

export function Toolbar({
  tool,
  onToolChange,
  shape3d,
  onShape3dChange,
  template,
  onTemplateChange,
  bg,
  onBgToggle,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onExport,
}: ToolbarProps) {
  const [shapeOpen, setShapeOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)

  return (
    <div className="pointer-events-auto relative z-20 w-max">
      <div
        role="toolbar"
        aria-label="Инструменты доски"
        className="flex w-max flex-col items-center gap-0.5 rounded-full border bg-background/95 p-1.5 shadow-md backdrop-blur"
      >
        <ToolBtn active={tool === 'pen'} label="Кисть (P)" onClick={() => onToolChange('pen')}>
          <Pencil className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn active={tool === 'eraser'} label="Ластик (E)" onClick={() => onToolChange('eraser')}>
          <Eraser className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn active={tool === 'lasso'} label="Лассо: обведите и перетащите (S)" onClick={() => onToolChange('lasso')}>
          <Lasso className="h-4 w-4" />
        </ToolBtn>

        <Divider />

        <ToolBtn active={tool === 'line'} label="Линия (L)" onClick={() => onToolChange('line')}>
          <Slash className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn active={tool === 'arrow'} label="Стрелка (A)" onClick={() => onToolChange('arrow')}>
          <ArrowUpRight className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn active={tool === 'rect'} label="Прямоугольник (R)" onClick={() => onToolChange('rect')}>
          <Square className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn active={tool === 'ellipse'} label="Эллипс (O)" onClick={() => onToolChange('ellipse')}>
          <Circle className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn active={tool === 'triangle'} label="Треугольник (T)" onClick={() => onToolChange('triangle')}>
          <Triangle className="h-4 w-4" />
        </ToolBtn>

        <Divider />

        {/* 3D-фигуры */}
        <Popover open={shapeOpen} onOpenChange={setShapeOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="3D-фигуры с невидимыми линиями"
              title="3D-фигуры (невидимые линии — пунктиром)"
              className={cn('h-8 w-8 rounded-full shrink-0 gap-0.5', tool === 'shape3d' && 'bg-accent text-accent-foreground')}
            >
              <Box className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" side="right" align="center">
            <div className="px-2 pb-1.5 pt-0.5 text-xs font-medium text-muted-foreground">
              3D-тела — невидимые линии пунктиром
            </div>
            <div className="grid grid-cols-3 gap-1">
              {SHAPE3D_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={SHAPE3D_LABELS[s]}
                  onClick={() => {
                    onShape3dChange(s)
                    onToolChange('shape3d')
                    setShapeOpen(false)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg p-2 hover:bg-accent',
                    shape3d === s && tool === 'shape3d' && 'bg-accent',
                  )}
                >
                  <Shape3DIcon shape={s} size={30} />
                  <span className="text-center text-[10px] leading-tight">{SHAPE3D_LABELS[s]}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Шаблоны */}
        <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Шаблоны для уроков"
              title="Шаблоны: координатная плоскость, числовая ось"
              className={cn('h-8 w-8 rounded-full shrink-0', tool === 'template' && 'bg-accent text-accent-foreground')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-1.5" side="right" align="center">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Шаблоны — кликните на холсте, чтобы вставить</div>
            {TEMPLATE_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                aria-label={TEMPLATE_LABELS[t]}
                onClick={() => {
                  onTemplateChange(t)
                  onToolChange('template')
                  setTemplateOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent',
                  template === t && tool === 'template' && 'bg-accent',
                )}
              >
                <TemplateIcon template={t} size={26} />
                {TEMPLATE_LABELS[t]}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Divider />

        {/* Фон: одна кнопка, белый ↔ чёрный (сетка всегда на белом) */}
        <ToolBtn
          label={bg === 'black' ? 'Белый фон (сетка включена)' : 'Чёрный фон'}
          onClick={onBgToggle}
        >
          {bg === 'black' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </ToolBtn>

        <Divider />

        <ToolBtn disabled={!canUndo} label="Отменить (Ctrl+Z)" onClick={onUndo}>
          <Undo2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn disabled={!canRedo} label="Вернуть (Ctrl+Y)" onClick={onRedo}>
          <Redo2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn label="Очистить холст" onClick={onClear}>
          <Trash2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn label="Скачать PNG" onClick={onExport}>
          <Download className="h-4 w-4" />
        </ToolBtn>
      </div>
    </div>
  )
}
