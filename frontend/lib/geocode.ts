// Sugestão de bairros via geocoder público do OpenStreetMap (Nominatim) —
// mesma fonte já usada pelo mapa e pelo painel de ads-admin, sem chave nem
// dependência do backend. Não há lista fixa de bairros no app (são texto
// livre nos modelos), então a busca vem direto do geocoder.
//
// Diferente da versão do ads-admin, aqui:
//  - cada sugestão traz também cidade e país (fica mais fácil distinguir
//    dois bairros de mesmo nome), e
//  - os resultados são ordenados por proximidade de onde o usuário está
//    (quando temos as coordenadas do dispositivo), pra não sugerir primeiro
//    um lugar longe.

import { Coords, haversineMeters } from './location';

export interface NeighborhoodSuggestion {
  // `name` é o que vira chip / é salvo na campanha — precisa bater com o
  // `neighborhood` do usuário no backend (match por igualdade de nome).
  name: string;
  city: string;
  country: string;
  // Rótulo exibido no dropdown: "Bairro · Cidade · País".
  label: string;
  latitude: number;
  longitude: number;
}

interface NominatimItem {
  lat: string;
  lon: string;
  display_name?: string;
  address?: Record<string, string>;
}

function extractName(item: NominatimItem): string {
  const a = item.address || {};
  return (
    a.suburb ||
    a.neighbourhood ||
    a.quarter ||
    a.city_district ||
    a.town ||
    (item.display_name || '').split(',')[0] ||
    ''
  ).trim();
}

function extractCity(item: NominatimItem): string {
  const a = item.address || {};
  return (a.city || a.town || a.municipality || a.city_district || a.state || '').trim();
}

/**
 * Busca bairros que casem com `query`. Quando `coords` é informado, ordena
 * por distância crescente até o usuário. Deduplica por nome+cidade.
 */
export async function searchNeighborhoods(
  query: string,
  coords?: Coords | null,
): Promise<NeighborhoodSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&countrycodes=br&q=' +
      encodeURIComponent(q);
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    if (!res.ok) return [];
    const data: NominatimItem[] = await res.json();

    const seen = new Set<string>();
    const out: NeighborhoodSuggestion[] = [];
    for (const item of data) {
      const name = extractName(item);
      if (!name) continue;
      const city = extractCity(item);
      const country = (item.address?.country || '').trim();
      const dedupeKey = `${name.toLowerCase()}|${city.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({
        name,
        city,
        country,
        label: [name, city, country].filter(Boolean).join(' · '),
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      });
    }

    if (coords) {
      out.sort(
        (a, b) =>
          haversineMeters(coords, { latitude: a.latitude, longitude: a.longitude }) -
          haversineMeters(coords, { latitude: b.latitude, longitude: b.longitude }),
      );
    }
    return out.slice(0, 6);
  } catch {
    return [];
  }
}
