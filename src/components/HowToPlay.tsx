type HowToPlayProps = {
  onStart: () => void
}

export default function HowToPlay({ onStart }: HowToPlayProps) {
  return (
    <section className="how-to-play" aria-labelledby="how-to-play-heading">
      <h2 id="how-to-play-heading">How to Play 162-0</h2>
      <p className="lead">
        Build the ultimate MLB all-time lineup and see if you can go 162-0!
      </p>
      <ol className="rules-list">
        <li>
          Each round, spin to get a random MLB team and decade (1960s–2020s).
        </li>
        <li>
          Once per game you can <strong>respin the team</strong> (new franchise,
          same decade) and once you can <strong>respin the year</strong> (new
          decade, same franchise) before you lock in your pick.
        </li>
        <li>Pick one player from that era and assign them to one open lineup spot.</li>
        <li>
          Fill all 9 positions: <strong>C</strong>, <strong>1B</strong>,{' '}
          <strong>2B</strong>, <strong>3B</strong>, <strong>SS</strong>,{' '}
          <strong>LF</strong>, <strong>CF</strong>, <strong>RF</strong>, and{' '}
          <strong>P</strong>.
        </li>
        <li>
          Your team is rated on offense and run prevention — higher stats win more
          games.
        </li>
        <li>Aim for the perfect 162-0 season!</li>
      </ol>
      <button type="button" className="btn btn-primary" onClick={onStart}>
        Start Draft
      </button>
    </section>
  )
}
