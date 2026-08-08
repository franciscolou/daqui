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
import { useThemeMode } from '../lib/theme';

export interface LeafletMapProps extends LeafletHtmlOptions {
  onSelectMarker?: (id: string) => void;
  onPick?: (coords: { latitude: number; longitude: number }) => void;
  // Disparado a cada pan/zoom (e uma vez ao carregar) com a área realmente
  // visível — ver (tabs)/map.tsx, que rebusca posts/anúncios por esse recorte
  // em vez de por bairro.
  onBoundsChange?: (bounds: MapBounds) => void;
  // Disparado ao tocar num símbolo de "pilha" (vários pins colidindo no
  // mesmo lugar, ver STACK_THRESHOLD em leafletHtml.ts) — vem com os ids dos
  // posts agrupados ali, pra tela listar embaixo do mapa em vez de abrir um
  // post só.
  onSelectStack?: (ids: string[]) => void;
  style?: StyleProp<ViewStyle>;
}

// Web: renderiza o mapa Leaflet dentro de um <iframe> (mesmo HTML do nativo),
// servido via Blob URL (ver comentário abaixo do useMemo de `htmlBlobUrl`).
export default function LeafletMap({
  onSelectMarker,
  onPick,
  onBoundsChange,
  onSelectStack,
  style,
  ...options
}: LeafletMapProps) {
  const { t } = useT();
  const { mode, mapMode } = useThemeMode();
  const appearance = mapMode === 'system' ? mode : mapMode;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // `markers` NÃO entra nas deps do html — ver comentário abaixo do useMemo.
  // As opções abaixo são enumeradas de propósito: mudanças nos pins usam a
  // ponte JS e não podem recriar o iframe (isso perderia pan e zoom).
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

  // O documento de um iframe `srcDoc` tem URL "about:srcdoc" (origin "null")
  // — o worker do MapLibre usa essa URL ao se registrar e, com ela, nunca
  // mais responde a nenhuma mensagem (nem carregamento de tile), deixando o
  // mapa "carregando" pra sempre. Servir o mesmo HTML via Blob URL dá ao
  // iframe uma URL de verdade (mesma origem) e resolve isso.
  const htmlBlobUrl = useMemo(() => {
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [html]);
  useEffect(() => {
    return () => URL.revokeObjectURL(htmlBlobUrl);
  }, [htmlBlobUrl]);

  useEffect(() => {
    if (!onSelectMarker && !onPick && !onBoundsChange && !onSelectStack) return;
    const handler = (event: MessageEvent) => {
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== MAP_MESSAGE_TYPE) return;
        if (data.bounds) onBoundsChange?.(data.bounds);
        else if (data.stackIds) onSelectStack?.(data.stackIds.map(String));
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
  }, [onSelectMarker, onPick, onBoundsChange, onSelectStack]);

  // Atualiza os pins sem recarregar o iframe (ver SET_MARKERS_MESSAGE_TYPE em
  // leafletHtml.ts) — necessário porque agora `markers` muda a cada pan/zoom
  // (bounding box novo, ver (tabs)/map.tsx); recarregar o iframe a cada vez
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
        src={htmlBlobUrl}
        title={t('map.title')}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </View>
  );
}
