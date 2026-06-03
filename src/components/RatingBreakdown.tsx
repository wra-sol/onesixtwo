import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { SeasonResult } from '../lib/types'

type RatingBreakdownProps = {
  result: SeasonResult
}

export default function RatingBreakdown({ result }: RatingBreakdownProps) {
  const grades = result.scorecard?.teamGrades ?? []

  return (
    <Card size="sm" aria-labelledby="rating-heading">
      <CardHeader className="pb-2">
        <CardTitle id="rating-heading" className="font-display text-primary">
          Team grades
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y divide-border">
          {grades.map((grade) => (
            <li
              key={grade.label}
              className="flex justify-between py-2 text-sm first:pt-0 last:pb-0"
            >
              <span>{grade.label}</span>
              <span className="font-bold tabular-nums">
                {grade.displayGrade}{' '}
                <span className="text-muted-foreground">({grade.value})</span>
              </span>
            </li>
          ))}
        </ul>
        {result.strengths.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Strengths:{' '}
            {result.strengths.map((s) => `${s.label} ${s.value}`).join(' · ')}
          </p>
        )}
        {result.weaknesses.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Vulnerabilities:{' '}
            {result.weaknesses.map((w) => `${w.label} ${w.value}`).join(' · ')}
          </p>
        )}
        <p className="text-sm">
          Simulated record: <strong>{result.record}</strong>
        </p>
      </CardContent>
    </Card>
  )
}
