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
  return (
    <Card size="sm" aria-labelledby="rating-heading">
      <CardHeader className="pb-2">
        <CardTitle id="rating-heading" className="font-display text-primary">
          Team rating
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y divide-border">
          {result.categories.map((cat) => (
            <li
              key={cat.label}
              className="flex justify-between py-2 text-sm first:pt-0 last:pb-0"
            >
              <span>{cat.label}</span>
              <span className="font-bold">{cat.value}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm">
          Projected record: <strong>{result.record}</strong>
        </p>
      </CardContent>
    </Card>
  )
}
