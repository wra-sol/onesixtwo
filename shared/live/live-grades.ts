import type { DisplayGrade20, GradeLabel, LivePlayerGrades } from './live-types'

export const GRADE_LABELS: Record<DisplayGrade20, GradeLabel> = {
  20: 'Poor',
  30: 'Well Below Avg',
  40: 'Below Avg',
  50: 'Average',
  60: 'Plus',
  70: 'Plus-Plus',
  80: 'Elite',
}

const PERCENTILE_THRESHOLDS: Array<{ min: number; grade: DisplayGrade20 }> = [
  { min: 0.97, grade: 80 },
  { min: 0.9, grade: 70 },
  { min: 0.75, grade: 60 },
  { min: 0.55, grade: 50 },
  { min: 0.35, grade: 40 },
  { min: 0.15, grade: 30 },
  { min: 0, grade: 20 },
]

export function percentileToContinuous(percentile: number): number {
  const clamped = Math.max(0, Math.min(1, percentile))
  for (const { min, grade } of PERCENTILE_THRESHOLDS) {
    if (clamped >= min) {
      const next = PERCENTILE_THRESHOLDS.find((t) => t.grade > grade)
      if (!next) return grade
      const span = next.min - min || 1
      const progress = (clamped - min) / span
      return grade + progress * (next.grade - grade)
    }
  }
  return 20
}

export function continuousToDisplayGrade(value: number): DisplayGrade20 {
  const rounded = Math.round(value / 10) * 10
  return Math.max(20, Math.min(80, rounded)) as DisplayGrade20
}

export function formatGrade(value: number): string {
  const display = continuousToDisplayGrade(value)
  return `${display} ${GRADE_LABELS[display]}`
}

export function rankPercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0.5
  let below = 0
  for (const v of sortedValues) {
    if (v < value) below += 1
  }
  return below / sortedValues.length
}

export function buildLeaguePercentiles(values: number[]): number[] {
  return [...values].sort((a, b) => a - b)
}

export function gradeFromPercentile(
  value: number,
  leagueValues: number[],
): number {
  const percentile = rankPercentile(value, leagueValues)
  return percentileToContinuous(percentile)
}

export function overallFromGrades(grades: Omit<LivePlayerGrades, 'overall'>): number {
  const values = Object.entries(grades)
    .filter(([key]) => key !== 'overall')
    .map(([, v]) => v)
    .filter((v): v is number => typeof v === 'number')
  if (values.length === 0) return 50
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export const REPLACEMENT_LEVEL = 40
