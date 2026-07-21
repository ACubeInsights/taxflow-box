/**
 * AnimatedBackground — Premium ambient atmosphere layer.
 *
 * Design philosophy: subtlety over spectacle. The background should feel
 * like a living, breathing surface — not a light show. Think: the way
 * expensive materials catch ambient light in a dark room.
 */
export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden z-0 bg-[var(--color-surface-lowest)]">
      {/* Base gradient mesh — warm, directional lighting from top-left */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 10% -10%, rgba(129, 140, 248, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 60% 50% at 90% 100%, rgba(196, 181, 253, 0.05) 0%, transparent 50%),
            radial-gradient(ellipse 50% 40% at 50% 50%, rgba(94, 234, 212, 0.03) 0%, transparent 50%)
          `,
        }}
      />

      {/* Slow-moving gradient blob — subtle, large scale */}
      <div
        className="absolute animate-float-slow"
        style={{
          width: '120%',
          height: '120%',
          top: '-10%',
          left: '-10%',
          background: `
            radial-gradient(ellipse at 20% 30%, rgba(129, 140, 248, 0.04) 0%, transparent 40%),
            radial-gradient(ellipse at 70% 70%, rgba(196, 181, 253, 0.03) 0%, transparent 35%)
          `,
          filter: 'blur(80px)',
        }}
      />

      {/* Fine dot grid — architectural, grounding */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Top edge light — simulates ambient overhead illumination */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.2) 30%, rgba(196, 181, 253, 0.15) 70%, transparent)',
        }}
      />

      {/* Vignette — draws focus to center content */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(9, 9, 11, 0.7) 100%)',
        }}
      />

      {/* Film grain texture — adds materiality */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}
