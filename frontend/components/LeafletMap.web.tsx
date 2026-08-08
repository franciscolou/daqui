import { useEffect, useMemo, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import {
  buildLeafletHtml,
  LeafletHtmlOptions,
  MapBounds,
  MAP_MESSAGE_TYPE,
  SET_MARKERS_MESSAGE_TYPE,
} from './leafletHtml';
import { useT } from '../lib/i18n';

export interface LeafletMapProps extends LeafletHtmlOptions {
  onSelectMarker?: (id: string) => void;
  onPick?: (coords: { latitude: number; longitude: number }) => void;
  // Disparado a cada pan/zoom (e uma vez ao carregar) com a área realmente
  // visível — ver (tabs)/map.tsx, que rebusca posts/anúncios por esse recorte
  // em vez de por bairro.
  onBoundsChange?: (bounds: MapBounds) => void;
  style?: StyleProp<ViewStyle>;
}

// Web: renderiza o mapa Leaflet dentro de um <iframe srcDoc> (mesmo HTML do nativo).
export default function LeafletMap({
  onSelectMarker,
  onPick,
  onBoundsChange,
  style,
  ...options
}: LeafletMapProps) {
  const { t } = useT();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // `markers` NÃO entra nas deps do html — ver comentário abaixo do useMemo.
  const html = useMemo(() => buildLeafletHtml(options), [
    options.center.latitude,
    options.center.longitude,
    options.zoom,
    options.interactive,
    options.focusId,
    options.pickable,
    options.pickedLocation?.latitude,
    options.pickedLocation?.longitude,
  ]);

  useEffect(() => {
    if (!onSelectMarker && !onPick && !onBoundsChange) return;
    const handler = (event: MessageEvent) => {
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== MAP_MESSAGE_TYPE) return;
        if (data.bounds) onBoundsChange?.(data.bounds);
        else if (data.id) onSelectMarker?.(String(data.id));
        else if (data.latitude != null && data.longitude != null) {
          onPick?.({ latitude: data.latitude, longitude: data.longitude });
        }
      } catch {
        /* ignora mensagens desconhecidas */
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSelectMarker, onPick, onBoundsChange]);

  // Atualiza os pins sem recarregar o iframe (ver SET_MARKERS_MESSAGE_TYPE em
  // leafletHtml.ts) — necessário porque agora `markers` muda a cada pan/zoom
  // (bounding box novo, ver (tabs)/map.tsx); recarregar o `srcDoc` a cada vez
  // resetaria a posição em que o usuário deixou o mapa. Pula a primeira
  // chamada: o load inicial já usa `options.markers` (embutido no `html`).
  const isFirstMarkers = useRef(true);
  useEffect(() => {
    if (isFirstMarkers.current) {
      isFirstMarkers.current = false;
      return;
    }
    iframeRef.current?.contentWindow?.postMessage(
      { type: SET_MARKERS_MESSAGE_TYPE, markers: options.markers ?? [] },
      '*',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(options.markers)]);

  return (
    <View style={style}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title={t('map.title')}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </View>
  );
}
