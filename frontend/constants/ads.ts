// Canais de contato do responsável por anúncios — para quem prefere negociar
// direto em vez de contratar um plano pelo site.
export interface AdContactChannel {
  key: 'instagram' | 'whatsapp' | 'email';
  label: string;
  icon: string; // nome do ícone Ionicons
  url: string;
}

export const AD_CONTACT_CHANNELS: AdContactChannel[] = [
  { key: 'instagram', label: '@francisco.l0u', icon: 'logo-instagram', url: 'https://instagram.com/francisco.l0u' },
  { key: 'whatsapp', label: '(21) 96705-5617', icon: 'logo-whatsapp', url: 'https://wa.me/5521967055617' },
  { key: 'email', label: 'franciscogardenberg@gmail.com', icon: 'mail-outline', url: 'mailto:franciscogardenberg@gmail.com' },
];
