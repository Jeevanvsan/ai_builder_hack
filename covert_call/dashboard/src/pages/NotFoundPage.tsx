import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section>
      <div className="page-head">
        <h1>Page not found</h1>
      </div>
      <Link to="/" className="back-link">← Back to live queue</Link>
    </section>
  )
}
