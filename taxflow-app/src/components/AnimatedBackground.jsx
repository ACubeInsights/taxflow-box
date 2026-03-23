export default function AnimatedBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        zIndex: 0,
        background: 'var(--color-surface-lowest)',
      }}
    >
      {/* Orb 1 — primary, top-left */}
      <div
        className="animate-float"
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--color-primary) 18%, transparent) 0%, color-mix(in srgb, var(--color-primary) 6%, transparent) 35%, transparent 70%)',
          top: '-300px',
          left: '-250px',
          filter: 'blur(60px)',
        }}
      />
      {/* Orb 2 — secondary, bottom-right */}
      <div
        className="animate-float-d2"
        style={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--color-secondary) 18%, transparent) 0%, color-mix(in srgb, var(--color-secondary) 6%, transparent) 35%, transparent 70%)',
          bottom: '-250px',
          right: '-200px',
          filter: 'blur(60px)',
        }}
      />
      {/* Orb 3 — tertiary, center */}
      <div
        className="animate-float-d4"
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--color-tertiary) 12%, transparent) 0%, transparent 65%)',
          top: '30%',
          left: '55%',
          filter: 'blur(50px)',
        }}
      />
      {/* Fine grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
          `,
          backgroundSize: '56px 56px',
        }}
      />
      {/* Top-center radial glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 800,
          height: 400,
          background:
            'radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--color-primary) 9%, transparent) 0%, transparent 65%)',
        }}
      />
      {/* Noise vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </div>
  )
}
