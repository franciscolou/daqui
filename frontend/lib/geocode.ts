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
  // ISO 3166-1 alpha-2 em minúsculas (ex.: "br") — usado pra barrar bairros
  // fora do Brasil na seleção por mapa (`reverseNeighborhood`/`reverseCity`
  // não aceitam `countrycodes` como a busca por texto aceita).
  countryCode: string;
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

function extractCountryCode(item: NominatimItem): string {
  return (item.address?.country_code || '').trim().toLowerCase();
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
        countryCode: extractCountryCode(item),
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

/**
 * Bairro de um ponto do mapa, também via Nominatim puro (`/reverse`) — é o
 * lado "clicar no mapa" da seleção de bairros, par de `searchNeighborhoods`.
 * Aqui não precisamos da precisão do geocoder pago: o que sai daqui é o NOME
 * do bairro (um chip de segmentação), não um endereço com número.
 * Devolve `null` quando o ponto não tem bairro identificável (mar, rodovia...).
 */
export async function reverseNeighborhood(
  latitude: number,
  longitude: number,
): Promise<NeighborhoodSuggestion | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=16&lat=${latitude}&lon=${longitude}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    if (!res.ok) return null;
    const item: NominatimItem = await res.json();
    const name = extractName(item);
    if (!name) return null;
    const city = extractCity(item);
    const country = (item.address?.country || '').trim();
    return {
      name,
      city,
      country,
      countryCode: extractCountryCode(item),
      label: [name, city, country].filter(Boolean).join(' · '),
      latitude,
      longitude,
    };
  } catch {
    return null;
  }
}

export interface CitySuggestion {
  // `name` é o que vira chip / é salvo na campanha — precisa bater com o
  // `city` do usuário no backend (match por igualdade de nome, case-insensitive).
  name: string;
  state: string;
  country: string;
  // Ver `NeighborhoodSuggestion.countryCode` — mesmo propósito.
  countryCode: string;
  // Rótulo exibido no dropdown: "Cidade · Estado · País".
  label: string;
  latitude: number;
  longitude: number;
}

function extractState(item: NominatimItem): string {
  return (item.address?.state || '').trim();
}

/**
 * Busca cidades que casem com `query` (usado pelos escopos "cidade toda" e
 * "várias cidades" da segmentação de anúncios — ver CityPicker). Mesma fonte
 * e mesmo espírito de `searchNeighborhoods`, extraindo o nível de cidade em
 * vez de bairro. Deduplica por nome+estado.
 */
export async function searchCities(
  query: string,
  coords?: Coords | null,
): Promise<CitySuggestion[]> {
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
    const out: CitySuggestion[] = [];
    for (const item of data) {
      const name = extractCity(item);
      if (!name) continue;
      const state = extractState(item);
      const country = (item.address?.country || '').trim();
      const dedupeKey = `${name.toLowerCase()}|${state.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({
        name,
        state,
        country,
        countryCode: extractCountryCode(item),
        label: [name, state, country].filter(Boolean).join(' · '),
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

/**
 * Cidade de um ponto do mapa, via Nominatim `/reverse` — lado "clicar no
 * mapa" da seleção de cidades, par de `searchCities`. `zoom=10` pede o nível
 * de detalhe de cidade (par de `zoom=16`/bairro em `reverseNeighborhood`).
 * Devolve `null` quando o ponto não tem cidade identificável (mar, zona rural
 * sem município próximo...).
 */
export async function reverseCity(
  latitude: number,
  longitude: number,
): Promise<CitySuggestion | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=10&lat=${latitude}&lon=${longitude}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    if (!res.ok) return null;
    const item: NominatimItem = await res.json();
    const name = extractCity(item);
    if (!name) return null;
    const state = extractState(item);
    const country = (item.address?.country || '').trim();
    return {
      name,
      state,
      country,
      countryCode: extractCountryCode(item),
      label: [name, state, country].filter(Boolean).join(' · '),
      latitude,
      longitude,
    };
  } catch {
    return null;
  }
}
