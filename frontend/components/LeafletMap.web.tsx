import { useEffect, useMemo } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import {
  buildLeafletHtml,
  LeafletHtmlOptions,
  MAP_MESSAGE_TYPE,
} from './leafletHtml';

export interface LeafletMapProps extends LeafletHtmlOptions {
  onSelectMarker?: (id: string) => void;
  onPick?: (coords: { latitude: number; longitude: number }) => void;
  style?: StyleProp<ViewStyle>;
}

// Web: renderiza o mapa Leaflet dentro de um <iframe srcDoc> (mesmo HTML do nativo).
export default function LeafletMap({
  onSelectMarker,
  onPick,
  style,
  ...options
}: LeafletMapProps) {
  const html = useMemo(() => buildLeafletHtml(options), [
    options.center.latitude,
    options.center.longitude,
    options.zoom,
    options.interactive,
    options.focusId,
    options.pickable,
    options.pickedLocation?.latitude,
    options.pickedLocation?.longitude,
    JSON.stringify(options.markers),
  ]);

  useEffect(() => {
    if (!onSelectMarker && !onPick) return;
    const handler = (event: MessageEvent) => {
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== MAP_MESSAGE_TYPE) return;
        if (data.id) onSelectMarker?.(String(data.id));
        else if (data.latitude != null && data.longitude != null) {
          onPick?.({ latitude: data.latitude, longitude: data.longitude });
        }
      } catch {
        /* ignora mensagens desconhecidas */
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSelectMarker, onPick]);

  return (
    <View style={style}>
      <iframe
        srcDoc={html}
        title="mapa"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </View>
  );
}
