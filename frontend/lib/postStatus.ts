import { Post } from '../data/mock';

export type PostStatus = 'expired' | 'sold' | 'found';

// Um post pode ganhar um aviso fixo por cima do conteúdo: "Expirado"
// (enquete/evento, calculado — nunca persistido) ou "Vendido"/"Encontrado"
// (venda/perdidos, ação manual do autor — ver PostCard.tsx e
// app/[username]/post/[publicId].tsx, que renderizam PostStatusBanner com
// o valor calculado aqui).
export function getPostStatus(post: Post): PostStatus | null {
  if (post.category === 'venda' && post.resolvedStatus === 'sold') return 'sold';
  if (post.category === 'perdidos' && post.resolvedStatus === 'found') return 'found';
  if (post.category === 'enquete' && post.poll?.closed) return 'expired';
  if (post.category === 'evento' && post.eventDates?.length) {
    // `eventDates` já vem ordenado ascendente do backend (ver
    // services/post.py::_build_details) — o último item é a data mais tardia.
    const lastDate = post.eventDates[post.eventDates.length - 1];
    const today = new Date().toISOString().slice(0, 10);
    if (lastDate < today) return 'expired';
  }
  return null;
}
