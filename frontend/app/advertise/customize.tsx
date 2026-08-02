import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Switch, Modal, Pressable,
  useWindowDimensions, ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ComponentType } from 'react';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { goBack } from '../../lib/navigation';
import { adsApi, AdFormat, AdObjective, GeoScope, PriceFactor } from '../../lib/adsApi';
import NeighborhoodPicker from '../../components/NeighborhoodPicker';
import CityPicker from '../../components/CityPicker';
import InfoTooltip from '../../components/InfoTooltip';

const FORMATS: { key: AdFormat; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'post', label: 'Post no feed', desc: 'Card no meio do feed do bairro, como um post comum.', icon: 'newspaper-outline' },
  { key: 'map', label: 'Pin no mapa', desc: 'Marca seu ponto no mapa do bairro. Precisa de um endereço.', icon: 'location-outline' },
  { key: 'conversation', label: 'Conversa', desc: 'Linha na aba Mensagens, abre um link ao tocar.', icon: 'chatbubbles-outline' },
  { key: 'notification', label: 'Novidades', desc: 'Item na aba de notificações.', icon: 'notifications-outline' },
  { key: 'search_poster', label: 'Poster de busca', desc: 'Aparece na Busca antes do usuário pesquisar algo.', icon: 'search-outline' },
];

// "post" e "map" são vendidos separados (quem anuncia um app não tem endereço
// pra fixar; quem tem uma loja pode querer só o pin), mas juntos custam menos
// que a soma — o par abaixo é o que a UI destaca como combo. O percentual
// espelha `POST_MAP_BUNDLE_DISCOUNT` em `ads-backend/app/services/ad_pricing.py`;
// o valor economizado de verdade sai sempre da cotação (fator abaixo).
const COMBO_FORMATS: AdFormat[] = ['post', 'map'];
const COMBO_DISCOUNT_PCT = 15;
const COMBO_FACTOR_LABEL = 'Combo post + mapa';

const GEO_SCOPE_OPTIONS: { key: GeoScope; label: string }[] = [
  { key: 'neighborhood', label: 'Bairros' },
  { key: 'citywide', label: 'Cidade toda' },
  { key: 'cities', label: 'Várias cidades' },
  { key: 'country', label: 'Brasil todo' },
];

const DURATION_PRESETS = [7, 15, 30, 90];
// Duração máxima de uma campanha: 720 dias (2 anos) — mesmo limite validado
// em `QuoteRequest`/`CampaignCreateBase` no ads-backend.
const MAX_DURATION_DAYS = 720;

// Escala não-linear do slider de duração: dá espaço proporcional pros
// presets mais comuns (7/15/30/90 dias) em vez de espremê-los nos primeiros
// ~12% de uma escala linear até 720 dias. Cada ponto é [posição 0-1, dias];
// o slider em si é sempre controlado em posição (0-1), convertida pra dias
// pelas funções abaixo.
const DURATION_SCALE: [number, number][] = [
  [0, 1],
  [0.22, 7],
  [0.42, 15],
  [0.62, 30],
  [0.82, 90],
  [1, MAX_DURATION_DAYS],
];

function durationScalePosToDays(pos: number): number {
  const s = DURATION_SCALE;
  if (pos <= s[0][0]) return s[0][1];
  if (pos >= s[s.length - 1][0]) return s[s.length - 1][1];
  for (let i = 0; i < s.length - 1; i++) {
    const [p0, d0] = s[i];
    const [p1, d1] = s[i + 1];
    if (pos <= p1) return Math.round(d0 + ((pos - p0) / (p1 - p0)) * (d1 - d0));
  }
  return s[s.length - 1][1];
}

function durationDaysToScalePos(days: number): number {
  const s = DURATION_SCALE;
  if (days <= s[0][1]) return s[0][0];
  if (days >= s[s.length - 1][1]) return s[s.length - 1][0];
  for (let i = 0; i < s.length - 1; i++) {
    const [p0, d0] = s[i];
    const [p1, d1] = s[i + 1];
    if (days <= d1) return p0 + ((days - d0) / (d1 - d0)) * (p1 - p0);
  }
  return s[s.length - 1][0];
}

// Pontos do gráfico de desconto (espelha `DURATION_DISCOUNT_ANCHORS` em
// `ads-backend/app/services/ad_pricing.py`) — só ilustrativo, não afeta o
// preço de verdade (esse sempre vem da cotação do backend). Eixo X
// categórico (espaçamento igual entre pontos, não proporcional aos dias):
// os patamares vão de 1 a 720 dias, então uma escala real deixaria os 4
// últimos pontos espremidos num canto — assim o formato da curva fica claro.
const DISCOUNT_CHART_POINTS: { days: number; pct: number }[] = [
  { days: 1, pct: 0 },
  { days: 30, pct: 5 },
  { days: 90, pct: 15 },
  { days: 180, pct: 22 },
  { days: 365, pct: 30 },
  { days: 720, pct: 40 },
];

const CHART_W = 320;
const CHART_H = 180;
const CHART_PAD = { top: 26, right: 16, bottom: 32, left: 16 };
const POPOVER_WIDTH = CHART_W + 32; // padding de 16 de cada lado dentro do popover
const POPOVER_HEIGHT_APPROX = CHART_H + 96; // chart + título + legenda + paddings

