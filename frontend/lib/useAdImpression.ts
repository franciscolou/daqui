import { useCallback, useEffect, useRef } from 'react';
import type { ViewToken } from 'react-native';
import { AD_VIEWABILITY_CONFIG } from '../constants/config';
import { Ad, AdFormat, adsApi } from './adsApi';

interface TrackContext {
  viewerId?: string;
  neighborhood?: string;
}

// Loga uma impressão de verdade (`adsApi.trackAdImpression`) só quando o item
// de anúncio dentro de uma FlatList fica de fato visível — não a cada
// fetch/refetch do anúncio (ex.: toda vez que a tela recebe foco de novo).
// `extractAd`/`ctx` podem depender livremente de state/props do componente
// chamador: os valores mais recentes são sincronizados pra um ref num efeito
// (não durante o render, ver regra react-hooks/refs) e lidos de lá dentro do
// callback estável (`useCallback`) devolvido pelo hook.
export function useAdImpressionTracking<T>(
  format: AdFormat,
  extractAd: (item: T) => Ad | null | undefined,
  ctx: TrackContext,
) {
  const extractRef = useRef(extractAd);
  const ctxRef = useRef(ctx);
  useEffect(() => {
    extractRef.current = extractAd;
    ctxRef.current = ctx;
  });

  // Dedup por *ocorrência* na lista (a `key` do item, não o id do anúncio):
  // com rotação, o mesmo anúncio pode legitimamente reaparecer mais adiante
  // na mesma lista (ver lib/adSpacing.ts) — cada ocorrência tem sua própria
  // key (ex.: `ad-${id}-${index}`) e deve logar sua própria impressão.
  const trackedKeysRef = useRef<Set<string>>(new Set());

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      for (const v of viewableItems) {
        const ad = extractRef.current(v.item as T);
        if (!ad || !v.key || trackedKeysRef.current.has(v.key)) continue;
        trackedKeysRef.current.add(v.key);
        adsApi.trackAdImpression(ad.id, {
          viewerId: ctxRef.current.viewerId,
          creativeId: ad.creativeId,
          format,
          neighborhood: ctxRef.current.neighborhood,
        });
      }
    },
    [format],
  );

  return { onViewableItemsChanged, viewabilityConfig: AD_VIEWABILITY_CONFIG };
}
