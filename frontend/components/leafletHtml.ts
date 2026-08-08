// Gera o documento HTML de um mapa Leaflet (OpenStreetMap, sem API key).
// O MESMO HTML roda na web (dentro de <iframe srcDoc>) e no nativo (react-native-webview),
// garantindo visual idêntico nas duas plataformas.

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  title: string;
  description?: string;
  authorName?: string;
  authorAvatar?: string;
  imageUrl?: string;
  // Data de criação (ISO) + vida útil em dias, usados para encolher o pin
  // gradativamente com o tempo (ver CATEGORY_LIFESPAN_DAYS). Se `maxAgeDays`
  // vier ausente/undefined, o pin fica sempre no tamanho normal (ex.: eventos,
  // que já têm vida própria marcada pela data do evento).
  createdAt?: string;
  maxAgeDays?: number;
}

export interface LeafletHtmlOptions {
  center: { latitude: number; longitude: number };
  zoom?: number;
  markers?: MapMarker[];
  interactive?: boolean;
  focusId?: string; // abre o tooltip do marcador com este id ao carregar o mapa
  // Modo "escolher local": qualquer clique no mapa (ou arrastar o pin) manda
  // a coordenada pro app via mensagem, em vez de abrir um post. Usado pelo
  // seletor de local dos posts (ver LocationPickerModal.tsx).
  pickable?: boolean;
  pickedLocation?: { latitude: number; longitude: number } | null;
}

export interface MapBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

// Mensagem enviada do mapa para o app: `id` quando um pin de post é
// selecionado (clique), `latitude`/`longitude` quando um ponto é escolhido no
// modo `pickable` (clique no mapa ou arrastar o pin), `bounds` sempre que a
// área visível muda (pan/zoom) — usado pra rebuscar posts/anúncios só do
// recorte atual (ver (tabs)/map.tsx) e pra saber quais pins de anúncio estão
// realmente na tela (impressão real, não só "foi buscado").
export const MAP_MESSAGE_TYPE = 'daqui-map';

// Mensagem enviada do app PARA o mapa (direção oposta de MAP_MESSAGE_TYPE):
// atualiza os pins sem recarregar a página. Necessário porque `markers` agora
// muda a cada pan/zoom (bounding box novo) — se cada mudança regenerasse o
// HTML inteiro (como antes), o WebView/iframe recarregaria do zero a cada
// vez, perdendo a posição em que o usuário deixou o mapa. Ver
// LeafletMap.tsx/LeafletMap.web.tsx.
export const SET_MARKERS_MESSAGE_TYPE = 'daqui-map-set-markers';

