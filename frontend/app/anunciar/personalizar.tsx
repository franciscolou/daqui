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
import { adsApi, AdFormat, AdObjective, PriceFactor } from '../../lib/adsApi';
import NeighborhoodPicker from '../../components/NeighborhoodPicker';

const FORMATS: { key: AdFormat; label: string; desc: string }[] = [
  { key: 'post', label: 'Post + mapa', desc: 'Aparece como post no feed e ganha um pin no mapa.' },
  { key: 'conversation', label: 'Conversa', desc: 'Linha na aba Mensagens, abre um link ao tocar.' },
  { key: 'notification', label: 'Novidades', desc: 'Item na aba de notificações.' },
  { key: 'search_poster', label: 'Poster de busca', desc: 'Aparece na Busca antes do usuário pesquisar algo.' },
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
                <Text style={styles.discountTooltipCaption}>
                  Passe o mouse (ou toque e arraste) na linha pra ver o desconto de cada duração.
                </Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Modal>
    </>
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

interface ReactivatePrefill {
  formats?: AdFormat[];
  durationDays?: number;
  citywide?: boolean;
  neighborhoods?: string[];
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

export default function PersonalizarScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ planId?: string; prefill?: string; renewedFromToken?: string }>();
  // Vem do botão "Reativar campanha" (painel/[token].tsx) — pré-preenche o
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
  const [citywide, setCitywide] = useState(prefillData?.citywide ?? false);
  const [neighborhoods, setNeighborhoods] = useState<string[]>(prefillData?.neighborhoods ?? []);
  const [priceCents, setPriceCents] = useState<number | null>(null);
  const [factors, setFactors] = useState<PriceFactor[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [error, setError] = useState('');
  // Plano escolhido (quando veio de "Contratar este plano"): trava o preço no
  // valor fixo do plano e limita a quantidade de bairros — assim "até N bairros
  // por R$ X" cobra exatamente R$ X, sem a cotação dinâmica mexer no total.
  const [plan, setPlan] = useState<{ priceCents: number; maxNeighborhoods: number | null } | null>(null);

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
        setCitywide(p.maxNeighborhoods == null);
        setPlan({ priceCents: p.priceCents, maxNeighborhoods: p.maxNeighborhoods });
      }
    }).catch(() => {});
  }, [params.planId]);

  const parseCsvNumbers = (raw: string) => raw.split(',').map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
  const parseCsvStrings = (raw: string) => raw.split(',').map((s) => s.trim()).filter(Boolean);

  const priorityNum = Math.min(5, Math.max(1, parseInt(priority, 10) || 3));
  const rotationWeightNum = parseFloat(rotationWeight) || 1.0;
  const dailyCapNum = dailyCap.trim() ? parseInt(dailyCap, 10) : undefined;
  const perUserCapNum = perUserCap.trim() ? parseInt(perUserCap, 10) : undefined;

  useEffect(() => {
    setError('');
    if (formats.length === 0 || (!citywide && neighborhoods.length === 0)) {
      setPriceCents(null);
      setFactors([]);
      return;
    }
    let cancelled = false;
    adsApi.quoteAd({
      planId: plan ? Number(params.planId) : undefined,
      formats,
      durationDays,
      neighborhoods,
      citywide,
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
    formats.join(','), durationDays, neighborhoods.join(','), citywide, objective, priorityNum,
    dailyCapNum, perUserCapNum, includeNearby, audience, categoriesText, hoursText, daysOfWeekText, specialDatesText,
    plan,
  ]);

  const toggleFormat = (key: AdFormat) => {
    setFormats((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const canContinue = formats.length > 0 && (citywide || neighborhoods.length > 0) && priceCents != null;

  const goToCheckout = () => {
    router.push({
      pathname: '/anunciar/checkout',
      params: {
        formats: JSON.stringify(formats),
        durationDays: String(durationDays),
        neighborhoods: JSON.stringify(neighborhoods),
        citywide: String(citywide),
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
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/anunciar')}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personalize seu anúncio</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Onde seu anúncio aparece</Text>
        {FORMATS.map((f) => {
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
              <View style={{ flex: 1 }}>
                <Text style={styles.formatCardTitle}>{f.label}</Text>
                <Text style={styles.formatCardDesc}>{f.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

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
        </View>

        <View style={styles.citywideRow}>
          <Text style={styles.label}>Cidade toda</Text>
          <Switch value={citywide} onValueChange={setCitywide} />
        </View>
        {!citywide && (
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
            <Text style={styles.label}>Objetivo da campanha</Text>
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

            <Text style={styles.helperText}>Prioridade mais alta fura fila na entrega (custa mais); peso só redistribui entre campanhas do mesmo nível (grátis).</Text>
            <View style={styles.row2}>
              <View style={styles.flex1}>
                <Text style={styles.label}>Prioridade (1-5)</Text>
                <TextInput style={styles.input} value={priority} onChangeText={setPriority} keyboardType="numeric" />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.label}>Peso na rotação</Text>
                <TextInput style={styles.input} value={rotationWeight} onChangeText={setRotationWeight} keyboardType="numeric" />
              </View>
            </View>

            <View style={styles.row2}>
              <View style={styles.flex1}>
                <Text style={styles.label}>Limite diário de impressões</Text>
                <TextInput style={styles.input} value={dailyCap} onChangeText={setDailyCap} keyboardType="numeric" placeholder="sem limite" placeholderTextColor={Colors.textTertiary} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.label}>Limite por pessoa</Text>
                <TextInput style={styles.input} value={perUserCap} onChangeText={setPerUserCap} keyboardType="numeric" placeholder="sem limite" placeholderTextColor={Colors.textTertiary} />
              </View>
            </View>

            <View style={styles.citywideRow}>
              <Text style={styles.label}>Distribuir uniformemente ao longo do dia</Text>
              <Switch value={pacing === 'even'} onValueChange={(v) => setPacing(v ? 'even' : 'asap')} />
            </View>

            <Text style={styles.label}>Audiência</Text>
            <View style={styles.chipsWrap}>
              {([['all', 'Todos'], ['residents', 'Só moradores'], ['visitors', 'Só visitantes atuais']] as const).map(([key, label]) => (
                <TouchableOpacity key={key} style={[styles.chip, audience === key && styles.chipActive]} onPress={() => setAudience(key)}>
                  <Text style={[styles.chipText, audience === key && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.citywideRow}>
              <Text style={styles.label}>Incluir bairros próximos</Text>
              <Switch value={includeNearby} onValueChange={setIncludeNearby} />
            </View>

            <Text style={styles.label}>Categorias de post (opcional)</Text>
            <TextInput style={styles.input} value={categoriesText} onChangeText={setCategoriesText} placeholder="evento, venda" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.label}>Horários (0-23, opcional)</Text>
            <TextInput style={styles.input} value={hoursText} onChangeText={setHoursText} placeholder="18, 19, 20, 21" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.label}>Dias da semana (0=seg...6=dom, opcional)</Text>
            <TextInput style={styles.input} value={daysOfWeekText} onChangeText={setDaysOfWeekText} placeholder="5, 6" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.label}>Datas especiais (opcional)</Text>
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
              {plan ? 'Preço não muda com os bairros — escala com a duração escolhida. ' : ''}
              {showBreakdown ? '▾ ver menos' : '▸ ver como calculamos'}
            </Text>
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
  factorRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  factorLabel: { fontSize: 12, color: Colors.primary },
  factorValue: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  continueBtn: { marginTop: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  continueBtnDisabled: { opacity: 0.5 },
  continueBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
