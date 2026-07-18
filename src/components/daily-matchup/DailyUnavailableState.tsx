import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DailyUnavailableStateProps = {
  reason?: string
  challengeDate: string
  targetDate?: string
}

export default function DailyUnavailableState({
  reason,
  challengeDate,
  targetDate,
}: DailyUnavailableStateProps) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader className="text-center">
        <CardTitle className="font-display text-xl text-primary">
          Daily Matchup unavailable
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center text-sm">
        <p>{reason ?? 'No MLB games yesterday.'}</p>
        <p className="text-xs text-muted-foreground">
          Challenge date {challengeDate}
          {targetDate ? ` · Target ${targetDate}` : ''}
        </p>
        <Link
          to="/live-draft"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Play Live Draft
        </Link>
      </CardContent>
    </Card>
  )
}
