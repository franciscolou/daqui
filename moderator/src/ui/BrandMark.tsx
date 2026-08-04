import { useId } from 'react';

// Marca do painel de moderação: escudo com check, remetendo à revisão e
// aprovação de conteúdo. Substitui o "d" improvisado do brand-dot.
export function BrandMark({ size = 20 }: { size?: number }) {
  const maskId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
      <mask id={maskId}>
        <rect width="24" height="24" fill="black" />
        <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z" fill="white" />
        <polyline
          points="7.6 12.4 10.4 15.3 16.6 8.4"
          fill="none"
          stroke="black"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </mask>
      <rect width="24" height="24" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}
