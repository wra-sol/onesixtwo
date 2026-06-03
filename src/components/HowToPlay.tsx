import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type HowToPlayProps = {
  onStart: () => void
}

export default function HowToPlay({ onStart }: HowToPlayProps) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="font-display text-xl text-primary">
          How to Play 162-0
        </CardTitle>
        <CardDescription className="text-base text-foreground">
          Build the ultimate MLB all-time lineup and see if you can go 162-0!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            Each round, spin to get a random MLB team and decade (1960s–2020s).
          </li>
          <li>
            Once per game you can <strong>respin the team</strong> (new franchise,
            same decade) and once you can <strong>respin the year</strong> (new
            decade, same franchise) before you lock in your pick.
          </li>
          <li>
            Pick one player from that era and assign them to one open lineup spot.
          </li>
          <li>
            Fill all 9 positions: <strong>C</strong>, <strong>1B</strong>,{' '}
            <strong>2B</strong>, <strong>3B</strong>, <strong>SS</strong>,{' '}
            <strong>LF</strong>, <strong>CF</strong>, <strong>RF</strong>, and{' '}
            <strong>P</strong>.
          </li>
          <li>
            Your team is rated on offense and run prevention — higher stats win
            more games.
          </li>
          <li>Aim for the perfect 162-0 season!</li>
        </ol>
        <Button type="button" size="lg" onClick={onStart}>
          Start Draft
        </Button>
      </CardContent>
    </Card>
  )
}
