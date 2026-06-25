import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { BRAND } from '@/lib/brand'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ROSTER_FORMATS,
  type RosterFormatId,
} from '@/lib/roster-format'
import { cn } from '@/lib/utils'

type ModeSelectProps = {
  onStartClassic: (formatId: RosterFormatId) => void
}

export default function ModeSelect({ onStartClassic }: ModeSelectProps) {
  const [formatId, setFormatId] = useState<RosterFormatId>('classic')

  return (
    <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader className="items-center text-center">
          <img
            src={BRAND.logoPath}
            alt="Perfect Season logo"
            className="mb-2 size-24 rounded-3xl object-cover shadow-xl ring-2 ring-primary/70"
          />
          <CardTitle className="font-display text-2xl text-primary">
            {BRAND.name}
          </CardTitle>
          <CardDescription>{BRAND.description}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg text-primary">
            Classic 162
          </CardTitle>
          <CardDescription>
            Spin franchise decades, draft historical cards, simulate a full
            season.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {ROSTER_FORMATS.map((format) => (
              <button
                key={format.id}
                type="button"
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                  formatId === format.id
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50',
                )}
                aria-pressed={formatId === format.id}
                onClick={() => setFormatId(format.id)}
              >
                <span className="block font-bold">{format.label}</span>
              </button>
            ))}
          </div>
          <Button type="button" onClick={() => onStartClassic(formatId)}>
            Start Classic Draft
          </Button>
        </CardContent>
      </Card>

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="font-display text-lg text-primary">
            Daily Matchup
          </CardTitle>
          <CardDescription>
            Draft from last night&apos;s MLB players and play a best-of-3 series
            vs the highest-scoring real team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            to="/daily-matchup"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Play Daily Matchup
          </Link>
        </CardContent>
      </Card>

      <Card className="border-primary/40 md:col-span-2">
        <CardHeader>
          <CardTitle className="font-display text-lg text-primary">
            Live Draft
          </CardTitle>
          <CardDescription>
            Head-to-head snake draft against AI from active MLB players, then
            best-of-3 simulation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            to="/live-draft"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground"
          >
            Play Live Draft
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
