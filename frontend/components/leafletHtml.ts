// Gera o documento do mapa vetorial MapLibre. O mesmo HTML roda no iframe
// (web) e no WebView (Android/iOS), sem API key e com dados OpenStreetMap.

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
  createdAt?: string;
  maxAgeDays?: number;
}

export interface LeafletHtmlOptions {
  center: { latitude: number; longitude: number };
  zoom?: number;
  markers?: MapMarker[];
  interactive?: boolean;
  focusId?: string;
  pickable?: boolean;
  pickedLocation?: { latitude: number; longitude: number } | null;
  appearance?: 'light' | 'dark';
}

export interface MapBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export const MAP_MESSAGE_TYPE = 'daqui-map';
export const SET_MARKERS_MESSAGE_TYPE = 'daqui-map-set-markers';

export function buildLeafletHtml(opts: LeafletHtmlOptions): string {
  const {
    center,
    zoom = 15,
    markers = [],
    interactive = true,
    focusId = null,
    pickable = false,
    pickedLocation = null,
    appearance = 'light',
  } = opts;
  const data = JSON.stringify({
    center: [center.longitude, center.latitude],
    zoom,
    markers,
    interactive,
    focusId,
    pickable,
    pickedLocation,
    appearance,
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.0/dist/maplibre-gl.css" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap" />
<style>
  :root {
    --surface: ${appearance === 'dark' ? '#111A2E' : '#FFFFFF'};
    --text: ${appearance === 'dark' ? '#F1F5F9' : '#0F172A'};
    --muted: ${appearance === 'dark' ? '#9FB0C3' : '#475569'};
    --border: ${appearance === 'dark' ? '#2D3B55' : '#DCE7DF'};
    --green: ${appearance === 'dark' ? '#4ADE80' : '#15803D'};
    --shadow: ${appearance === 'dark' ? 'rgba(0,0,0,.48)' : 'rgba(15,23,42,.16)'};
  }
  html, body, #map { height: 100%; width: 100%; margin: 0; background: ${appearance === 'dark' ? '#0B1220' : '#EDF5EF'}; font-family: "Bricolage Grotesque", system-ui, sans-serif; }
  .maplibregl-popup-content { padding: 0; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); box-shadow: 0 8px 24px var(--shadow); overflow: hidden; width: 220px; }
  .maplibregl-popup-tip { border-right-color: var(--surface) !important; }
  .daqui-card-img { width: 100%; height: 96px; object-fit: cover; display: block; background: var(--border); }
  .daqui-card-body { padding: 10px 12px; }
  .daqui-card-title { font-size: 14px; font-weight: 700; color: var(--text); line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .daqui-card-desc { font-size: 12px; color: var(--muted); margin-top: 4px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .daqui-card-author { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
  .daqui-card-avatar { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; background: var(--border); }
  .daqui-card-name { font-size: 12px; font-weight: 600; color: var(--muted); }
  .daqui-card-hint { font-size: 11px; font-weight: 700; color: var(--green); margin-top: 8px; }
  .maplibregl-ctrl-group { background: var(--surface); border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow); }
  .maplibregl-ctrl-group button + button { border-top-color: var(--border); }
  .maplibregl-ctrl button .maplibregl-ctrl-icon { filter: ${appearance === 'dark' ? 'invert(1) brightness(1.35)' : 'none'}; }
  .maplibregl-ctrl-attrib { background: ${appearance === 'dark' ? 'rgba(11,18,32,.86)' : 'rgba(255,255,255,.88)'} !important; color: var(--muted); }
  .maplibregl-ctrl-attrib a { color: var(--green); }
  .daqui-pick-pin { width: 24px; height: 24px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: #16A34A; border: 3px solid #fff; box-shadow: 0 3px 8px rgba(0,0,0,.35); }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.0/dist/maplibre-gl.js"></script>
<script>
  var CFG = ${data};
  var markerById = {};
  var hoverPopup = null;
  var pickMarker = null;
  var hoveredPinId = null;

  function post(payload) {
    payload.type = '${MAP_MESSAGE_TYPE}';
    var msg = JSON.stringify(payload);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    else if (window.parent) window.parent.postMessage(msg, '*');
  }
  function sendBounds() {
    var b = map.getBounds();
    post({ bounds: { south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() } });
  }
  // Nunca encolhe abaixo de 45% do tamanho normal — perto disso o pin vira
  // um pontinho difícil de ver/tocar, então a "quase expiração" já basta
  // pra sinalizar (não precisa chegar a quase sumir).
  var MIN_PIN_SCALE = 0.45;
  function pinScale(m) {
    if (!m.maxAgeDays || !m.createdAt) return 1;
    var age = (Date.now() - new Date(m.createdAt).getTime()) / 86400000;
    var ratio = Math.min(1, Math.max(0, age / m.maxAgeDays));
    return 1 - (1 - MIN_PIN_SCALE) * ratio;
  }
  function features(markers) {
    markerById = {};
    return markers.map(function (m) {
      markerById[String(m.id)] = m;
      // Enquanto o mouse está em cima, ignora o encolhimento por idade —
      // mesmo efeito do :hover do pin em CSS na versão Leaflet antiga.
      // icon-size é layout (não paint), então feature-state não é uma opção
      // aqui (só funciona em paint properties); a saída mais simples é
      // recalcular o scale desse marker e re-mandar pro source via setData
      // (ver mouseenter/mouseleave de daqui-pins).
      var scale = String(m.id) === hoveredPinId ? 1 : pinScale(m);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [m.longitude, m.latitude] },
        properties: { id: String(m.id), color: m.color, scale: scale },
      };
    });
  }
  function geojson(markers) {
    return { type: 'FeatureCollection', features: features(markers || []) };
  }
  function addText(parent, className, text) {
    var el = document.createElement('div');
    el.className = className;
    el.textContent = text || '';
    parent.appendChild(el);
  }
  function buildCard(m) {
    var card = document.createElement('div');
    if (m.imageUrl) {
      var image = document.createElement('img');
      image.className = 'daqui-card-img'; image.src = m.imageUrl; card.appendChild(image);
    }
    var body = document.createElement('div'); body.className = 'daqui-card-body';
    addText(body, 'daqui-card-title', m.title);
    if (m.description) addText(body, 'daqui-card-desc', m.description);
    if (m.authorName) {
      var author = document.createElement('div'); author.className = 'daqui-card-author';
      if (m.authorAvatar) {
        var avatar = document.createElement('img'); avatar.className = 'daqui-card-avatar'; avatar.src = m.authorAvatar; author.appendChild(avatar);
      }
      var name = document.createElement('span'); name.className = 'daqui-card-name'; name.textContent = m.authorName; author.appendChild(name); body.appendChild(author);
    }
    addText(body, 'daqui-card-hint', 'Toque para ver o post →');
    card.appendChild(body);
    return card;
  }

  // Pin em formato de gota (clássico de mapa) por cor de categoria: MapLibre
  // não desenha essa forma via paint property (só o Leaflet fazia isso com
  // CSS/border-radius), então geramos um ícone SVG por cor sob demanda e
  // registramos com map.addImage — o symbol layer referencia pelo nome.
  var pinIconPromises = {};
  function iconNameFor(color) { return 'pin-' + String(color).replace('#', ''); }
  function ensureIcon(color) {
    var name = iconNameFor(color);
    if (pinIconPromises[name]) return pinIconPromises[name];
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 384 512">' +
      '<path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0z" fill="' + color + '" stroke="#fff" stroke-width="18"/>' +
      '<circle cx="192" cy="190" r="72" fill="rgba(255,255,255,0.92)"/>' +
      '</svg>';
    var img = new Image();
    var promise = new Promise(function (resolve) {
      img.onload = function () {
        if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
        resolve(name);
      };
    });
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    pinIconPromises[name] = promise;
    return promise;
  }
  function ensureIconsFor(markers) {
    var seen = {};
    markers.forEach(function (m) { seen[m.color] = true; });
    Object.keys(seen).forEach(ensureIcon);
  }

  var map = new maplibregl.Map({
    container: 'map',
    style: CFG.appearance === 'dark'
      ? 'https://tiles.openfreemap.org/styles/dark'
      : 'https://tiles.openfreemap.org/styles/liberty',
    center: CFG.center,
    zoom: CFG.zoom,
    interactive: CFG.interactive,
    attributionControl: false,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }));
  if (CFG.interactive) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  function recolorStyle() {
    var dark = CFG.appearance === 'dark';
    var colors = {
      motorway: dark ? '#22C55E' : '#15803D',
      primary: dark ? '#4ADE80' : '#16A34A',
      secondary: dark ? '#6EE7A0' : '#22C55E',
      water: dark ? '#123E4A' : '#9EDFD8',
      waterLine: dark ? '#287281' : '#55BFB6',
      park: dark ? '#163D2B' : '#D5F5DE',
    };
    (map.getStyle().layers || []).forEach(function (layer) {
      var key = (layer.id + ' ' + (layer['source-layer'] || '')).toLowerCase();
      try {
        if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', dark ? '#0B1220' : '#F4F8F5');
        if (layer.type === 'fill' && /water|ocean|lake|river/.test(key)) map.setPaintProperty(layer.id, 'fill-color', colors.water);
        if (layer.type === 'line' && /water|river|stream|canal/.test(key)) map.setPaintProperty(layer.id, 'line-color', colors.waterLine);
        if (layer.type === 'fill' && /park|grass|wood|forest|landcover/.test(key)) map.setPaintProperty(layer.id, 'fill-color', colors.park);
        if (layer.type === 'line' && /motorway|freeway|trunk/.test(key)) map.setPaintProperty(layer.id, 'line-color', colors.motorway);
        else if (layer.type === 'line' && /primary/.test(key)) map.setPaintProperty(layer.id, 'line-color', colors.primary);
        else if (layer.type === 'line' && /secondary|tertiary/.test(key)) map.setPaintProperty(layer.id, 'line-color', colors.secondary);
      } catch (_) {}
    });
  }

  function addRelief() {
    var firstLine = (map.getStyle().layers || []).find(function (layer) { return layer.type === 'line'; });
    map.addSource('daqui-relief', {
      type: 'raster',
      tiles: ['https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 16,
      attribution: 'Relief &copy; <a href="https://www.esri.com/">Esri</a>',
    });
    map.addLayer({
      id: 'daqui-relief',
      type: 'raster',
      source: 'daqui-relief',
      paint: {
        'raster-opacity': CFG.appearance === 'dark' ? 0.16 : 0.11,
        'raster-contrast': 0.2,
        'raster-saturation': -1,
      },
    }, firstLine && firstLine.id);
  }

  function addMarkerLayers() {
    ensureIconsFor(CFG.markers);
    map.addSource('daqui-markers', {
      type: 'geojson', data: geojson(CFG.markers),
      // clusterMaxZoom baixo: o grupo já se desfaz em pins individuais bem
      // antes do zoom de rua, em vez de continuar agrupado até quase o fim.
      cluster: true, clusterRadius: 50, clusterMaxZoom: 13,
    });
    map.addLayer({ id: 'daqui-clusters', type: 'circle', source: 'daqui-markers', filter: ['has', 'point_count'], paint: {
      'circle-color': CFG.appearance === 'dark' ? '#16A34A' : '#22C55E',
      'circle-radius': ['step', ['get', 'point_count'], 18, 20, 22, 100, 27],
      'circle-stroke-width': 3, 'circle-stroke-color': '#FFFFFF',
    }});
    // text-font precisa ser explícito: o padrão do MapLibre não existe nas
    // fontes servidas pelo OpenFreeMap, o que travava o carregamento dos
    // glyphs e deixava clusters E pins invisíveis (nada do source renderiza
    // enquanto um symbol layer fica esperando uma fonte que nunca chega).
    map.addLayer({ id: 'daqui-cluster-count', type: 'symbol', source: 'daqui-markers', filter: ['has', 'point_count'], layout: {
      'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 12,
    }, paint: { 'text-color': '#FFFFFF' }});
    map.addLayer({ id: 'daqui-pins', type: 'symbol', source: 'daqui-markers', filter: ['!', ['has', 'point_count']], layout: {
      'icon-image': ['concat', 'pin-', ['slice', ['get', 'color'], 1]],
      'icon-size': ['get', 'scale'],
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    }});

    // Clica no cluster: em vez de só pular pro "próximo zoom onde ele se
    // separa" (podia deixar pins de fora se estivessem espalhados), busca
    // as folhas de verdade e ajusta a câmera pra caber todas elas.
    map.on('click', 'daqui-clusters', async function (e) {
      var feature = e.features && e.features[0]; if (!feature) return;
      var source = map.getSource('daqui-markers');
      var leaves = await source.getClusterLeaves(feature.properties.cluster_id, feature.properties.point_count, 0);
      if (!leaves.length) return;
      var bounds = new maplibregl.LngLatBounds();
      leaves.forEach(function (leaf) { bounds.extend(leaf.geometry.coordinates); });
      map.fitBounds(bounds, { padding: 60, maxZoom: 18, duration: 500 });
    });
    map.on('click', 'daqui-pins', function (e) {
      var feature = e.features && e.features[0]; if (feature) post({ id: String(feature.properties.id) });
    });
    map.on('mouseenter', 'daqui-pins', function (e) {
      map.getCanvas().style.cursor = 'pointer';
      var feature = e.features && e.features[0]; if (!feature) return;
      hoveredPinId = String(feature.properties.id);
      map.getSource('daqui-markers').setData(geojson(CFG.markers));
      var marker = markerById[hoveredPinId]; if (!marker) return;
      if (hoverPopup) hoverPopup.remove();
      hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14 })
        .setLngLat(feature.geometry.coordinates).setDOMContent(buildCard(marker)).addTo(map);
    });
    map.on('mouseleave', 'daqui-pins', function () {
      map.getCanvas().style.cursor = '';
      if (hoveredPinId !== null) {
        hoveredPinId = null;
        map.getSource('daqui-markers').setData(geojson(CFG.markers));
      }
      if (hoverPopup) { hoverPopup.remove(); hoverPopup = null; }
    });
    map.on('mouseenter', 'daqui-clusters', function () { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'daqui-clusters', function () { map.getCanvas().style.cursor = ''; });
  }

  function placePicked(lng, lat, notify) {
    if (!pickMarker) {
      var element = document.createElement('div'); element.className = 'daqui-pick-pin';
      pickMarker = new maplibregl.Marker({ element: element, draggable: true, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map);
      pickMarker.on('dragend', function () { var p = pickMarker.getLngLat(); post({ latitude: p.lat, longitude: p.lng }); });
    } else pickMarker.setLngLat([lng, lat]);
    if (notify) post({ latitude: lat, longitude: lng });
  }

  map.on('load', function () {
    recolorStyle();
    addRelief();
    addMarkerLayers();
    if (CFG.pickable && CFG.pickedLocation) placePicked(CFG.pickedLocation.longitude, CFG.pickedLocation.latitude, false);
    if (CFG.focusId && markerById[String(CFG.focusId)]) {
      var focused = markerById[String(CFG.focusId)];
      map.easeTo({ center: [focused.longitude, focused.latitude], zoom: Math.max(map.getZoom(), 17) });
      hoverPopup = new maplibregl.Popup({ closeButton: false, offset: 14 }).setLngLat([focused.longitude, focused.latitude]).setDOMContent(buildCard(focused)).addTo(map);
    }
    sendBounds();
  });
  map.on('moveend', sendBounds);
  map.on('click', function (e) {
    if (!CFG.pickable) return;
    var hits = map.queryRenderedFeatures(e.point, { layers: ['daqui-pins', 'daqui-clusters'] });
    if (!hits.length) placePicked(e.lngLat.lng, e.lngLat.lat, true);
  });

  window.daquiSetMarkers = function (markers) {
    CFG.markers = markers || [];
    ensureIconsFor(CFG.markers);
    var source = map.getSource('daqui-markers');
    if (source) source.setData(geojson(CFG.markers));
  };
  window.addEventListener('message', function (e) {
    try {
      var message = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (message && message.type === '${SET_MARKERS_MESSAGE_TYPE}' && message.markers) window.daquiSetMarkers(message.markers);
    } catch (_) {}
  });
</script>
</body>
</html>`;
}
