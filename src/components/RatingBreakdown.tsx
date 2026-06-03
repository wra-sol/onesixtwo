import type { SeasonResult } from '../lib/types'

type RatingBreakdownProps = {
  result: SeasonResult
}

export default function RatingBreakdown({ result }: RatingBreakdownProps) {
  return (
    <section className="rating-breakdown" aria-labelledby="rating-heading">
      <h3 id="rating-heading">Team rating</h3>
      <p className="overall-rating">
        Overall <span className="rating-value">{result.overallRating}</span>
      </p>
      <ul className="category-list">
        {result.categories.map((cat) => (
          <li key={cat.label}>
            <span className="category-label">{cat.label}</span>
            <span className="category-value">{cat.value}</span>
          </li>
        ))}
      </ul>
      <p className="projected-record">
        Projected record: <strong>{result.record}</strong>
      </p>
    </section>
  )
}
