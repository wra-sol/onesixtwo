import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type StuckDraftProps = {
  onRestart: () => void
}

export default function StuckDraft({ onRestart }: StuckDraftProps) {
  return (
    <Alert
      variant="destructive"
      className="mx-auto max-w-md border-2 px-6 py-6 text-center"
    >
      <AlertTitle className="font-display text-lg">No valid spins left</AlertTitle>
      <AlertDescription className="mt-2 mb-4">
        No remaining team-era combinations can fill your open lineup spots with
        undrafted players. Start a new draft to try again.
      </AlertDescription>
      <Button type="button" onClick={onRestart}>
        Restart draft
      </Button>
    </Alert>
  )
}
