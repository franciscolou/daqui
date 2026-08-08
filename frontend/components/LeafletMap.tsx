import { useEffect, useMemo, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { useThemeMode } from '../lib/theme';
import {
  buildLeafletHtml,
  LeafletHtmlOptions,
  MapBounds,
  MAP_MESSAGE_TYPE,
} from './leafletHtml';

export interface LeafletMapProps extends LeafletHtmlOptions {
  onSelectMarker?: (id: string) => void;
  onPick?: (coords: { latitude: number; longitude: number }) => void;
  // Disparado a cada pan/zoom (e uma vez ao carregar) com a área realmente
  // visível — ver (tabs)/map.tsx, que rebusca posts/anúncios por esse recorte
  // em vez de por bairro.
  onBoundsChange?: (bounds: MapBounds) => void;
  style?: StyleProp<ViewStyle>;
}

// Nativo (Android/iOS): renderiza o mapa Leaflet dentro de um WebView.
export default function LeafletMap({
  onSelectMarker,
  onPick,
  onBoundsChange,
  style,
  ...options
}: LeafletMapProps) {
  const { mode, mapMode } = useThemeMode();
  const appearance = mapMode === 'system' ? mode : mapMode;
  const webviewRef = useRef<WebView>(null);
  // `markers` NÃO entra nas deps do html — ver comentário abaixo do useMemo.
  // As opções abaixo são enumeradas de propósito: mudanças nos pins usam a
  // ponte JS e não podem recriar o WebView (isso perderia pan e zoom).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildLeafletHtml({ ...options, appearance }), [
    options.center.latitude,
    options.center.longitude,
    options.zoom,
    options.interactive,
    options.focusId,
    options.pickable,
    options.pickedLocation?.latitude,
    options.pickedLocation?.longitude,
    appearance,
  ]);

  // Atualiza os pins sem recarregar o WebView (ver SET_MARKERS_MESSAGE_TYPE em
  // leafletHtml.ts) — necessário porque agora `markers` muda a cada pan/zoom
  // (bounding box novo, ver (tabs)/map.tsx); recarregar a página a cada vez
  // resetaria a posição em que o usuário deixou o mapa. Pula a primeira
  // chamada: o load inicial já usa `options.markers` (embutido no `html`).
  const isFirstMarkers = useRef(true);
  useEffect(() => {
    if (isFirstMarkers.current) {
      isFirstMarkers.current = false;
      return;
    }
    webviewRef.current?.injectJavaScript(
      `window.daquiSetMarkers && window.daquiSetMarkers(${JSON.stringify(options.markers ?? [])}); true;`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(options.markers)]);

  return (
    <WebView
      ref={webviewRef}
      androidLayerType="hardware"
      originWhitelist={['*']}
      source={{ html }}
      style={style}
      scrollEnabled={false}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data?.type !== MAP_MESSAGE_TYPE) return;
          if (data.bounds) onBoundsChange?.(data.bounds);
          else if (data.id) onSelectMarker?.(String(data.id));
          else if (data.latitude != null && data.longitude != null) {
            onPick?.({ latitude: data.latitude, longitude: data.longitude });
          }
        } catch {
          /* ignora mensagens desconhecidas */
        }
      }}
    />
  );
}
