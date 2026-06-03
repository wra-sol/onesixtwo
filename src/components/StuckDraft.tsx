type StuckDraftProps = {
  onRestart: () => void
}

export default function StuckDraft({ onRestart }: StuckDraftProps) {
  return (
    <section className="stuck-draft" role="alert">
      <h2>No valid spins left</h2>
      <p>
        No remaining team-era combinations can fill your open lineup spots with
        undrafted players. Start a new draft to try again.
      </p>
      <button type="button" className="btn btn-primary" onClick={onRestart}>
        Restart draft
      </button>
    </section>
  )
}
