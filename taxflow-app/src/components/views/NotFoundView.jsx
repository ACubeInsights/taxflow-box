import { Link } from 'react-router-dom'

export default function NotFoundView() {
  return (
    <div style={{ textAlign: 'center', paddingTop: 80 }}>
      <h2 style={{ color: 'var(--color-on-surface)', fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
        Page Not Found
      </h2>
      <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 14, marginBottom: 24 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/dashboard"
        style={{
          color: 'var(--color-primary)',
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Return to Dashboard
      </Link>
    </div>
  )
}
