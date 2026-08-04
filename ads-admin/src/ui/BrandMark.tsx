// Marca do painel de anúncios: auto-falante, remetendo à divulgação de
// campanhas. Substitui o "d" improvisado do brand-dot.
export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      <path
        d="M2 10.5a1.5 1.5 0 0 1 1.5-1.5H6l7.2-4.6A1 1 0 0 1 14.7 5.3V18.7a1 1 0 0 1-1.5.87L6 15H3.5A1.5 1.5 0 0 1 2 13.5v-3z"
        fill="currentColor"
      />
      <path d="M6 15v4.2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V16" fill="currentColor" />
      <path d="M17.2 8.4c1.3 1 1.3 6.2 0 7.2" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      <path d="M19.6 6.2c2.5 2.3 2.5 9.3 0 11.6" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  );
}
