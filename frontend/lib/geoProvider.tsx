// Ponte entre os componentes de local (LocationAutocompleteInput,
// LocationPickerModal) e QUAL backend responde pelas buscas de endereço.
//
// Por que existe: os mesmos componentes rodam em dois apps com backends e
// autenticações diferentes — o Daqui (backend :8000, token do usuário, busca
// restrita ao bairro dele) e o painel ads-admin (ads-backend :8001, token de
// admin, busca livre no Brasil). Em vez de importar `lib/api` direto (o que
// amarraria os componentes ao Daqui e arrastaria o cliente HTTP inteiro pro
// bundle do painel), eles pedem as funções a este contexto.
//
// Quem monta a árvore decide a implementação: o app Daqui em `app/_layout.tsx`
// (ver `DaquiGeoProvider` abaixo), o ads-admin no seu próprio provider.

import { createContext, useContext, useMemo } from 'react';

export interface GeoSearchResult {
  latitude: number;
  longitude: number;
  label: string;
}

export interface GeoResolution {
  neighborhood: string;
  city: string;
  state: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

export interface GeoAdapter {
  /** Autocomplete de endereço (texto → lista de candidatos com coordenadas). */
  searchAddress: (query: string) => Promise<GeoSearchResult[]>;
  /** Geocodificação reversa (ponto do mapa → endereço legível + bairro). */
  resolveLocation: (latitude: number, longitude: number) => Promise<GeoResolution>;
}

const GeoContext = createContext<GeoAdapter | null>(null);

export function GeoProvider({
  adapter,
  children,
}: {
  adapter: GeoAdapter;
  children: React.ReactNode;
}) {
  // `adapter` costuma ser um objeto literal recriado a cada render de quem
  // monta o provider; memoizar pelas duas funções evita re-render em cascata
  // nos consumidores.
  const value = useMemo(
    () => adapter,
    [adapter.searchAddress, adapter.resolveLocation], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return <GeoContext.Provider value={value}>{children}</GeoContext.Provider>;
}

export function useGeo(): GeoAdapter {
  const ctx = useContext(GeoContext);
  if (!ctx) {
    throw new Error('useGeo precisa de um <GeoProvider> acima na árvore.');
  }
  return ctx;
}
