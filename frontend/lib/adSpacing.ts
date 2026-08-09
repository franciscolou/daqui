import type { AdGapConfig } from '../constants/config';
import { Ad } from './adsApi';

// Política de espaçamento/rotação de anúncios intercalados numa lista de
// conteúdo orgânico (feed, notificações, conversas — ver uso em
// app/(tabs)/index.tsx, notifications.tsx e messages.tsx).
//
// De propósito simples: depois de mostrar um anúncio, sorteia quantos itens
// orgânicos esperar (dentro de [minGap, maxGap], uniforme — já fica em torno
// do meio do intervalo sem precisar de nenhum viés extra) antes de tentar o
// próximo slot. Cada slot é só uma OPORTUNIDADE: se não sobrar um anúncio
// elegível e não visto há pouco, o slot fica vazio — nunca insiste item a
// item nem repete o mesmo anúncio só pra preencher espaço.
//
// FEED_AD_GAP/MESSAGES_AD_GAP (os parâmetros de fato) ficam em
// constants/config.ts — este arquivo é só o mecanismo.

export type { AdGapConfig };

export function pickGapThreshold(gap: AdGapConfig, rand: () => number = Math.random): number {
  return gap.minGap + Math.round(rand() * (gap.maxGap - gap.minGap));
}

export interface AdSpacingState {
  itemsSinceLastAd: number;
  nextThreshold: number;
}

export function createAdSpacingState(gap: AdGapConfig): AdSpacingState {
  return { itemsSinceLastAd: 0, nextThreshold: pickGapThreshold(gap) };
}

export interface AdRotationState {
  recentAdId: number | null;
  // true = a última tentativa só tinha `recentAdId` como elegível e foi
  // descartada por repetição — a próxima tentativa relaxa a exclusão, senão
  // um inventário de 1 anúncio nunca mais voltaria a aparecer na sessão.
  skippedDueToRepeat: boolean;
}

export function createAdRotationState(): AdRotationState {
  return { recentAdId: null, skippedDueToRepeat: false };
}

// Escolhe o anúncio de um slot já aberto pelo espaçamento, evitando repetir
// o último mostrado — mas só por uma tentativa (ver `skippedDueToRepeat`).
async function pickNextAd(
  rotation: AdRotationState,
  fetchAds: (excludeIds: number[]) => Promise<Ad[]>,
): Promise<Ad | null> {
  const excludeIds = rotation.recentAdId != null && !rotation.skippedDueToRepeat ? [rotation.recentAdId] : [];
  const ads = await fetchAds(excludeIds);
  const ad = ads[0] ?? null;
  if (ad) {
    rotation.recentAdId = ad.id;
    rotation.skippedDueToRepeat = false;
  } else if (excludeIds.length) {
    rotation.skippedDueToRepeat = true;
  }
  return ad;
}

// Chamado uma vez por item orgânico processado. Devolve o anúncio a inserir
// logo depois dele (ou `null` — nada a inserir). Sempre sorteia o próximo
// intervalo quando o slot é avaliado, tenha entrado anúncio ou não, pra
// nunca insistir tentativa a tentativa quando o inventário está curto.
export async function advanceAdSlot(
  scan: AdSpacingState,
  gap: AdGapConfig,
  rotation: AdRotationState,
  fetchAds: (excludeIds: number[]) => Promise<Ad[]>,
): Promise<Ad | null> {
  scan.itemsSinceLastAd += 1;
  if (scan.itemsSinceLastAd < scan.nextThreshold) return null;
  const ad = await pickNextAd(rotation, fetchAds);
  scan.itemsSinceLastAd = 0;
  scan.nextThreshold = pickGapThreshold(gap);
  return ad;
}