export function buildLeafletHtml(opts: LeafletHtmlOptions): string {
  const {
    center, zoom = 15, markers = [], interactive = true, focusId = null,
    pickable = false, pickedLocation = null,
  } = opts;
  const data = JSON.stringify({
    center: [center.latitude, center.longitude],
    zoom,
    markers,
    interactive,
    focusId,
    pickable,
    pickedLocation,
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #e5e7eb; }
  /* O wrapper mantém a área de 22x22 sempre no lugar (é o que o Leaflet
     posiciona/ancora); só o pin de dentro encolhe com --daqui-scale, então
     "chegar perto" com o mouse já basta pra disparar o :hover e crescer de
     volta ao tamanho normal, mesmo com o pin quase invisível. */
  .daqui-pin-wrap { width: 22px; height: 22px; cursor: pointer; }
  .daqui-pin {
    width: 22px; height: 22px; border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg) scale(var(--daqui-scale, 1));
    border: 2.5px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    transition: transform 0.2s ease-out;
  }
  .daqui-pin-wrap:hover .daqui-pin { transform: rotate(-45deg) scale(1); }
  .daqui-pin::after {
    content: ''; position: absolute; top: 6px; left: 6px;
    width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.9);
  }
  /* Tooltip (card ao passar o mouse) — sem o padding/arrow padrão do Leaflet */
  .leaflet-tooltip.daqui-tip {
    padding: 0; border: none; border-radius: 14px; background: #fff;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18); overflow: hidden; width: 220px;
    white-space: normal; font-family: -apple-system, system-ui, sans-serif;
  }
  .leaflet-tooltip.daqui-tip::before { border-right-color: #fff; }
  .daqui-card-img { width: 100%; height: 96px; object-fit: cover; display: block; background: #e5e7eb; }
  .daqui-card-body { padding: 10px 12px; }
  .daqui-card-title { font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.25;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .daqui-card-desc { font-size: 12px; color: #475569; margin-top: 4px; line-height: 1.35;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .daqui-card-author { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
  .daqui-card-avatar { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; background: #e5e7eb; }
  .daqui-card-name { font-size: 12px; font-weight: 600; color: #334155; }
  .daqui-card-hint { font-size: 11px; font-weight: 700; color: #15803d; margin-top: 8px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<script>
  var CFG = ${data};
  // id pra clique num pin de post; lat/lng pra escolha de ponto no modo
  // pickable — os dois casos nunca acontecem juntos.
  function send(id, lat, lng) {
    var payload = { type: '${MAP_MESSAGE_TYPE}' };
    if (id != null) payload.id = id;
    if (lat != null && lng != null) { payload.latitude = lat; payload.longitude = lng; }
    var msg = JSON.stringify(payload);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); }
    else if (window.parent) { window.parent.postMessage(msg, '*'); }
  }
  function sendBounds() {
    var b = map.getBounds();
    var payload = {
      type: '${MAP_MESSAGE_TYPE}',
      bounds: { south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() },
    };
    var msg = JSON.stringify(payload);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); }
    else if (window.parent) { window.parent.postMessage(msg, '*'); }
  }
  var map = L.map('map', {
    zoomControl: CFG.interactive,
    dragging: CFG.interactive,
    scrollWheelZoom: CFG.interactive,
    doubleClickZoom: CFG.interactive,
    boxZoom: CFG.interactive,
    keyboard: CFG.interactive,
    touchZoom: CFG.interactive,
    tap: CFG.interactive,
    attributionControl: false,
  }).setView(CFG.center, CFG.zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  if (CFG.pickable) {
    var pickIcon = L.divIcon({
      className: '',
      html: '<div class="daqui-pin-wrap"><div class="daqui-pin" style="background:#16A34A"></div></div>',
      iconSize: [22, 22], iconAnchor: [11, 22],
    });
    var pickMarker = null;
    function placePicked(lat, lng) {
      if (pickMarker) { pickMarker.setLatLng([lat, lng]); }
      else { pickMarker = L.marker([lat, lng], { icon: pickIcon, draggable: true }).addTo(map); }
      pickMarker.on('dragend', function () {
        var p = pickMarker.getLatLng();
        send(null, p.lat, p.lng);
      });
    }
    if (CFG.pickedLocation) {
      placePicked(CFG.pickedLocation.latitude, CFG.pickedLocation.longitude);
    }
    map.on('click', function (e) {
      placePicked(e.latlng.lat, e.latlng.lng);
      send(null, e.latlng.lat, e.latlng.lng);
    });
  }

  function buildCard(m) {
    var card = document.createElement('div');
    if (m.imageUrl) {
      var img = document.createElement('img');
      img.className = 'daqui-card-img';
      img.src = m.imageUrl;
      card.appendChild(img);
    }
    var body = document.createElement('div');
    body.className = 'daqui-card-body';
    var title = document.createElement('div');
    title.className = 'daqui-card-title';
    title.textContent = m.title || '';
    body.appendChild(title);
    if (m.description) {
      var desc = document.createElement('div');
      desc.className = 'daqui-card-desc';
      desc.textContent = m.description;
      body.appendChild(desc);
    }
    if (m.authorName) {
      var author = document.createElement('div');
      author.className = 'daqui-card-author';
      if (m.authorAvatar) {
        var av = document.createElement('img');
        av.className = 'daqui-card-avatar';
        av.src = m.authorAvatar;
        author.appendChild(av);
      }
      var nm = document.createElement('span');
      nm.className = 'daqui-card-name';
      nm.textContent = m.authorName;
      author.appendChild(nm);
      body.appendChild(author);
    }
    var hint = document.createElement('div');
    hint.className = 'daqui-card-hint';
    hint.textContent = 'Toque para ver o post →';
    body.appendChild(hint);
    card.appendChild(body);
    return card;
  }

  // Encolhe o pin gradativamente conforme envelhece, até quase sumir perto do
  // fim da vida útil da categoria; sem maxAgeDays/createdAt fica sempre 1
  // (tamanho normal, ex.: eventos).
  var MIN_PIN_SCALE = 0.2;
  function pinScale(m) {
    if (!m.maxAgeDays || !m.createdAt) return 1;
    var ageDays = (Date.now() - new Date(m.createdAt).getTime()) / 86400000;
    var ratio = Math.min(1, Math.max(0, ageDays / m.maxAgeDays));
    return 1 - (1 - MIN_PIN_SCALE) * ratio;
  }

  // Agrupa pins próximos num número quando o zoom está aberto o bastante pra
  // ter muitos ao mesmo tempo na tela (mapa deixou de ser só do bairro, ver
  // (tabs)/map.tsx) — sem isso, centenas de pins de uma vez travam o render.
  var cluster = L.markerClusterGroup({ maxClusterRadius: 60 });
  map.addLayer(cluster);

  // Reaproveitável: recebe uma lista nova de markers e substitui os atuais
  // sem recarregar a página. applyFocus só é true na primeira chamada — nas
  // atualizações seguintes (pan/zoom trazendo posts/anúncios diferentes) não
  // faz sentido reabrir o tooltip do foco original de novo.
  function setMarkers(markersArray, applyFocus) {
    cluster.clearLayers();
    markersArray.forEach(function (m) {
      var icon = L.divIcon({
        className: '',
        html: '<div class="daqui-pin-wrap"><div class="daqui-pin" style="background:' +
          m.color + ';--daqui-scale:' + pinScale(m) + '"></div></div>',
        iconSize: [22, 22], iconAnchor: [11, 22], tooltipAnchor: [12, -11],
      });
      var mk = L.marker([m.latitude, m.longitude], { icon: icon });
      // Card à direita do pin ao passar o mouse (hover); clique abre o post.
      mk.bindTooltip(buildCard(m), {
        direction: 'right', opacity: 1, sticky: false, className: 'daqui-tip',
      });
      mk.on('click', function () { send(m.id); });
      cluster.addLayer(mk);
      if (applyFocus && CFG.focusId && String(m.id) === String(CFG.focusId)) {
        // zoomToShowLayer (não só setView) porque esse marker pode estar
        // agrupado num cluster no zoom inicial — ele cuida de abrir o
        // cluster até o marker aparecer sozinho antes de mostrar o tooltip.
        cluster.zoomToShowLayer(mk, function () { mk.openTooltip(); });
      }
    });
  }
  // Exposta em window pro nativo chamar via injectJavaScript (ver
  // LeafletMap.tsx); a web usa postMessage (handler logo abaixo).
  window.daquiSetMarkers = function (markersArray) { setMarkers(markersArray, false); };
  setMarkers(CFG.markers, true);

  window.addEventListener('message', function (e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data && data.type === '${SET_MARKERS_MESSAGE_TYPE}' && data.markers) {
        setMarkers(data.markers, false);
      }
    } catch (err) { /* ignora mensagens desconhecidas */ }
  });

  map.on('moveend', sendBounds);
  sendBounds();
</script>
</body>
</html>`;
}