// react-native-web repassa onMouseMove/onMouseLeave pro elemento, mas os
// tipos de View (focados no nativo) não os declaram (mesmo padrão de
// components/HoverTime.tsx).
type WebViewProps = ViewProps & { onMouseMove?: (e: any) => void; onMouseLeave?: () => void };
const MouseTrackingView = View as unknown as ComponentType<WebViewProps>;

// Gráfico do desconto por duração — maior, interativo: passar o mouse (web)
// ou tocar e arrastar (nativo) em cima da linha mostra num badge flutuante a
// duração e o desconto correspondente naquele ponto, sempre por interpolação
// linear dentro do trecho entre dois patamares — a mesma conta que o backend
// faz de verdade (`ad_pricing.duration_discount`), só que os pontos aqui vêm
// espaçados igualmente no eixo X (não proporcional aos dias).
function DiscountChart() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const fg = Colors.surface;
  const [hover, setHover] = useState<{ days: number; pct: number; x: number; y: number } | null>(null);

  const plotW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const plotH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const baseline = CHART_PAD.top + plotH;
  const maxPct = DISCOUNT_CHART_POINTS[DISCOUNT_CHART_POINTS.length - 1].pct;

  const points = DISCOUNT_CHART_POINTS.map((p, i) => ({
    ...p,
    x: CHART_PAD.left + (i / (DISCOUNT_CHART_POINTS.length - 1)) * plotW,
    y: CHART_PAD.top + (1 - p.pct / maxPct) * plotH,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`;

  const updateHoverFromX = (localX: number) => {
    const clamped = Math.max(points[0].x, Math.min(points[points.length - 1].x, localX));
    let idx = 0;
    for (let i = 0; i < points.length - 1; i++) {
      if (clamped >= points[i].x && clamped <= points[i + 1].x) { idx = i; break; }
    }
    const p0 = points[idx];
    const p1 = points[idx + 1];
    const segW = p1.x - p0.x;
    const t = segW > 0 ? (clamped - p0.x) / segW : 0;
    setHover({
      days: Math.round(p0.days + t * (p1.days - p0.days)),
      pct: p0.pct + t * (p1.pct - p0.pct),
      x: p0.x + t * (p1.x - p0.x),
      y: p0.y + t * (p1.y - p0.y),
    });
  };

  const handleResponderMove = (evt: any) => updateHoverFromX(evt.nativeEvent.locationX);
  const badgeLeft = hover ? Math.max(0, Math.min(hover.x - 40, CHART_W - 80)) : 0;
  const badgeTop = hover ? Math.max(0, hover.y - 42) : 0;

  return (
    <MouseTrackingView
      style={{ width: CHART_W, height: CHART_H }}
      onMouseMove={(e: any) => updateHoverFromX(e.nativeEvent.offsetX)}
      onMouseLeave={() => setHover(null)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleResponderMove}
      onResponderMove={handleResponderMove}
      onResponderRelease={() => setHover(null)}
    >
      <Svg width={CHART_W} height={CHART_H}>
        <Line x1={CHART_PAD.left} y1={baseline} x2={CHART_W - CHART_PAD.right} y2={baseline} stroke={fg} strokeOpacity={0.25} strokeWidth={1} />
        <Path d={areaPath} fill={fg} fillOpacity={0.12} />
        <Path d={linePath} stroke={fg} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <G key={p.days}>
            <Circle cx={p.x} cy={p.y} r={4} fill={Colors.text} />
            <Circle cx={p.x} cy={p.y} r={2.5} fill={fg} />
            {p.pct > 0 && (
              <SvgText x={p.x} y={p.y - 9} fontSize={10} fontWeight="700" fill={fg} textAnchor="middle">
                -{p.pct}%
              </SvgText>
            )}
            <SvgText x={p.x} y={baseline + 17} fontSize={9} fill={fg} fillOpacity={0.75} textAnchor="middle">
              {p.days}d
            </SvgText>
          </G>
        ))}
        {hover && (
          <G>
            <Line x1={hover.x} y1={CHART_PAD.top} x2={hover.x} y2={baseline} stroke={fg} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="3,3" />
            <Circle cx={hover.x} cy={hover.y} r={5} fill={Colors.primary} stroke={fg} strokeWidth={1.5} />
          </G>
        )}
      </Svg>
      {hover && (
        <View style={[styles.chartHoverBadge, { left: badgeLeft, top: badgeTop }]} pointerEvents="none">
          <Text style={styles.chartHoverBadgeDays}>{hover.days} dias</Text>
          <Text style={styles.chartHoverBadgePct}>
            {hover.pct <= 0 ? 'sem desconto' : `-${Math.round(hover.pct)}%`}
          </Text>
        </View>
      )}
    </MouseTrackingView>
  );
}

// "i" ao lado de "Desconto progressivo": clique abre o gráfico num popover
// ancorado perto do ícone; clique de novo no ícone ou fora do popover fecha
// (Modal transparente + Pressable cobrindo a tela toda, mesmo padrão de
// components/ActionMenu.tsx).
function DiscountInfo() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width: winW, height: winH } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const iconRef = useRef<ComponentRef<typeof TouchableOpacity>>(null);

  const handleToggle = () => {
    if (open) { setOpen(false); return; }
    iconRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const openAbove = !!anchor
    && winH - (anchor.y + anchor.height) < POPOVER_HEIGHT_APPROX + 16
    && anchor.y > POPOVER_HEIGHT_APPROX;
  const top = anchor ? (openAbove ? anchor.y - POPOVER_HEIGHT_APPROX - 8 : anchor.y + anchor.height + 8) : 0;
  const left = anchor
    ? Math.max(12, Math.min(anchor.x - (POPOVER_WIDTH - anchor.width) / 2, winW - POPOVER_WIDTH - 12))
    : 0;

  return (
    <>
      <TouchableOpacity ref={iconRef} style={styles.discountInfoWrap} onPress={handleToggle}>
        <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.discountOverlay} onPress={() => setOpen(false)} tabIndex={-1}>
          {anchor && (
            <View style={[styles.discountPopover, { top, left, width: POPOVER_WIDTH }]}>
              <Pressable onPress={() => {}} tabIndex={-1}>
                <Text style={styles.discountTooltipTitle}>Desconto por duração</Text>
                <DiscountChart />
              </Pressable>
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

// Textos das explicações "i" das configurações avançadas — linguagem leiga,
// sem jargão de ads, pra quem nunca configurou um anúncio na vida.
const ADVANCED_FIELD_INFO = {
  objective: 'O que você quer que aconteça quando alguém vê seu anúncio. Essa escolha não muda pra quem o anúncio aparece — ela só organiza o relatório de resultados (impressões e cliques) separado por objetivo, pra você ver com mais facilidade se a campanha está indo bem no que importa pra você.',
  priority: 'Quando vários anunciantes disputam o mesmo espaço, quem tem prioridade mais alta é escolhido com mais frequência — como furar uma fila. Prioridade mais alta custa mais caro. Entre anunciantes empatados na mesma prioridade, a chance é sempre igual pra cada um — o peso na rotação (ao lado) não te dá vantagem sobre outros anunciantes, só serve pra dividir entre as suas próprias campanhas.',
  rotationWeight: 'Só importa se você tiver mais de uma campanha sua concorrendo ao mesmo tempo (ex: duas artes diferentes do mesmo anúncio) — decide a proporção entre elas: peso 2 aparece o dobro de vezes que peso 1. Não te dá nenhuma vantagem sobre outros anunciantes: a chance entre anunciantes diferentes na mesma prioridade é sempre igual, não importa o peso escolhido.',
  dailyCap: 'Uma "impressão" é toda vez que seu anúncio aparece pra alguém, mesmo sem a pessoa interagir com ele. Aqui você define quantas vezes, no máximo, ele pode ser exibido por dia no total — útil pra controlar o ritmo do orçamento. Deixe em branco pra não ter limite.',
  perUserCap: 'Define quantas vezes, no máximo, a mesma pessoa pode ver o seu anúncio durante toda a campanha, pra não cansar sempre os mesmos usuários com o mesmo anúncio repetidas vezes. Deixe em branco pra não ter limite.',
  pacing: 'Quando ativado, seu anúncio é espalhado em doses pequenas ao longo do dia inteiro, em vez de ser exibido o quanto antes. Assim ele aparece em horários variados, em vez de esgotar todas as exibições logo cedo, por exemplo.',
  audience: 'Escolhe quem pode ver o anúncio: todo mundo, só quem mora na região escolhida, ou só quem está passando pela região no momento (mesmo sem morar lá).',
  includeNearby: 'Além dos bairros que você escolheu acima, o anúncio também aparece pra moradores dos bairros vizinhos a eles, ampliando o alcance sem precisar selecionar bairro por bairro.',
  categories: 'Só vale pro formato "Post no feed": marque uma ou mais categorias (como "evento" ou "venda") pra seu anúncio aparecer junto de posts do mesmo assunto, chegando em quem já se interessa por esse tipo de conteúdo.',
  hours: 'Em quais horas do dia (de 0 a 23, sendo 0 a meia-noite) seu anúncio pode ser exibido. Por exemplo, "18, 19, 20" faz ele aparecer só entre 18h e a 20h59. Deixe em branco pra exibir em qualquer horário do dia.',
  daysOfWeek: 'Em quais dias da semana o anúncio pode aparecer, numerando de 0 (segunda-feira) a 6 (domingo). Por exemplo, "5, 6" mostra o anúncio só no sábado e no domingo. Deixe em branco pra exibir todos os dias.',
  specialDates: 'Datas específicas (no formato AAAA-MM-DD) em que você quer garantir que o anúncio apareça, como um feriado ou uma data comemorativa importante pro seu negócio — por exemplo, "2026-12-25" pro Natal.',
} as const;

// Linha "Rótulo + i" reaproveitada em todo campo das configurações
// avançadas — evita repetir a mesma View+Text+InfoTooltip 12 vezes.
function LabelWithInfo({ text, info }: { text: string; info: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.labelRow}>
      <Text style={styles.labelRowText}>{text}</Text>
      <InfoTooltip text={info} />
    </View>
  );
}

const OBJECTIVES: { key: AdObjective; label: string }[] = [
  { key: 'reach', label: 'Alcance' },
  { key: 'clicks', label: 'Cliques' },
  { key: 'profile_visits', label: 'Visitas ao perfil' },
  { key: 'map_opens', label: 'Abertura do mapa' },
  { key: 'whatsapp_opens', label: 'Abertura do WhatsApp' },
  { key: 'instagram_opens', label: 'Abertura do Instagram' },
  { key: 'website_opens', label: 'Abertura do site' },
];

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formato compacto "-R$XX,XX" (sem espaço entre o R$ e o valor) pro selo
// verde ao lado do "i" — `formatMoney` usa o formato de moeda padrão do
// Intl (com espaço), que não bate com o pedido aqui.
function formatDiscountValue(cents: number) {
  const value = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `-R$${value}`;
}

interface ReactivatePrefill {
  formats?: AdFormat[];
  durationDays?: number;
  geoScope?: GeoScope;
  neighborhoods?: string[];
  city?: string;
  cities?: string[];
  objective?: AdObjective;
  priority?: number;
  rotationWeight?: number;
  pacing?: 'asap' | 'even';
  dailyImpressionCap?: number;
  perUserImpressionCap?: number;
  includeNearby?: boolean;
  audience?: 'all' | 'residents' | 'visitors';
  categories?: string[];
  hours?: number[] | null;
  daysOfWeek?: number[] | null;
  specialDates?: string[];
}

export default function CustomizeScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ planId?: string; prefill?: string; renewedFromToken?: string }>();
  // Vem do botão "Reativar campanha" (dashboard/[token].tsx) — pré-preenche o
  // ponto de partida a partir da campanha anterior; tudo continua editável.
  const prefillData = useMemo<ReactivatePrefill | null>(
    () => (params.prefill ? JSON.parse(params.prefill) : null),
    [params.prefill],
  );

  const [formats, setFormats] = useState<AdFormat[]>(prefillData?.formats ?? ['post']);
  const [durationDays, setDurationDays] = useState(prefillData?.durationDays ?? 15);
  // Espelha `durationDays` como texto editável (campo pequeno ao lado do
  // slider) — permite digitar livremente sem forçar um número válido a cada
  // tecla; só vira `durationDays` de fato quando o valor digitado é válido.
  const [durationText, setDurationText] = useState(String(prefillData?.durationDays ?? 15));

  // Aplica uma duração vinda do slider/marcações/plano: mantém texto e valor
  // numérico em sincronia, sempre dentro de [1, MAX_DURATION_DAYS].
  const applyDuration = (n: number) => {
    const clamped = Math.min(MAX_DURATION_DAYS, Math.max(1, Math.round(n)));
    setDurationDays(clamped);
    setDurationText(String(clamped));
  };
  const [geoScope, setGeoScope] = useState<GeoScope>(prefillData?.geoScope ?? 'neighborhood');
  const [neighborhoods, setNeighborhoods] = useState<string[]>(prefillData?.neighborhoods ?? []);
  const [city, setCity] = useState<string>(prefillData?.city ?? '');
  const [cities, setCities] = useState<string[]>(prefillData?.cities ?? []);
  const [priceCents, setPriceCents] = useState<number | null>(null);
  const [factors, setFactors] = useState<PriceFactor[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [error, setError] = useState('');
  // Plano escolhido (quando veio de "Contratar este plano"): trava o preço no
  // valor fixo do plano, no escopo geográfico dele, e limita a quantidade de
  // bairros/cidades — assim "até N bairros por R$ X" cobra exatamente R$ X,
  // sem a cotação dinâmica mexer no total.
  const [plan, setPlan] = useState<{
    priceCents: number;
    geoScope: GeoScope;
    maxNeighborhoods: number | null;
    maxCities: number | null;
  } | null>(null);

  // "Configurações avançadas": recolhida por padrão — quem nunca abre tem a
  // mesma experiência simples de sempre (todo campo abaixo já nasce com o
  // valor que reproduz o comportamento atual). Numa reativação, já abre pra
  // mostrar o que veio da campanha anterior.
  const [showAdvanced, setShowAdvanced] = useState(!!prefillData);
  const [objective, setObjective] = useState<AdObjective>(prefillData?.objective ?? 'clicks');
  const [priority, setPriority] = useState(String(prefillData?.priority ?? 3));
  const [rotationWeight, setRotationWeight] = useState(String(prefillData?.rotationWeight ?? 1.0));
  const [pacing, setPacing] = useState<'asap' | 'even'>(prefillData?.pacing ?? 'asap');
  const [dailyCap, setDailyCap] = useState(prefillData?.dailyImpressionCap != null ? String(prefillData.dailyImpressionCap) : '');
  const [perUserCap, setPerUserCap] = useState(prefillData?.perUserImpressionCap != null ? String(prefillData.perUserImpressionCap) : '');
  const [includeNearby, setIncludeNearby] = useState(prefillData?.includeNearby ?? false);
  const [audience, setAudience] = useState<'all' | 'residents' | 'visitors'>(prefillData?.audience ?? 'all');
  const [categoriesText, setCategoriesText] = useState(prefillData?.categories?.join(', ') ?? '');
  const [hoursText, setHoursText] = useState(prefillData?.hours?.join(', ') ?? '');
  const [daysOfWeekText, setDaysOfWeekText] = useState(prefillData?.daysOfWeek?.join(', ') ?? '');
  const [specialDatesText, setSpecialDatesText] = useState(prefillData?.specialDates?.join(', ') ?? '');

  useEffect(() => {
    if (!params.planId) return;
    adsApi.getAdPlans().then((plans) => {
      const p = plans.find((pl) => String(pl.id) === params.planId);
      if (p) {
        setFormats(p.formats);
        setDurationDays(p.durationDays);
        setDurationText(String(p.durationDays));
        setGeoScope(p.geoScope);
        setPlan({
          priceCents: p.priceCents,
          geoScope: p.geoScope,
          maxNeighborhoods: p.maxNeighborhoods,
          maxCities: p.maxCities,
        });
      }
    }).catch(() => {});
  }, [params.planId]);

  const parseCsvNumbers = (raw: string) => raw.split(',').map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
  const parseCsvStrings = (raw: string) => raw.split(',').map((s) => s.trim()).filter(Boolean);

  const priorityNum = Math.min(5, Math.max(1, parseInt(priority, 10) || 3));
  const rotationWeightNum = parseFloat(rotationWeight) || 1.0;
  const dailyCapNum = dailyCap.trim() ? parseInt(dailyCap, 10) : undefined;
  const perUserCapNum = perUserCap.trim() ? parseInt(perUserCap, 10) : undefined;

  // O que falta preencher varia por escopo: bairros pra "neighborhood",
  // a cidade pra "citywide", ao menos uma cidade pra "cities" — "country"
  // (Brasil todo) já nasce completo, sem nada a escolher.
  const hasGeoTarget = geoScope === 'neighborhood' ? neighborhoods.length > 0
    : geoScope === 'citywide' ? !!city
    : geoScope === 'cities' ? cities.length > 0
    : true;

  useEffect(() => {
    setError('');
    if (formats.length === 0 || !hasGeoTarget) {
      setPriceCents(null);
      setFactors([]);
      return;
    }
    let cancelled = false;
    adsApi.quoteAd({
      planId: plan ? Number(params.planId) : undefined,
      formats,
      durationDays,
      geoScope,
      neighborhoods,
      city: city || undefined,
      cities,
      objective,
      priority: priorityNum,
      dailyImpressionCap: dailyCapNum,
      perUserImpressionCap: perUserCapNum,
      targeting: {
        includeNearby,
        audience,
        categories: parseCsvStrings(categoriesText),
      },
      schedule: {
        hours: hoursText.trim() ? parseCsvNumbers(hoursText) : null,
        daysOfWeek: daysOfWeekText.trim() ? parseCsvNumbers(daysOfWeekText) : null,
        specialDates: parseCsvStrings(specialDatesText),
      },
    })
      .then((r) => { if (!cancelled) { setPriceCents(r.priceCents); setFactors(r.factors); } })
      .catch((e) => { if (!cancelled) { setPriceCents(null); setFactors([]); setError(e.message); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formats.join(','), durationDays, geoScope, neighborhoods.join(','), city, cities.join(','), objective, priorityNum,
    dailyCapNum, perUserCapNum, includeNearby, audience, categoriesText, hoursText, daysOfWeekText, specialDatesText,
    plan,
  ]);

  const toggleFormat = (key: AdFormat) => {
    setFormats((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const comboActive = COMBO_FORMATS.every((f) => formats.includes(f));
  const needsPin = formats.includes('map');

  // Função de render (não um componente declarado aqui dentro): um componente
  // novo a cada render remontaria o card inteiro a cada tecla digitada.
  const renderFormatCard = (f: (typeof FORMATS)[number]) => {
    const active = formats.includes(f.key);
    return (
      <TouchableOpacity
        key={f.key}
        style={[styles.formatCard, active && styles.formatCardActive]}
        activeOpacity={0.85}
        onPress={() => toggleFormat(f.key)}
      >
        <Ionicons
          name={active ? 'checkbox' : 'square-outline'}
          size={20}
          color={active ? Colors.primary : Colors.textTertiary}
        />
        <Ionicons name={f.icon} size={18} color={active ? Colors.primary : Colors.textTertiary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.formatCardTitle}>{f.label}</Text>
          <Text style={styles.formatCardDesc}>{f.desc}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const canContinue = formats.length > 0 && hasGeoTarget && priceCents != null;

  // Quanto do preço atual já é economia da duração escolhida: isola o fator
  // "Desconto por duração" (sempre presente, ver ad_pricing.py) dos demais —
  // se P = base * outrosFatores * fDuração, então P/fDuração é o preço sem
  // esse desconto específico, e a diferença é o valor economizado em reais.
  const savingsFromFactor = (label: string) => {
    const factor = factors.find((f) => f.label === label)?.multiplier;
    if (priceCents == null || factor == null || factor <= 0 || factor >= 1) return 0;
    return Math.round((priceCents * (1 - factor)) / factor);
  };
  const durationDiscountCents = savingsFromFactor('Desconto por duração');
  // Mesma conta pro combo post+mapa: quanto o anunciante já está economizando
  // por ter escolhido os dois juntos em vez de contratá-los separadamente.
  const comboDiscountCents = savingsFromFactor(COMBO_FACTOR_LABEL);

  const goToCheckout = () => {
    router.push({
      pathname: '/advertise/checkout',
      params: {
        formats: JSON.stringify(formats),
        durationDays: String(durationDays),
        geoScope,
        neighborhoods: JSON.stringify(neighborhoods),
        city,
        cities: JSON.stringify(cities),
        planId: params.planId ?? '',
        objective,
        priority: String(priorityNum),
        rotationWeight: String(rotationWeightNum),
        pacing,
        dailyImpressionCap: dailyCapNum != null ? String(dailyCapNum) : '',
        perUserImpressionCap: perUserCapNum != null ? String(perUserCapNum) : '',
        targeting: JSON.stringify({
          includeNearby,
          audience,
          categories: parseCsvStrings(categoriesText),
        }),
        schedule: JSON.stringify({
          hours: hoursText.trim() ? parseCsvNumbers(hoursText) : null,
          daysOfWeek: daysOfWeekText.trim() ? parseCsvNumbers(daysOfWeekText) : null,
          specialDates: parseCsvStrings(specialDatesText),
        }),
        prefill: params.prefill ?? '',
        renewedFromToken: params.renewedFromToken ?? '',
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/advertise')}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personalize seu anúncio</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Onde seu anúncio aparece</Text>
        {/* Post e mapa vêm agrupados numa moldura com a faixa do combo entre
            os dois: separados na escolha (dá pra levar só um), mas com o
            desconto visível no exato momento de decidir. */}
        <View style={[styles.comboBox, comboActive && styles.comboBoxActive]}>
          {renderFormatCard(FORMATS[0])}
          <View style={styles.comboBanner}>
            <View style={styles.comboBannerLine} />
            <View style={[styles.comboPill, comboActive && styles.comboPillActive]}>
              <Ionicons
                name={comboActive ? 'checkmark-circle' : 'pricetag'}
                size={13}
                color={comboActive ? Colors.success : Colors.primary}
              />
              <Text style={[styles.comboPillText, comboActive && styles.comboPillTextActive]}>
                {comboActive
                  ? `Combo aplicado${comboDiscountCents > 0 ? ` · ${formatDiscountValue(comboDiscountCents)}` : ''}`
                  : `Leve os dois e economize ${COMBO_DISCOUNT_PCT}%`}
              </Text>
            </View>
            <View style={styles.comboBannerLine} />
          </View>
          {renderFormatCard(FORMATS[1])}
        </View>
        {FORMATS.slice(2).map(renderFormatCard)}
        {needsPin && (
          <Text style={styles.helperText}>
            No próximo passo você marca o endereço que vira o pin no mapa.
          </Text>
        )}

        <Text style={styles.label}>Duração (dias)</Text>
        <View style={styles.durationRow}>
          <View style={styles.durationSliderWrap}>
            <Slider
              style={styles.durationSlider}
              minimumValue={0}
              maximumValue={1}
              value={durationDaysToScalePos(durationDays)}
              onValueChange={(pos) => applyDuration(durationScalePosToDays(pos))}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={Colors.primary}
            />
            <View style={styles.durationMarksRow}>
              {DURATION_PRESETS.map((d) => (
                // TouchableOpacity ignora `position: absolute` no próprio style
                // (fica relativo à posição no fluxo) — por isso o posicionamento
                // fica numa View plana por fora, só com o toque por dentro.
                <View key={d} style={[styles.durationMark, { left: `${durationDaysToScalePos(d) * 100}%` }]}>
                  <TouchableOpacity onPress={() => applyDuration(d)} style={styles.durationMarkTouchable}>
                    <View style={[styles.durationMarkDot, durationDays === d && styles.durationMarkDotActive]} />
                    <Text style={[styles.durationMarkText, durationDays === d && styles.durationMarkTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.durationInputWrap}>
            <TextInput
              style={styles.durationInput}
              value={durationText}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '');
                setDurationText(cleaned);
                const n = parseInt(cleaned, 10);
                if (!Number.isNaN(n) && n >= 1 && n <= MAX_DURATION_DAYS) setDurationDays(n);
              }}
              onBlur={() => applyDuration(parseInt(durationText, 10) || durationDays)}
              keyboardType="numeric"
              maxLength={3}
            />
            <View style={styles.durationStepper}>
              <TouchableOpacity
                style={[styles.durationStepperBtn, styles.durationStepperBtnUp]}
                disabled={durationDays >= MAX_DURATION_DAYS}
                onPress={() => applyDuration(durationDays + 1)}
              >
                <Ionicons
                  name="chevron-up"
                  size={11}
                  color={durationDays >= MAX_DURATION_DAYS ? Colors.borderLight : Colors.textSecondary}
                />
              </TouchableOpacity>
              <View style={styles.durationStepperDivider} />
              <TouchableOpacity
                style={[styles.durationStepperBtn, styles.durationStepperBtnDown]}
                disabled={durationDays <= 1}
                onPress={() => applyDuration(durationDays - 1)}
              >
                <Ionicons
                  name="chevron-down"
                  size={11}
                  color={durationDays <= 1 ? Colors.borderLight : Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <View style={styles.discountInfoRow}>
          <Text style={styles.discountLabel}>Desconto progressivo</Text>
          <DiscountInfo />
          {durationDiscountCents > 0 && (
            <Text style={styles.discountValue}>{formatDiscountValue(durationDiscountCents)}</Text>
          )}
        </View>

        <Text style={styles.label}>Onde anunciar</Text>
        <View style={styles.chipsWrap}>
          {GEO_SCOPE_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.key}
              style={[styles.chip, geoScope === o.key && styles.chipActive]}
              onPress={() => setGeoScope(o.key)}
            >
              <Text style={[styles.chipText, geoScope === o.key && styles.chipTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {geoScope === 'neighborhood' && (
          <>
            <Text style={styles.label}>
              Bairros{plan?.maxNeighborhoods ? ` (até ${plan.maxNeighborhoods})` : ''}
            </Text>
            <NeighborhoodPicker
              value={neighborhoods}
              onChange={setNeighborhoods}
              max={plan?.maxNeighborhoods ?? null}
            />
          </>
        )}
        {geoScope === 'citywide' && (
          <>
            <Text style={styles.label}>Cidade</Text>
            <CityPicker
              value={city ? [city] : []}
              onChange={(v) => setCity(v[0] ?? '')}
              max={1}
              placeholder="Digite o nome da cidade..."
            />
          </>
        )}
        {geoScope === 'cities' && (
          <>
            <Text style={styles.label}>
              Cidades{plan?.maxCities ? ` (até ${plan.maxCities})` : ''}
            </Text>
            <CityPicker value={cities} onChange={setCities} max={plan?.maxCities ?? null} />
          </>
        )}
        {geoScope === 'country' && (
          <Text style={styles.helperText}>
            Seu anúncio aparece pra qualquer pessoa usando o Daqui, em qualquer cidade do Brasil.
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [styles.advancedToggle, pressed && styles.advancedTogglePressed]}
          onPress={() => setShowAdvanced((v) => !v)}
          tabIndex={-1}
        >
          <Ionicons name={showAdvanced ? 'chevron-down' : 'chevron-forward'} size={16} color={Colors.textSecondary} />
          <Text style={styles.advancedToggleText}>Configurações avançadas</Text>
        </Pressable>

        {showAdvanced && (
          <View style={styles.advancedBox}>
            <LabelWithInfo text="Objetivo da campanha" info={ADVANCED_FIELD_INFO.objective} />
            <View style={styles.chipsWrap}>
              {OBJECTIVES.map((o) => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.chip, objective === o.key && styles.chipActive]}
                  onPress={() => setObjective(o.key)}
                >
                  <Text style={[styles.chipText, objective === o.key && styles.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row2}>
              <View style={styles.flex1}>
                <LabelWithInfo text="Prioridade (1-5)" info={ADVANCED_FIELD_INFO.priority} />
                <TextInput style={styles.input} value={priority} onChangeText={setPriority} keyboardType="numeric" />
              </View>
              <View style={styles.flex1}>
                <LabelWithInfo text="Peso na rotação" info={ADVANCED_FIELD_INFO.rotationWeight} />
                <TextInput style={styles.input} value={rotationWeight} onChangeText={setRotationWeight} keyboardType="numeric" />
              </View>
            </View>

            <View style={styles.row2}>
              <View style={styles.flex1}>
                <LabelWithInfo text="Limite diário de impressões" info={ADVANCED_FIELD_INFO.dailyCap} />
                <TextInput style={styles.input} value={dailyCap} onChangeText={setDailyCap} keyboardType="numeric" placeholder="sem limite" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.flex1}>
                <LabelWithInfo text="Limite por pessoa" info={ADVANCED_FIELD_INFO.perUserCap} />
                <TextInput style={styles.input} value={perUserCap} onChangeText={setPerUserCap} keyboardType="numeric" placeholder="sem limite" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={styles.citywideRow}>
              <LabelWithInfo text="Distribuir uniformemente ao longo do dia" info={ADVANCED_FIELD_INFO.pacing} />
              <Switch value={pacing === 'even'} onValueChange={(v) => setPacing(v ? 'even' : 'asap')} />
            </View>

            <LabelWithInfo text="Audiência" info={ADVANCED_FIELD_INFO.audience} />
            <View style={styles.chipsWrap}>
              {([['all', 'Todos'], ['residents', 'Só moradores'], ['visitors', 'Só visitantes atuais']] as const).map(([key, label]) => (
                <TouchableOpacity key={key} style={[styles.chip, audience === key && styles.chipActive]} onPress={() => setAudience(key)}>
                  <Text style={[styles.chipText, audience === key && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.citywideRow}>
              <LabelWithInfo text="Incluir bairros próximos" info={ADVANCED_FIELD_INFO.includeNearby} />
              <Switch value={includeNearby} onValueChange={setIncludeNearby} />
            </View>

            <LabelWithInfo text="Categorias de post (opcional)" info={ADVANCED_FIELD_INFO.categories} />
            <TextInput style={styles.input} value={categoriesText} onChangeText={setCategoriesText} placeholder="evento, venda" placeholderTextColor={Colors.textTertiary} />

            <LabelWithInfo text="Horários (0-23, opcional)" info={ADVANCED_FIELD_INFO.hours} />
            <TextInput style={styles.input} value={hoursText} onChangeText={setHoursText} placeholder="18, 19, 20, 21" placeholderTextColor={Colors.textTertiary} />

            <LabelWithInfo text="Dias da semana (0=seg...6=dom, opcional)" info={ADVANCED_FIELD_INFO.daysOfWeek} />
            <TextInput style={styles.input} value={daysOfWeekText} onChangeText={setDaysOfWeekText} placeholder="5, 6" placeholderTextColor={Colors.textTertiary} />

            <LabelWithInfo text="Datas especiais (opcional)" info={ADVANCED_FIELD_INFO.specialDates} />
            <TextInput style={styles.input} value={specialDatesText} onChangeText={setSpecialDatesText} placeholder="2026-12-25" placeholderTextColor={Colors.textTertiary} />
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.priceBox}
          activeOpacity={0.85}
          onPress={() => setShowBreakdown((v) => !v)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.priceLabel}>{plan ? 'Valor do plano' : 'Valor estimado'}</Text>
            <Text style={styles.priceValue}>{priceCents != null ? formatMoney(priceCents) : '—'}</Text>
          </View>
          {priceCents != null && (
            <Text style={styles.priceHint}>
              {plan ? 'Preço não muda com os bairros — escala com a duração e os formatos escolhidos. ' : ''}
              {showBreakdown ? '▾ ver menos' : '▸ ver como calculamos'}
            </Text>
          )}
          {comboDiscountCents > 0 && (
            <View style={styles.priceSavingRow}>
              <Ionicons name="pricetag" size={12} color={Colors.success} />
              <Text style={styles.priceSavingText}>
                Combo post + mapa: {formatDiscountValue(comboDiscountCents)} em relação a contratar os dois separados
              </Text>
            </View>
          )}
          {showBreakdown && factors.map((f) => (
            <View key={f.label} style={styles.factorRow}>
              <Text style={styles.factorLabel}>{f.label}</Text>
              <Text style={styles.factorValue}>×{f.multiplier.toFixed(2)}</Text>
            </View>
          ))}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
          activeOpacity={0.85}
          disabled={!canContinue}
          onPress={goToCheckout}
        >
          <Text style={styles.continueBtnText}>Continuar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  iconBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: Colors.text },
  body: { padding: 16, paddingBottom: 48, gap: 10, maxWidth: 640, width: '100%', alignSelf: 'center' },

  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginTop: 10 },
  helperText: { fontSize: 12, color: Colors.textTertiary, marginTop: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  labelRowText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },

  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  formatCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  formatCardTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  formatCardDesc: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },

  // Moldura tracejada em volta de post+mapa: sinaliza que os dois andam
  // juntos (com desconto) sem impedir escolher só um. Vira sólida/verde
  // quando o combo está de fato aplicado.
  comboBox: {
    gap: 6,
    padding: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  comboBoxActive: { borderStyle: 'solid', borderColor: Colors.success, backgroundColor: Colors.primaryFaint },
  comboBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  comboBannerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  comboPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaint,
  },
  comboPillActive: { borderColor: Colors.success, backgroundColor: Colors.surface },
  comboPillText: { fontSize: 11.5, fontWeight: '800', color: Colors.primary },
  comboPillTextActive: { color: Colors.success },

  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  durationSliderWrap: { flex: 1, position: 'relative', paddingBottom: 18 },
  durationSlider: { width: '100%', height: 32 },
  durationMarksRow: {
    position: 'absolute', left: 0, right: 0, top: 34, height: 20, zIndex: 2,
    pointerEvents: 'box-none',
  } as any,
  durationMark: { position: 'absolute', top: 0, width: 24, marginLeft: -12, zIndex: 2 },
  durationMarkTouchable: { alignItems: 'center', paddingHorizontal: 4, paddingVertical: 3, borderRadius: 8 },
  durationMarkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  durationMarkDotActive: { backgroundColor: Colors.primary },
  durationMarkText: { fontSize: 10, fontWeight: '600', color: Colors.textTertiary, marginTop: 2 },
  durationMarkTextActive: { color: Colors.primary, fontWeight: '800' },
  durationInputWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  durationInput: {
    width: 44,
    paddingHorizontal: 8,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    color: Colors.text,
    backgroundColor: 'transparent',
    outlineStyle: 'none',
  } as any,
  durationStepper: { width: 22, borderLeftWidth: 1, borderLeftColor: Colors.border },
  durationStepperBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  durationStepperBtnUp: { borderTopRightRadius: 11 },
  durationStepperBtnDown: { borderBottomRightRadius: 11 },
  durationStepperDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },

  discountInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  discountLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  discountValue: { fontSize: 13, fontWeight: '800', color: Colors.success, marginLeft: 2 },
  discountInfoWrap: { borderRadius: 8, padding: 2 },
  discountOverlay: { flex: 1 },
  discountPopover: {
    position: 'absolute',
    alignItems: 'center',
    backgroundColor: Colors.text,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderRadius: 14,
    ...Colors.shadow.lg,
  },
  discountTooltipTitle: { fontSize: 14, fontWeight: '800', color: Colors.surface, marginBottom: 6, alignSelf: 'flex-start' },
  discountTooltipCaption: { fontSize: 11, fontWeight: '500', color: Colors.surface, opacity: 0.75, marginTop: 8, textAlign: 'center' },
  chartHoverBadge: {
    position: 'absolute',
    minWidth: 80,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    ...Colors.shadow.md,
  },
  chartHoverBadgeDays: { fontSize: 10, fontWeight: '700', color: Colors.text },
  chartHoverBadgePct: { fontSize: 12, fontWeight: '800', color: Colors.primary, marginTop: 1 },

  citywideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surface,
    outlineStyle: 'none',
  } as any,

  errorText: { fontSize: 12, fontWeight: '600', color: Colors.error },

  advancedToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingVertical: 6 },
  advancedTogglePressed: { opacity: 0.7 },
  advancedToggleText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  advancedBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border, borderRadius: 14, padding: 12, gap: 2 },
  row2: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },

  chipsWrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },

  priceBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.primaryFaint,
  },
  priceLabel: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  priceValue: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  priceHint: { fontSize: 11, fontWeight: '600', color: Colors.primary, marginTop: 4 },
  priceSavingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  priceSavingText: { flex: 1, fontSize: 11.5, fontWeight: '700', color: Colors.success },
  factorRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  factorLabel: { fontSize: 12, color: Colors.primary },
  factorValue: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  continueBtn: { marginTop: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  continueBtnDisabled: { opacity: 0.5 },
  continueBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
