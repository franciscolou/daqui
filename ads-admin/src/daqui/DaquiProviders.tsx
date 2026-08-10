import { useEffect, useMemo } from 'react';
import { ThemeProvider as DaquiThemeProvider, useThemeMode as useDaquiThemeMode } from '@daqui/lib/theme';
import { GeoProvider, GeoAdapter, GeoResolution, GeoSearchResult } from '@daqui/lib/geoProvider';
import { api } from '../lib/api';
import { useThemeMode } from '../lib/theme';

// Cola entre este painel e os componentes de local do app Daqui
// (LocationAutocompleteInput, LocationPickerModal, NeighborhoodPicker,
// CityPicker). Eles são React Native rodando via react-native-web e dependem
// de dois contextos do app: o tema e o adapter de geocodificação.

/** Espelha o tema do painel no ThemeProvider do Daqui, pra não destoarem. */
function ThemeBridge() {
  const { mode } = useThemeMode();
  const { setMode } = useDaquiThemeMode();
  useEffect(() => {
    setMode(mode);
  }, [mode, setMode]);
  return null;
}

interface NominatimReverse {
  display_name?: string;
  address?: Record<string, string>;
}

// `/geo/resolve` exige um User logado (é escopado ao bairro dele) — não serve
// aqui, onde quem busca é um AdAdmin sem bairro próprio. A geocodificação
// reversa serve só pra mostrar o endereço do ponto clicado no mapa, então o
// Nominatim puro basta.
async function reverseGeocode(latitude: number, longitude: number): Promise<GeoResolution> {
  const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`,
      { headers: { 'Accept-Language': 'pt-BR' } },
    );
    if (!res.ok) throw new Error('reverse falhou');
    const data: NominatimReverse = await res.json();
    const a = data.address || {};
    return {
      neighborhood: (a.suburb || a.neighbourhood || a.quarter || a.city_district || '').trim(),
      city: (a.city || a.town || a.municipality || '').trim(),
      state: (a.state || '').trim(),
      displayName: data.display_name || fallback,
      latitude,
      longitude,
    };
  } catch {
    return {
      neighborhood: '',
      city: '',
      state: '',
      displayName: fallback,
      latitude,
      longitude,
    };
  }
}

export function DaquiProviders({ children }: { children: React.ReactNode }) {
  const adapter = useMemo<GeoAdapter>(
    () => ({
      // Busca de endereço pelo ads-backend (Nominatim + HERE quando o texto
      // tem número de casa, com cache persistente — ver
      // ads-backend/app/services/geo.py). Bater direto no Nominatim não
      // serviria: o anunciante precisa do endereço exato do anúncio, e o
      // Nominatim sozinho costuma não indexar número em rua residencial.
      searchAddress: (query: string) =>
        api.post<GeoSearchResult[]>('/ads-admin/geo/search', { query }).catch(() => []),
      resolveLocation: reverseGeocode,
    }),
    [],
  );

  return (
    <DaquiThemeProvider>
      <ThemeBridge />
      <GeoProvider adapter={adapter}>{children}</GeoProvider>
    </DaquiThemeProvider>
  );
}
