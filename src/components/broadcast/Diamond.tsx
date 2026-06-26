import type { BaseState } from '@/lib/series-replay'
import { cn } from '@/lib/utils'

type DiamondProps = {
  bases: BaseState
}

export function Diamond({ bases }: DiamondProps) {
  const occupied = [
    bases.first && 'first',
    bases.second && 'second',
    bases.third && 'third',
  ]
    .filter((label): label is string => Boolean(label))
    .join(', ')

  return (
    <div
      className="broadcast-diamond"
      aria-label={occupied ? `Runners on ${occupied}` : 'Bases empty'}
    >
      <div
        className={cn(
          'broadcast-base broadcast-base--first',
          bases.first && 'broadcast-base--occupied',
        )}
      />
      <div
        className={cn(
          'broadcast-base broadcast-base--second',
          bases.second && 'broadcast-base--occupied',
        )}
      />
      <div
        className={cn(
          'broadcast-base broadcast-base--third',
          bases.third && 'broadcast-base--occupied',
        )}
      />
    </div>
  )
}
