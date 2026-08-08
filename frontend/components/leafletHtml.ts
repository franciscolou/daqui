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
  .maplibregl-popup { z-index: 5; }
  .maplibregl-popup-content { padding: 0; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); box-shadow: 0 12px 32px var(--shadow); overflow: hidden; width: 224px; cursor: pointer; }
  /* Cobre a seta em qualquer orientação (o popup agora fica sempre ao lado
     do pin, mas o MapLibre pode escolher left/right/top/bottom conforme o
     espaço disponível perto das bordas do mapa). */
  .maplibregl-popup-tip {
    border-top-color: var(--surface) !important;
    border-bottom-color: var(--surface) !important;
    border-left-color: var(--surface) !important;
    border-right-color: var(--surface) !important;
    filter: drop-shadow(0 2px 3px var(--shadow));
  }
  .daqui-card-img { width: 100%; height: 104px; object-fit: cover; display: block; background: var(--border); }
  .daqui-card-body { padding: 12px 14px; }
  .daqui-card-title { font-size: 14px; font-weight: 700; color: var(--text); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .daqui-card-desc { font-size: 12px; color: var(--muted); margin-top: 4px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .daqui-card-author { display: flex; align-items: center; gap: 6px; margin-top: 9px; }
  .daqui-card-avatar { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; background: var(--border); }
  .daqui-card-name { font-size: 12px; font-weight: 600; color: var(--muted); }
  .daqui-card-hint { font-size: 11px; font-weight: 700; color: var(--green); margin-top: 9px; display: flex; align-items: center; gap: 3px; }
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
  // Pin "ativo": tem o balão aberto e fica no tamanho normal (ignora o
  // encolhimento por idade) — no mouse é o pin em hover, no touch é o pin
  // tocado (ver IS_TOUCH mais abaixo).
  var activePinId = null;
  // Pointer grosso (dedo) = trata como touch: mostra o balão ao tocar em vez
  // de ao passar o mouse, e só navega num segundo toque (no pin ou no balão).
  var IS_TOUCH = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

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

  // Pins muito próximos (mesmo endereço/POI, por exemplo) colidiriam e
  // ficariam ilegíveis. Agrupa por proximidade geográfica (algoritmo simples:
  // O(n²), de sobra pra dezenas/poucas centenas de pins por viewport) e
  // decide como representar cada grupo — ver features() abaixo.
  var NEARBY_METERS = 12; // abaixo disso, dois pins "colidem"
  var FAN_METERS = 6; // raio do leque quando poucos pins colidem
  var STACK_THRESHOLD = 6; // acima disso, vira símbolo de pilha em vez de leque
  function metersToDegrees(meters, lat) {
    return {
      lat: meters / 111320,
      lng: meters / (111320 * Math.cos((lat * Math.PI) / 180) || 1),
    };
  }
  function groupMarkers(markers) {
    var groups = [];
    var used = new Array(markers.length).fill(false);
    for (var i = 0; i < markers.length; i++) {
      if (used[i]) continue;
      var group = [markers[i]];
      used[i] = true;
      var deg = metersToDegrees(NEARBY_METERS, markers[i].latitude);
      for (var j = i + 1; j < markers.length; j++) {
        if (used[j]) continue;
        if (Math.abs(markers[j].latitude - markers[i].latitude) <= deg.lat &&
            Math.abs(markers[j].longitude - markers[i].longitude) <= deg.lng) {
          group.push(markers[j]);
          used[j] = true;
        }
      }
      groups.push(group);
    }
    return groups;
  }
  function groupCentroid(group) {
    var lat = 0, lng = 0;
    group.forEach(function (m) { lat += m.latitude; lng += m.longitude; });
    return { latitude: lat / group.length, longitude: lng / group.length };
  }

  function features(markers) {
    markerById = {};
    var out = [];
    groupMarkers(markers || []).forEach(function (group) {
      group.forEach(function (m) { markerById[String(m.id)] = m; });
      // Grupo grande demais pro leque de pins individuais couber: vira um
      // símbolo de "pilha" só — ao tocar, a tela do mapa lista os posts
      // agrupados em vez de abrir um deles direto (ver daqui-stacks abaixo).
      if (group.length > STACK_THRESHOLD) {
        var centroid = groupCentroid(group);
        var ids = group.map(function (m) { return String(m.id); });
        out.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [centroid.longitude, centroid.latitude] },
          properties: {
            kind: 'stack', id: 'stack-' + ids.join('-'), color: group[0].color,
            count: group.length, ids: JSON.stringify(ids),
          },
        });
        return;
      }
      // Poucos pins colidindo: espalha num pequeno leque ao redor do centro
      // do grupo (offset geográfico — na direção "disponível" de cada um,
      // repartida em ângulos iguais). Cada um continua um pin individual
      // normal, só a coordenada de desenho muda.
      var fanDeg = group.length > 1 ? metersToDegrees(FAN_METERS, group[0].latitude) : null;
      group.forEach(function (m, idx) {
        var lat = m.latitude, lng = m.longitude;
        if (fanDeg) {
          var angle = (2 * Math.PI * idx) / group.length;
          lat += Math.sin(angle) * fanDeg.lat;
          lng += Math.cos(angle) * fanDeg.lng;
        }
        // Enquanto ativo (hover no mouse, ou tocado no touch), ignora o
        // encolhimento por idade — mesmo efeito do :hover do pin em CSS na
        // versão Leaflet antiga. icon-size é layout (não paint), então
        // feature-state não é uma opção aqui (só funciona em paint
        // properties); a saída mais simples é recalcular o scale desse
        // marker e re-mandar pro source via setData (ver setActivePin).
        var scale = String(m.id) === activePinId ? 1 : pinScale(m);
        out.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { kind: 'pin', id: String(m.id), color: m.color, scale: scale },
        });
      });
    });
    return out;
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
  var iconPromises = {};
  function loadSvgIcon(name, svg) {
    if (iconPromises[name]) return iconPromises[name];
    var img = new Image();
    var promise = new Promise(function (resolve) {
      img.onload = function () {
        if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
        resolve(name);
      };
    });
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    iconPromises[name] = promise;
    return promise;
  }
  function pinIconNameFor(color) { return 'pin-' + String(color).replace('#', ''); }
  function ensurePinIcon(color) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64" viewBox="0 0 384 512">' +
      '<path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0z" fill="' + color + '" stroke="#fff" stroke-width="18"/>' +
      '<circle cx="192" cy="190" r="72" fill="rgba(255,255,255,0.92)"/>' +
      '</svg>';
    return loadSvgIcon(pinIconNameFor(color), svg);
  }
  // Símbolo de "pilha": forma de crachá arredondado (bem diferente da gota
  // do pin e do círculo do cluster) pra sinalizar "vários pins aqui" — o
  // número por cima é um symbol layer de texto à parte (ver daqui-stack-count),
  // do mesmo jeito que o contador do cluster, então não precisa de um ícone
  // por combinação de cor+contagem.
  function stackIconNameFor(color) { return 'stack-' + String(color).replace('#', ''); }
  function ensureStackIcon(color) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">' +
      '<rect x="5" y="5" width="46" height="46" rx="15" fill="' + color + '" stroke="#fff" stroke-width="3.5"/>' +
      '</svg>';
    return loadSvgIcon(stackIconNameFor(color), svg);
  }
  function ensureIconsFor(markers) {
    var seen = {};
    markers.forEach(function (m) { seen[m.color] = true; });
    Object.keys(seen).forEach(function (color) {
      ensurePinIcon(color);
      ensureStackIcon(color);
    });
  }

  var map = new maplibregl.Map({
    container: 'map',
    style: CFG.appearance === 'dark'
      ? 'https://tiles.openfreemap.org/styles/dark'
      : 'https://tiles.openfreemap.org/styles/liberty',
    center: CFG.center,
    zoom: CFG.zoom,
    interactive: CFG.interactive,
    // No touch, tocar duas vezes NO MESMO pin é o gesto que confirma e
    // navega (ver addMarkerLayers). Isso colide com o double-tap-to-zoom
    // padrão do MapLibre: com ele ligado, o segundo toque é interpretado
    // como parte de um double-click e o evento 'click' do 2º toque nunca
    // chega nos handlers por pin — desligar aqui evita essa disputa.
    doubleClickZoom: !IS_TOUCH,
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
        // line-opacity bem abaixo de 1: a cor cheia (principalmente a de via
        // principal, mais saturada) competia com o nome da rua escrito por
        // cima, poluindo o mapa e prejudicando a leitura do label. 0.75/0.8
        // ainda ficou forte demais — cortado bem mais.
        if (layer.type === 'line' && /motorway|freeway|trunk/.test(key)) {
          map.setPaintProperty(layer.id, 'line-color', colors.motorway);
          map.setPaintProperty(layer.id, 'line-opacity', 0.45);
        } else if (layer.type === 'line' && /primary/.test(key)) {
          map.setPaintProperty(layer.id, 'line-color', colors.primary);
          map.setPaintProperty(layer.id, 'line-opacity', 0.45);
        } else if (layer.type === 'line' && /secondary|tertiary/.test(key)) {
          map.setPaintProperty(layer.id, 'line-color', colors.secondary);
          map.setPaintProperty(layer.id, 'line-opacity', 0.55);
        }
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

  // O popup agora sempre abre AO LADO do pin (nunca em cima — ficava cortado
  // pela gota, que é bem mais alta que o offset antigo previa). Escolhe
  // left/right conforme o pin estiver na metade esquerda/direita da tela,
  // pra não estourar a borda do mapa.
  function popupAnchorFor(lngLat) {
    var point = map.project(lngLat);
    var width = map.getCanvas().clientWidth;
    return point.x > width / 2 ? 'right' : 'left';
  }
  function setActivePin(id) {
    if (activePinId === id) return;
    activePinId = id;
    if (map.getSource('daqui-markers')) map.getSource('daqui-markers').setData(geojson(CFG.markers));
  }
  function hidePinPopup() {
    if (hoverPopup) { hoverPopup.remove(); hoverPopup = null; }
  }
  // O balão vive num elemento à parte do pin (fora do canvas), então sair do
  // pin em direção ao balão já dispara mouseleave do pin antes do cursor
  // chegar lá — sem isso, nunca dava tempo de tocar no balão com o mouse.
  // Um pequeno atraso cancelável (mesmo truque de "hover intent" de qualquer
  // menu com submenu) resolve: só fecha de verdade se o cursor não aparecer
  // nem no pin nem no balão dentro da folga.
  var hideTimer = null;
  function cancelHidePopup() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }
  function scheduleHidePopup() {
    cancelHidePopup();
    hideTimer = setTimeout(function () { setActivePin(null); hidePinPopup(); }, 150);
  }
  function showPinPopup(id, coordinates) {
    var marker = markerById[id]; if (!marker) return;
    hidePinPopup();
    var card = buildCard(marker);
    // Tocar/clicar no balão também navega pro post — vale tanto no touch
    // (onde é a única forma de confirmar, já que o 1º toque só abre o balão)
    // quanto no mouse (atalho a mais, sem contradizer o clique direto no pin).
    card.addEventListener('click', function () { post({ id: id }); });
    if (!IS_TOUCH) {
      card.addEventListener('mouseenter', cancelHidePopup);
      card.addEventListener('mouseleave', scheduleHidePopup);
    }
    hoverPopup = new maplibregl.Popup({
      closeButton: false, closeOnClick: false, anchor: popupAnchorFor(coordinates),
      offset: { left: [12, -20], right: [-12, -20] },
    }).setLngLat(coordinates).setDOMContent(card).addTo(map);
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
    map.addLayer({ id: 'daqui-pins', type: 'symbol', source: 'daqui-markers', filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'kind'], 'pin']], layout: {
      'icon-image': ['concat', 'pin-', ['slice', ['get', 'color'], 1]],
      'icon-size': ['get', 'scale'],
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    }});
    // "Pilha": vários pins colidindo no mesmo lugar (ver STACK_THRESHOLD em
    // features()) — crachá arredondado (não gota, não círculo) com o total.
    map.addLayer({ id: 'daqui-stacks', type: 'symbol', source: 'daqui-markers', filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'kind'], 'stack']], layout: {
      'icon-image': ['concat', 'stack-', ['slice', ['get', 'color'], 1]],
      'icon-anchor': 'center',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    }});
    map.addLayer({ id: 'daqui-stack-count', type: 'symbol', source: 'daqui-markers', filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'kind'], 'stack']], layout: {
      'text-field': ['get', 'count'], 'text-font': ['Noto Sans Bold'], 'text-size': 13,
      'text-allow-overlap': true, 'text-ignore-placement': true,
    }, paint: { 'text-color': '#FFFFFF' }});

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
    // Clica na pilha: não dá pra abrir um post só (são vários no mesmo
    // lugar) — manda a lista de ids pro app mostrar embaixo do mapa.
    map.on('click', 'daqui-stacks', function (e) {
      var feature = e.features && e.features[0]; if (!feature) return;
      var ids; try { ids = JSON.parse(feature.properties.ids || '[]'); } catch (_) { ids = []; }
      post({ stackIds: ids });
    });
    map.on('mouseenter', 'daqui-stacks', function () { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'daqui-stacks', function () { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'daqui-clusters', function () { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'daqui-clusters', function () { map.getCanvas().style.cursor = ''; });

    if (IS_TOUCH) {
      // Touch: 1º toque no pin abre o balão (não navega ainda); tocar de
      // novo no MESMO pin (ou no balão) navega; tocar fora fecha o balão
      // (ver o map.on('click') geral, mais abaixo).
      map.on('click', 'daqui-pins', function (e) {
        var feature = e.features && e.features[0]; if (!feature) return;
        var id = String(feature.properties.id);
        if (activePinId === id) { post({ id: id }); return; }
        setActivePin(id);
        showPinPopup(id, feature.geometry.coordinates);
      });
    } else {
      map.on('mouseenter', 'daqui-pins', function (e) {
        map.getCanvas().style.cursor = 'pointer';
        cancelHidePopup();
        var feature = e.features && e.features[0]; if (!feature) return;
        var id = String(feature.properties.id);
        setActivePin(id);
        showPinPopup(id, feature.geometry.coordinates);
      });
      map.on('mouseleave', 'daqui-pins', function () {
        map.getCanvas().style.cursor = '';
        scheduleHidePopup();
      });
      map.on('click', 'daqui-pins', function (e) {
        var feature = e.features && e.features[0]; if (feature) post({ id: String(feature.properties.id) });
      });
    }
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
    // Já marca o pin de foco como ativo (tamanho normal) antes do source
    // nascer, senão ele apareceria encolhido por idade num primeiro frame.
    // markerById só é populado dentro de addMarkerLayers → geojson →
    // features(), então nesse ponto ainda não dá pra confirmar que o id
    // existe de fato — inofensivo se não existir (activePinId só compara).
    if (CFG.focusId) activePinId = String(CFG.focusId);
    addMarkerLayers();
    if (CFG.pickable && CFG.pickedLocation) placePicked(CFG.pickedLocation.longitude, CFG.pickedLocation.latitude, false);
    if (CFG.focusId && markerById[String(CFG.focusId)]) {
      var focused = markerById[String(CFG.focusId)];
      map.easeTo({ center: [focused.longitude, focused.latitude], zoom: Math.max(map.getZoom(), 17) });
      showPinPopup(String(CFG.focusId), [focused.longitude, focused.latitude]);
    }
    sendBounds();
  });
  map.on('moveend', sendBounds);
  map.on('click', function (e) {
    if (CFG.pickable) {
      var hits = map.queryRenderedFeatures(e.point, { layers: ['daqui-pins', 'daqui-clusters', 'daqui-stacks'] });
      if (!hits.length) placePicked(e.lngLat.lng, e.lngLat.lat, true);
      return;
    }
    // Touch: tocar fora do pin ativo (e fora do próprio balão, que não faz
    // parte do canvas e por isso nunca dispara esse clique) fecha o balão.
    if (IS_TOUCH && activePinId !== null) {
      var pinHits = map.queryRenderedFeatures(e.point, { layers: ['daqui-pins'] });
      if (!pinHits.length) { activePinId = null; map.getSource('daqui-markers').setData(geojson(CFG.markers)); hidePinPopup(); }
    }
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
