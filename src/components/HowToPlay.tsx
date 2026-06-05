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
import { ROSTER_FORMATS, type RosterFormatId } from '@/lib/roster-format'
import type { GameModeId } from '@/lib/types'
import { cn } from '@/lib/utils'

type HowToPlayProps = {
  gameModeId?: GameModeId
  onStart: (formatId: RosterFormatId) => void
}

export default function HowToPlay({
  gameModeId = 'all-time',
  onStart,
}: HowToPlayProps) {
  const [formatId, setFormatId] = useState<RosterFormatId>('classic')

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader className="items-center text-center">
        <img
          src={BRAND.logoPath}
          alt="Perfect Season logo"
          className="mb-2 size-28 rounded-3xl object-cover shadow-xl ring-2 ring-primary/70"
        />
        <CardTitle className="font-display text-2xl text-primary">
          {gameModeId === 'active'
            ? 'Active Players'
            : `How to Play ${BRAND.name}`}
        </CardTitle>
        <CardDescription className="text-base text-foreground">
          {gameModeId === 'active'
            ? 'Build the best team from yesterday’s MLB lineups using each player’s current-season stats.'
            : BRAND.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <fieldset className="space-y-2">
          <legend className="font-display text-sm font-semibold text-primary">
            Roster format
          </legend>
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
        </fieldset>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {gameModeId === 'active' ? (
            <>
              <li>
                Each round, spin to get a random MLB team whose players appeared
                in yesterday&apos;s lineups.
              </li>
              <li>
                Player cards use <strong>in-season stats</strong> as their
                baseline — not career numbers.
              </li>
              <li>
                Once per game you can respin the team before you lock in your
                pick.
              </li>
            </>
          ) : (
            <>
              <li>
                Each round, spin to get a random MLB team and decade (1930s–2020s).
              </li>
              <li>
                Once per game you can <strong>respin the team</strong> (new
                franchise, same decade) and once you can{' '}
                <strong>respin the year</strong> (new decade, same franchise)
                before you lock in your pick.
              </li>
              <li>
                Pick one player from that era and assign them to one open lineup
                spot.
              </li>
            </>
          )}
          <li>
            Fill every slot in your chosen format — classic nine includes{' '}
            <strong>SP</strong>; optional <strong>DH</strong> and/or{' '}
            <strong>RP</strong>.
          </li>
          <li>
            Two-way players (e.g. Ohtani) count once but help both offense and
            pitching.
          </li>
          <li>
            Your team is rated on offense and run prevention — higher stats win
            more games. Slow teams are not penalized for lack of speed.
          </li>
          <li>Aim for the perfect {BRAND.perfectRecord} season!</li>
        </ol>
        <Button type="button" size="lg" onClick={() => onStart(formatId)}>
          Start Draft
        </Button>
        {gameModeId === 'active' ? (
          <p className="text-center text-xs text-muted-foreground">
            <Link
              to="/"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Play all-time mode
            </Link>
            {' · '}
            <Link
              to="/active/leaderboard"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Active leaderboard
            </Link>
          </p>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            <Link
              to="/active"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Try Active Players mode
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
