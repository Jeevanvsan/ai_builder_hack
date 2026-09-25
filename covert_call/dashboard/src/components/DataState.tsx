export default function DataState({ loading, error }: { loading: boolean; error: string | null }) {
  if (error) {
    return (
      <div className="card notice notice-error">
        <strong>Couldn't load incidents from Firestore.</strong>
        <p className="muted">{error}</p>
      </div>
    )
  }
  if (loading) return <div className="card notice">Connecting to Firestore…</div>
  return null
}
