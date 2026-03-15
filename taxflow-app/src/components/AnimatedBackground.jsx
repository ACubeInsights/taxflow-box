export default function AnimatedBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        zIndex: 0,
        background: '#050508',
      }}
    >
      {/* Orb 1 — cyan, top-left */}
      <div
        className="animate-float"
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(6,182,212,0.18) 0%, rgba(6,182,212,0.06) 35%, transparent 70%)',
          top: '-300px',
          left: '-250px',
          filter: 'blur(60px)',
        }}
      />
      {/* Orb 2 — indigo, bottom-right */}
      <div
        className="animate-float-d2"
        style={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.06) 35%, transparent 70%)',
          bottom: '-250px',
          right: '-200px',
          filter: 'blur(60px)',
        }}
      />
      {/* Orb 3 — violet, center */}
      <div
        className="animate-float-d4"
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 65%)',
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
            'radial-gradient(ellipse at 50% 0%, rgba(6,182,212,0.09) 0%, transparent 65%)',
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
