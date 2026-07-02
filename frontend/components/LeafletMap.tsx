import { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  buildLeafletHtml,
  LeafletHtmlOptions,
  MAP_MESSAGE_TYPE,
} from './leafletHtml';

export interface LeafletMapProps extends LeafletHtmlOptions {
  onSelectMarker?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}

// Nativo (Android/iOS): renderiza o mapa Leaflet dentro de um WebView.
export default function LeafletMap({
  onSelectMarker,
  style,
  ...options
}: LeafletMapProps) {
  const html = useMemo(() => buildLeafletHtml(options), [
    options.center.latitude,
    options.center.longitude,
    options.zoom,
    options.interactive,
    JSON.stringify(options.markers),
  ]);

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={style}
      scrollEnabled={false}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data?.type === MAP_MESSAGE_TYPE && data.id) onSelectMarker?.(String(data.id));
        } catch {
          /* ignora mensagens desconhecidas */
        }
      }}
    />
  );
}
