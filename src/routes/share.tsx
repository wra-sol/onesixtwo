import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import ResultScreen from '../components/ResultScreen'
import { calculateSeasonResult } from '../lib/game'
import {
  isParsedShare,
  parseShareParams,
  reconstructLineup,
  shareValidationMessage,
} from '../lib/share-url'
import { useSharePageMeta } from '../lib/use-share-page-meta'

export default function ShareRoute() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const parsed = useMemo(
    () => parseShareParams(searchParams),
    [searchParams],
  )

  const lineup = useMemo(() => {
    if (!isParsedShare(parsed)) return null
    return reconstructLineup(parsed)
  }, [parsed])

  const result = useMemo(() => {
    if (!lineup || !isParsedShare(parsed)) return null
    const rerollSeed =
      parsed.reroll > 0 ? String(parsed.reroll) : undefined
    return calculateSeasonResult(lineup, { rerollSeed })
  }, [lineup, parsed])

  useSharePageMeta(result, lineup, isParsedShare(parsed) ? parsed : null, searchParams)

  if (!isParsedShare(parsed) || !lineup || !result) {
    const message = !isParsedShare(parsed)
      ? shareValidationMessage(parsed)
      : 'This share link could not be loaded.'

    return (
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <Card className="mx-auto max-w-lg text-center">
          <CardHeader>
            <CardTitle className="font-display text-xl text-primary">
              Share link unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{message}</p>
            <Link
              to="/"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
            >
              Draft your own lineup
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ResultScreen
        result={result}
        lineup={lineup}
        shareUrl={typeof window !== 'undefined' ? window.location.href : undefined}
        rerollIndex={parsed.reroll}
        readOnly
        onRestart={() => navigate('/')}
      />
    </div>
  )
}
