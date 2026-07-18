import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { continuousToDisplayGrade, GRADE_LABELS } from '@shared/live/live-grades'
import type { LivePlayer, OpponentRoster } from '@shared/live/live-types'
import { cn } from '@/lib/utils'

type DailyLineupPhaseProps = {
  battingOrder: LivePlayer[]
  onChange: (order: LivePlayer[]) => void
  onSimulate: () => void
  opponent: OpponentRoster
}

function SortableRow({
  player,
  index,
  total,
  onMove,
}: {
  player: LivePlayer
  index: number
  total: number
  onMove: (index: number, direction: -1 | 1) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
  })
  const overall = continuousToDisplayGrade(player.grades.overall)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center justify-between rounded-md border border-border bg-card px-2 py-1.5 text-sm',
        isDragging && 'z-10 shadow-md opacity-80',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab text-muted-foreground touch-none"
          aria-label={`Drag ${player.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        <span className="font-medium tabular-nums text-muted-foreground">{index + 1}.</span>
        <span>{player.name}</span>
        <span className="text-xs text-muted-foreground">{player.teamAbbrev}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[0.65rem] tabular-nums text-primary">
          {overall} {GRADE_LABELS[overall]}
        </span>
        <span className="flex gap-0.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-1.5"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            aria-label={`Move ${player.name} up`}
          >
            <ArrowUp size={12} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-1.5"
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            aria-label={`Move ${player.name} down`}
          >
            <ArrowDown size={12} />
          </Button>
        </span>
      </div>
    </li>
  )
}

export default function DailyLineupPhase({
  battingOrder,
  onChange,
  onSimulate,
  opponent,
}: DailyLineupPhaseProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const move = (index: number, direction: -1 | 1) => {
    const next = [...battingOrder]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange(next)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = battingOrder.findIndex((p) => p.id === active.id)
    const toIndex = battingOrder.findIndex((p) => p.id === over.id)
    if (fromIndex === -1 || toIndex === -1) return
    const next = [...battingOrder]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) return
    next.splice(toIndex, 0, moved)
    onChange(next)
  }

  const autoSort = () => {
    const sorted = [...battingOrder].sort((a, b) => b.grades.overall - a.grades.overall)
    onChange(sorted)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-primary">Batting order</h3>
        <Button type="button" size="sm" variant="outline" onClick={autoSort}>
          Auto-sort
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag to reorder, or use the arrows. Your 9 hitters bat in this order against{' '}
        {opponent.teamName}.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={battingOrder.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="space-y-1">
            {battingOrder.map((player, index) => (
              <SortableRow
                key={player.id}
                player={player}
                index={index}
                total={battingOrder.length}
                onMove={move}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <Button type="button" onClick={onSimulate} className="w-full">
        Simulate best-of-3 vs {opponent.teamName}
      </Button>
    </div>
  )
}
