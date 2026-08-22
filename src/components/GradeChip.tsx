import { continuousToDisplayGrade, GRADE_LABELS } from '@shared/live/live-grades'
import { cn } from '@/lib/utils'

/**
 * The single renderer for 20–80 grade labels ("Contact 60 Plus"). Variants
 * cover the card sizing (`text-xs`), the unlabeled overall badges
 * (`hideLabel`), and tonal context via className.
 */
export function GradeChip({
  label,
  value,
  hideLabel = false,
  className,
}: {
  label: string
  value: number | undefined
  hideLabel?: boolean
  className?: string
}) {
  if (value === undefined) return null
  const display = continuousToDisplayGrade(value)
  return (
    <span className={cn('text-[0.65rem] tabular-nums text-muted-foreground', className)}>
      {hideLabel ? null : <>{label} </>}
      {display} {GRADE_LABELS[display]}
    </span>
  )
}

export default GradeChip
