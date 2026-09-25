import { Button } from '@/components/ui/button'

type DailyErrorStateProps = {
  message: string
  onRetry: () => void
}

export default function DailyErrorState({ message, onRetry }: DailyErrorStateProps) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-8 text-center">
      <p className="text-destructive" role="alert">
        {message}
      </p>
      <Button type="button" variant="outline" onClick={() => void onRetry()}>
        Retry
      </Button>
      <p className="text-xs text-muted-foreground">
        Live MLB data is unavailable right now. Try Live Draft or Classic 162 while the feed
        recovers.
      </p>
    </div>
  )
}
