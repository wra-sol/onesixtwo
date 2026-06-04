/**
 * Prints percentile distributions for rating calibration.
 * Run: npm run analyze:ratings
 */
import { buildLahmanBucketIndex, lahmanDataAvailable } from './lib/lahman.ts'
import {
  isPlayableCardMetrics,
  metricsFromAgg,
  type LahmanAggMetrics,
} from './lib/lahman-metrics.ts'

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return NaN
  const k = ((sorted.length - 1) * p) / 100
  const f = Math.floor(k)
  const c = Math.ceil(k)
  if (f === c) return sorted[f]!
  return sorted[f]! * (c - k) + sorted[c]! * (k - f)
}

function summarize(name: string, values: number[], digits = 3) {
  if (values.length === 0) {
    console.log(`\n${name}: no values`)
    return
  }
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const fmt = (v: number) =>
    digits === 0 ? Math.round(v).toString() : v.toFixed(digits)
  console.log(`\n${name} (n=${values.length})`)
  console.log(`  mean=${fmt(mean)} min=${fmt(Math.min(...values))} max=${fmt(Math.max(...values))}`)
  for (const p of [10, 25, 50, 75, 90, 98, 99]) {
    console.log(`  p${p}=${fmt(percentile(values, p))}`)
  }
  console.log(
    `  tiers: 50=${fmt(percentile(values, 10), digits)} 60=${fmt(percentile(values, 25), digits)} 70=${fmt(percentile(values, 50), digits)} 80=${fmt(percentile(values, 75), digits)} 90=${fmt(percentile(values, 90), digits)} 100=${fmt(percentile(values, 99), digits)}`,
  )
}

function summarizeLowerBetter(name: string, values: number[], digits = 2) {
  summarize(name, values, digits)
  console.log(
    `  tiers (lower better): 50=${percentile(values, 90).toFixed(digits)} 60=${percentile(values, 75).toFixed(digits)} 70=${percentile(values, 50).toFixed(digits)} 80=${percentile(values, 25).toFixed(digits)} 90=${percentile(values, 10).toFixed(digits)} 100=${percentile(values, 1).toFixed(digits)}`,
  )
}

const TOP_N_PER_BUCKET = 25

function collectMetrics(): LahmanAggMetrics[] {
  const buckets = buildLahmanBucketIndex()
  const out: LahmanAggMetrics[] = []
  for (const list of buckets.values()) {
    const ranked = [...list]
      .sort((a, b) => b.valueScore - a.valueScore)
      .slice(0, TOP_N_PER_BUCKET)
    for (const agg of ranked) {
      const metrics = metricsFromAgg(agg)
      if (metrics && isPlayableCardMetrics(metrics)) out.push(metrics)
    }
  }
  return out
}

function lineupErrorSamples(hitters: LahmanAggMetrics[]): number[] {
  const byBucket = new Map<string, LahmanAggMetrics[]>()
  for (const h of hitters) {
    const key = `${h.teamId}-${h.decade}`
    const list = byBucket.get(key) ?? []
    list.push(h)
    byBucket.set(key, list)
  }

  const samples: number[] = []
  for (const list of byBucket.values()) {
    const top = [...list]
      .sort((a, b) => b.ops - a.ops)
      .slice(0, 8)
    if (top.length < 8) continue
    samples.push(top.reduce((s, h) => s + h.errorsPer162, 0))
  }
  return samples
}

function main() {
  if (!lahmanDataAvailable()) {
    console.error('Lahman CSV not found. Run: npm run fetch:lahman')
    process.exit(1)
  }

  const metrics = collectMetrics()
  const hitters = metrics.filter((m) => m.role === 'hitter' && m.ab >= 80)
  const pitchers = metrics.filter((m) => m.role === 'pitcher' && m.ip >= 80)
  const starters = pitchers.filter((m) => m.gs >= 30)

  console.log('=== Rating Distribution Report (modern eras, eligible cards) ===')
  console.log(`cards=${metrics.length} hitters=${hitters.length} pitchers=${pitchers.length} starters=${starters.length}`)

  summarize('hitter.avg', hitters.map((m) => m.avg), 3)
  summarize('hitter.ops', hitters.map((m) => m.ops), 3)
  summarize('hitter.hrPer162', hitters.map((m) => m.hrPer162), 1)
  summarize('hitter.rbiPer162', hitters.map((m) => m.rbiPer162), 1)
  summarize('hitter.sbPer162', hitters.map((m) => m.sbPer162), 1)
  summarize('hitter.errorsPer162', hitters.filter((m) => m.fieldingGames > 0).map((m) => m.errorsPer162), 1)

  summarizeLowerBetter('pitcher.era', pitchers.map((m) => m.pitchingEra))
  summarizeLowerBetter('pitcher.whip', pitchers.map((m) => m.whip))
  summarize('pitcher.k9', pitchers.map((m) => m.k9), 1)
  summarize('starter.ipPer30Gs', starters.map((m) => m.ipPer30Gs), 1)

  const lineupErrors = lineupErrorSamples(hitters.filter((m) => m.fieldingGames > 0))
  summarize('lineup.errorsPer162 (top-8 OPS proxy)', lineupErrors, 1)
  summarizeLowerBetter('lineup.errorsPer162 penalty tiers', lineupErrors, 1)
}

main()
