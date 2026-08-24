import { Button } from '@/components/ui/button'
import type { LivePlayer } from '@shared/live/live-types'

/**
 * Shared ↑↓ reorder list for batting orders and rotation orders — one
 * implementation for what were two byte-identical editors. Label defaults
 * to "1. Name"; rotations pass an SP-prefixed labeler.
 */
export function OrderEditor({
  title,
  order,
  onChange,
  labelFor = (player, index) => `${index + 1}. ${player.name}`,
}: {
  title: string
  order: LivePlayer[]
  onChange: (order: LivePlayer[]) => void
  labelFor?: (player: LivePlayer, index: number) => string
}) {
  const move = (index: number, direction: -1 | 1) => {
    const next = [...order]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <h3 className="font-display text-sm text-primary">{title}</h3>
      <ol className="space-y-1">
        {order.map((player, index) => (
          <li
            key={player.id}
            className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm"
          >
            <span>{labelFor(player, index)}</span>
            <span className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-9 px-0"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-9 px-0"
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </Button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default OrderEditor
