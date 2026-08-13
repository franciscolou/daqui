import { View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Palette } from '../../../constants/Colors';
import { DESKTOP_BREAKPOINT } from '../../../constants/config';
import { useTheme, useThemedStyles, useThemeMode } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';
import { goBack } from '../../../lib/navigation';
import { adsApi, AdFormat, CampaignSeries, CampaignSummary, MyCampaignsAnalytics } from '../../../lib/adsApi';
import TimeseriesChart from '../../../components/charts/TimeseriesChart';
import RankedBarChart from '../../../components/charts/RankedBarChart';
import MultiLineChart, { MultiLineSeries } from '../../../components/charts/MultiLineChart';
import { useT } from '../../../lib/i18n';
import { activeLocale } from '../../../lib/time';

const FORMAT_LABEL: Record<string, string> = {
  post: 'Post no feed',
  map: 'Mapa',
  conversation: 'Conversa',
  notification: 'Novidades',
  search_poster: 'Busca',
};

// Mesmos ícones de app/advertise/customize.tsx — mantém a associação
// formato → símbolo consistente em toda a jornada do anunciante.
const FORMAT_ICON: Record<AdFormat, keyof typeof Ionicons.glyphMap> = {
  post: 'newspaper-outline',
  map: 'location-outline',
  conversation: 'chatbubbles-outline',
  notification: 'notifications-outline',
  search_poster: 'search-outline',
};

// Gradiente de miniatura pra campanhas sem imagem — varia por formato
// principal só pra o grid não virar uma parede de cinza quando faltam
// criativos com mídia (comum em campanhas "conversation"/"notification").
function fallbackGradient(Colors: Palette, format?: AdFormat): readonly string[] {
  switch (format) {
    case 'map': return Colors.gradient.cool;
    case 'conversation': return Colors.gradient.warm;
    case 'notification': return Colors.gradient.dark;
    case 'search_poster': return Colors.gradient.hero;
    default: return Colors.gradient.primary;
  }
}

const STATUS_META: Record<string, { label: string; color: keyof Palette }> = {
  awaiting_content: { label: 'Aguardando conteúdo', color: 'warning' },
  pending_payment: { label: 'Aguardando pagamento', color: 'warning' },
  active: { label: 'Ativo', color: 'success' },
  paused: { label: 'Pausado', color: 'textTertiary' },
  expired: { label: 'Encerrado', color: 'textTertiary' },
  rejected: { label: 'Rejeitado', color: 'error' },
};
// Ordem fixa de exibição dos chips de filtro por status — não é alfabética
// de propósito, segue o "ciclo de vida" que faz mais sentido pro anunciante
// olhar primeiro (o que está rodando) até o que já não importa mais.
const STATUS_FILTER_ORDER = ['active', 'paused', 'awaiting_content', 'pending_payment', 'expired', 'rejected'];

// Paleta categórica pro gráfico de comparação entre campanhas — validada com
// scripts/validate_palette.js (skill de dataviz) contra as superfícies claro
// (#F8FAFC) e escura (#0B1220) do app: os 6 slots passam separação CVD e piso
// de contraste normal-vision em ambos os modos (ver `references/palette.md`).
// Ordem fixa — nunca reciclada por ranking, só por posição estável da
// campanha na lista mestre (ver `colorForCampaign`).
const CAMPAIGN_PALETTE_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const CAMPAIGN_PALETTE_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'];
// Acima disso um gráfico de linhas vira sopa ilegível (ver anti-patterns da
// skill de dataviz) — trunca pras N campanhas com mais impressões no período.
const MAX_COMPARE_SERIES = 6;

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString(activeLocale(), { style: 'currency', currency: 'BRL' });
}

function formatDayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(activeLocale(), { day: '2-digit', month: '2-digit' });
}

// Largura máxima do conteúdo — bem mais generosa que uma tela comum do app
// (ver CONTENT_MAX_W em WideLayout), de propósito: esta é uma tela de
// gestão de recursos (estilo painel de campanhas), não um feed de leitura,
// então aproveita a largura do desktop pra virar um grid de verdade em vez
// de uma coluna estreita centralizada.
const CONTENT_MAX_W = 1440;
// Grid fluido (like CSS auto-fill): calcula quantas colunas cabem na
// largura medida do container, sem depender de breakpoints fixos.
const CARD_MIN_W = 248;
const CARD_GAP = 16;
function computeColumns(containerWidth: number): number {
  if (containerWidth <= 0) return 1;
  return Math.max(1, Math.floor((containerWidth + CARD_GAP) / (CARD_MIN_W + CARD_GAP)));
}

export default function MyCampaignsDashboard() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { user } = useAuth();
  const { mode } = useThemeMode();
  const email = user?.email;
  const { width } = useWindowDimensions();
  const isWide = width >= DESKTOP_BREAKPOINT;

  // Lista mestre — todas as campanhas do anunciante, carregada uma única vez
  // (alimenta os chips de status/comparação). `analytics` é sempre o recorte
  // atual (status + comparação manual), recarregado a cada mudança de filtro.
  const [allCampaigns, setAllCampaigns] = useState<CampaignSummary[]>([]);
  const [masterLoaded, setMasterLoaded] = useState(false);
  const [analytics, setAnalytics] = useState<MyCampaignsAnalytics | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]); // vazio = todas do status ativo
  const [compareMetric, setCompareMetric] = useState<'impressions' | 'clicks'>('impressions');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    if (!email) return;
    adsApi.getMyCampaignsAnalytics(email, {})
      .then((data) => setAllCampaigns(data.campaigns))
      .catch(() => setError(true))
      .finally(() => setMasterLoaded(true));
  }, [email]);

  useEffect(() => {
    if (!email || !masterLoaded) return;
    const ids = selectedIds.length > 0
      ? selectedIds
      : statusFilter === 'all' ? [] : allCampaigns.filter((c) => c.status === statusFilter).map((c) => c.id);
    setLoading(true);
    setError(false);
    adsApi.getMyCampaignsAnalytics(email, { campaignIds: ids.length ? ids : undefined })
      .then(setAnalytics)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [email, masterLoaded, allCampaigns, statusFilter, selectedIds]);

  const toggleCampaign = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const selectStatus = (s: string) => {
    setStatusFilter(s);
    setSelectedIds([]); // seleção manual anterior pode não pertencer ao novo status
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allCampaigns.forEach((c) => { counts[c.status] = (counts[c.status] ?? 0) + 1; });
    return counts;
  }, [allCampaigns]);
  const statusCampaigns = statusFilter === 'all' ? allCampaigns : allCampaigns.filter((c) => c.status === statusFilter);

  const cols = computeColumns(gridWidth);
  const cardWidth = gridWidth > 0 ? (gridWidth - CARD_GAP * (cols - 1)) / cols : undefined;

  // Cor estável por campanha: posição na lista mestre (nunca no ranking do
  // recorte atual), pra trocar de filtro nunca "repintar" quem já estava
  // visível — ver non-negotiable da skill de dataviz.
  const palette = mode === 'dark' ? CAMPAIGN_PALETTE_DARK : CAMPAIGN_PALETTE_LIGHT;
  const colorForCampaign = (campaignId: number) => {
    const idx = allCampaigns.findIndex((c) => c.id === campaignId);
    return palette[(idx >= 0 ? idx : 0) % palette.length];
  };

  const compareSeriesAll = useMemo(() => analytics?.byCampaignTimeseries ?? [], [analytics]);
  const compareSeries = useMemo(() => {
    return compareSeriesAll
      .map((s) => ({ ...s, total: s.buckets.reduce((sum, b) => sum + b.impressions, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, MAX_COMPARE_SERIES);
  }, [compareSeriesAll]);
  const compareXLabels = compareSeries[0]?.buckets.map((b) => formatDayLabel(b.key)) ?? [];
  const multiSeries: MultiLineSeries[] = compareSeries.map((s: CampaignSeries) => ({
    key: String(s.campaignId),
    label: s.title,
    color: colorForCampaign(s.campaignId),
    values: s.buckets.map((b) => (compareMetric === 'impressions' ? b.impressions : b.clicks)),
  }));

  const ctrRanking = (analytics?.campaigns ?? [])
    .filter((c) => c.impressions > 0)
    .slice()
    .sort((a, b) => b.ctr - a.ctr)
    .slice(0, 8);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/')}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('ads.dashboard.title')}</Text>
            {!!analytics && (
              <Text style={styles.headerSubtitle}>
                {t('ads.dashboard.headerSummary', {
                  count: analytics.summary.campaignsCount,
                  active: analytics.summary.activeCampaigns,
                })}
              </Text>
            )}
          </View>
          {isWide && allCampaigns.length > 0 && (
            <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/advertise')}>
              <LinearGradient colors={Colors.gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerCta}>
                <Ionicons name="add-circle-outline" size={17} color="#fff" />
                <Text style={styles.headerCtaText}>{t('ads.dashboard.createNew')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!email || (loading && !analytics) ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerFill}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>{t('ads.dashboard.loadError')}</Text>
        </View>
      ) : allCampaigns.length === 0 ? (
        <View style={styles.centerFill}>
          <Ionicons name="megaphone-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>{t('ads.dashboard.empty')}</Text>
          <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.85} onPress={() => router.push('/advertise')}>
            <LinearGradient colors={Colors.gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGrad}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.ctaBtnText}>{t('ads.dashboard.createFirst')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {!isWide && (
            <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.85} onPress={() => router.push('/advertise')}>
              <LinearGradient colors={Colors.gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGrad}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.ctaBtnText}>{t('ads.dashboard.createNew')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {analytics && (
            isWide ? (
              <View style={styles.kpiStrip}>
                <KpiTile styles={styles} value={String(analytics.summary.campaignsCount)} label={t('ads.dashboard.campaigns')} first />
                <KpiTile styles={styles} value={String(analytics.summary.activeCampaigns)} label={t('ads.dashboard.active')} />
                <KpiTile styles={styles} value={String(analytics.summary.impressions)} label={t('ads.metrics.impressions')} />
                <KpiTile styles={styles} value={String(analytics.summary.clicks)} label={t('ads.metrics.clicks')} />
                <KpiTile styles={styles} value={`${(analytics.summary.ctr * 100).toFixed(1)}%`} label="CTR" />
                <KpiTile styles={styles} value={formatMoney(analytics.summary.revenueCents)} label={t('ads.dashboard.invested')} />
                <KpiTile
                  styles={styles}
                  value={analytics.summary.cpcCents != null ? formatMoney(analytics.summary.cpcCents) : '—'}
                  label={t('ads.dashboard.costPerInteraction')}
                />
              </View>
            ) : (
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{analytics.summary.campaignsCount}</Text>
                  <Text style={styles.metricLabel}>{t('ads.dashboard.campaigns')}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{analytics.summary.activeCampaigns}</Text>
                  <Text style={styles.metricLabel}>{t('ads.dashboard.active')}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{analytics.summary.impressions}</Text>
                  <Text style={styles.metricLabel}>{t('ads.metrics.impressions')}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{analytics.summary.clicks}</Text>
                  <Text style={styles.metricLabel}>{t('ads.metrics.clicks')}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{(analytics.summary.ctr * 100).toFixed(1)}%</Text>
                  <Text style={styles.metricLabel}>CTR</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{formatMoney(analytics.summary.revenueCents)}</Text>
                  <Text style={styles.metricLabel}>{t('ads.dashboard.invested')}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{analytics.summary.cpcCents != null ? formatMoney(analytics.summary.cpcCents) : '—'}</Text>
                  <Text style={styles.metricLabel}>{t('ads.dashboard.costPerInteraction')}</Text>
                </View>
              </View>
            )
          )}

          {/* ── Filtro por status — recorta grid + KPIs + insights ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusFilterRow}>
            <TouchableOpacity
              style={[styles.statusChip, statusFilter === 'all' && styles.statusChipActive]}
              onPress={() => selectStatus('all')}
            >
              <Text style={[styles.statusChipText, statusFilter === 'all' && styles.statusChipTextActive]}>
                {t('ads.dashboard.all')} ({allCampaigns.length})
              </Text>
            </TouchableOpacity>
            {STATUS_FILTER_ORDER.filter((s) => statusCounts[s]).map((s) => {
              const meta = STATUS_META[s] ?? { label: s, color: 'textTertiary' as const };
              const active = statusFilter === s;
              return (
                <TouchableOpacity key={s} style={[styles.statusChip, active && styles.statusChipActive]} onPress={() => selectStatus(s)}>
                  <View style={[styles.statusDot, { backgroundColor: Colors[meta.color] as string }]} />
                  <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>
                    {t(`ads.status.${s}`, { defaultValue: meta.label })} ({statusCounts[s]})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Comparação entre campanhas ao longo do tempo ── */}
          {analytics && (
            <View style={styles.wideChartCard}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('ads.dashboard.compareTitle')}</Text>
                <View style={styles.metricToggleRow}>
                  {(['impressions', 'clicks'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.metricToggle, compareMetric === m && styles.metricToggleActive]}
                      onPress={() => setCompareMetric(m)}
                    >
                      <Text style={[styles.metricToggleText, compareMetric === m && styles.metricToggleTextActive]}>
                        {t(`ads.metrics.${m}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <MultiLineChart
                xLabels={compareXLabels}
                series={multiSeries}
                height={260}
                emptyLabel={t('ads.dashboard.compareEmpty')}
              />
              {compareSeriesAll.length > MAX_COMPARE_SERIES && (
                <Text style={styles.chartCaption}>
                  {t('ads.dashboard.compareTruncated', { count: MAX_COMPARE_SERIES })}
                </Text>
              )}
            </View>
          )}

          <View style={[styles.mainRow, isWide && styles.mainRowWide]}>
            {/* ── Coluna principal: grid de campanhas ── */}
            <View style={styles.mainCol}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('ads.dashboard.campaigns')}</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                <TouchableOpacity
                  style={[styles.chip, selectedIds.length === 0 && styles.chipActive]}
                  onPress={() => setSelectedIds([])}
                >
                  <Text style={[styles.chipText, selectedIds.length === 0 && styles.chipTextActive]}>{t('ads.dashboard.all')}</Text>
                </TouchableOpacity>
                {statusCampaigns.map((c) => {
                  const active = selectedIds.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleCampaign(c.id)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{c.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {loading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
              ) : analytics ? (
                <View
                  style={styles.grid}
                  onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
                >
                  {analytics.campaigns.map((c) => (
                    <CampaignGridCard key={c.id} campaign={c} width={cardWidth} t={t} />
                  ))}
                </View>
              ) : null}
            </View>

            {/* ── Coluna lateral: insights e desempenho ── */}
            {analytics && (analytics.insights.length > 0 || analytics.timeseries.length > 0 || ctrRanking.length > 0 || analytics.byFormat.length > 0) && (
              <View style={styles.sideCol}>
                {analytics.insights.length > 0 && (
                  <View style={styles.insightsBox}>
                    <View style={styles.sideCardHead}>
                      <Ionicons name="sparkles-outline" size={15} color={Colors.primary} />
                      <Text style={styles.sideCardTitle}>{t('ads.dashboard.insights')}</Text>
                    </View>
                    {analytics.insights.map((insight, i) => (
                      <View key={i} style={styles.insightRow}>
                        <Ionicons name="bulb-outline" size={14} color={Colors.primary} style={{ marginTop: 1 }} />
                        <Text style={styles.insightText}>{insight}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {analytics.timeseries.length > 0 && (
                  <View style={styles.chartCard}>
                    <Text style={styles.sideCardTitle}>{t('ads.dashboard.overTime')}</Text>
                    <TimeseriesChart
                      data={analytics.timeseries.map((b) => ({ key: b.key, label: formatDayLabel(b.key), a: b.impressions, b: b.clicks }))}
                      seriesALabel={t('ads.metrics.impressions')}
                      seriesBLabel={t('ads.metrics.clicks')}
                      height={160}
                    />
                  </View>
                )}

                {ctrRanking.length > 0 && (
                  <View style={styles.chartCard}>
                    <Text style={styles.sideCardTitle}>{t('ads.dashboard.ctrByCampaign')}</Text>
                    <RankedBarChart
                      data={ctrRanking.map((c) => ({
                        key: String(c.id),
                        label: c.title,
                        value: c.ctr * 100,
                        sublabel: `${c.impressions} imp.`,
                      }))}
                      valueFormatter={(v) => `${v.toFixed(1)}%`}
                    />
                  </View>
                )}

                {analytics.byFormat.length > 0 && (
                  <View style={styles.chartCard}>
                    <Text style={styles.sideCardTitle}>{t('ads.dashboard.byFormat')}</Text>
                    <RankedBarChart
                      data={analytics.byFormat.map((b) => ({
                        key: b.key,
                        label: t(`ads.formats.${b.key}`, { defaultValue: FORMAT_LABEL[b.key] ?? b.key }),
                        value: b.impressions,
                        sublabel: `${(b.ctr * 100).toFixed(1)}% CTR`,
                      }))}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function KpiTile({ styles, value, label, first }: { styles: any; value: string; label: string; first?: boolean }) {
  return (
    <View style={[styles.kpiTile, !first && styles.kpiTileDivider]}>
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function CampaignGridCard({ campaign: c, width, t }: { campaign: CampaignSummary; width?: number; t: ReturnType<typeof useT>['t'] }) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [hovered, setHovered] = useState(false);
  const meta = STATUS_META[c.status] ?? { label: c.status, color: 'textTertiary' as const };
  const primaryFormat = c.formats[0] as AdFormat | undefined;
  const statsText = t('ads.dashboard.stats', { impressions: c.impressions, clicks: c.clicks, ctr: (c.ctr * 100).toFixed(1) });
  const cpcText = c.cpcCents != null ? t('ads.dashboard.cpcLabel', { cpc: formatMoney(c.cpcCents) }) : null;

  return (
    <Pressable
      style={[styles.card, width ? { width } : { flexGrow: 1, minWidth: CARD_MIN_W }, hovered && styles.cardHovered]}
      onPress={() => router.push(`/advertise/dashboard/${c.accessToken}` as any)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      <View style={styles.cardMedia}>
        {c.imageUrl ? (
          <Image source={{ uri: c.imageUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={fallbackGradient(Colors, primaryFormat) as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardImage}
          >
            <Ionicons name={primaryFormat ? FORMAT_ICON[primaryFormat] : 'megaphone-outline'} size={34} color="rgba(255,255,255,0.85)" />
          </LinearGradient>
        )}
        <View style={styles.cardStatusPill}>
          <View style={[styles.statusDot, { backgroundColor: Colors[meta.color] as string }]} />
          <Text style={styles.cardStatusText}>{t(`ads.status.${c.status}`, { defaultValue: meta.label })}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.campaignTitle} numberOfLines={2}>{c.title}</Text>

        <View style={styles.cardFormatsRow}>
          {c.formats.map((f) => (
            <View key={f} style={styles.formatIconBadge}>
              <Ionicons name={FORMAT_ICON[f]} size={12} color={Colors.textSecondary} />
            </View>
          ))}
          <Text style={styles.campaignPrice}>{formatMoney(c.priceCents)}</Text>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardFooterCol}>
          <Text style={styles.campaignStats} numberOfLines={1}>{statsText}</Text>
          <View style={styles.cardFooterRow}>
            <Text style={styles.campaignCpc} numberOfLines={1}>{cpcText ?? '—'}</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxWidth: CONTENT_MAX_W,
    width: '100%',
    alignSelf: 'center',
  },
  iconBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '800', color: Colors.text },
  headerSubtitle: { fontSize: 13, color: Colors.textTertiary, marginTop: 1 },
  headerCta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  headerCtaText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', maxWidth: 320 },

  body: { padding: 20, paddingBottom: 56, gap: 20, maxWidth: CONTENT_MAX_W, width: '100%', alignSelf: 'center' },

  ctaBtn: { borderRadius: 14, overflow: 'hidden' },
  ctaBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },

  chipsRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingRight: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.borderLight, maxWidth: 220 },
  chipActive: { backgroundColor: Colors.primaryFaint },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary },
  chipTextActive: { color: Colors.primary },

  // Filtro por status — visualmente mais "cheio" que os chips de comparação
  // acima (é o filtro primário do grid, não um ajuste secundário).
  statusFilterRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.borderLight, backgroundColor: Colors.surface,
  },
  statusChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  statusChipText: { fontSize: 12.5, fontWeight: '700', color: Colors.textSecondary },
  statusChipTextActive: { color: Colors.primary },

  // Faixa de KPIs unificada (desktop) — uma única barra com divisores finos
  // em vez de vários cartões soltos, pra ler como uma régua de métricas.
  kpiStrip: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  kpiTile: { flex: 1, paddingVertical: 16, paddingHorizontal: 10, alignItems: 'center', gap: 3 },
  kpiTileDivider: { borderLeftWidth: 1, borderLeftColor: Colors.borderLight },
  kpiValue: { fontSize: 19, fontWeight: '800', color: Colors.text },
  kpiLabel: { fontSize: 10.5, color: Colors.textTertiary, textAlign: 'center' },

  // Grid de métricas empilhado (mobile) — mesmo visual de antes.
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    flexBasis: '31%', flexGrow: 1,
    borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', gap: 2, backgroundColor: Colors.surface,
  },
  metricValue: { fontSize: 16, fontWeight: '800', color: Colors.text },
  metricLabel: { fontSize: 11, color: Colors.textTertiary, textAlign: 'center' },

  // Card do gráfico de comparação — largura cheia, acima do grid (é o
  // "headline" analítico da tela, merece mais espaço que a barra lateral).
  wideChartCard: { gap: 12, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 16, padding: 18, backgroundColor: Colors.surface },
  metricToggleRow: { flexDirection: 'row', gap: 4, backgroundColor: Colors.background, borderRadius: 10, padding: 3 },
  metricToggle: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8 },
  metricToggleActive: { backgroundColor: Colors.surface, ...Colors.shadow.sm },
  metricToggleText: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary },
  metricToggleTextActive: { color: Colors.text },
  chartCaption: { fontSize: 11.5, color: Colors.textTertiary, fontStyle: 'italic' },

  mainRow: { gap: 20 },
  mainRowWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mainCol: { flex: 1, minWidth: 0, gap: 14 },
  sideCol: { width: 340, gap: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },

  card: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    transitionProperty: 'transform, box-shadow, border-color',
    transitionDuration: '150ms',
  } as any,
  cardHovered: {
    borderColor: Colors.primary,
    transform: [{ translateY: -3 }],
    ...Colors.shadow.lg,
  } as any,
  cardMedia: { width: '100%', aspectRatio: 16 / 10, backgroundColor: Colors.borderLight },
  cardImage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  cardStatusPill: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(15,23,42,0.65)',
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  cardStatusText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  cardBody: { padding: 12, gap: 8 },
  campaignTitle: { fontSize: 14, fontWeight: '800', color: Colors.text, lineHeight: 18, minHeight: 36 },
  cardFormatsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  formatIconBadge: {
    width: 22, height: 22, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  campaignPrice: { marginLeft: 'auto', fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  cardDivider: { height: 1, backgroundColor: Colors.borderLight },
  cardFooterCol: { gap: 3 },
  cardFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  campaignStats: { fontSize: 11, color: Colors.textTertiary },
  campaignCpc: { flex: 1, fontSize: 11.5, fontWeight: '700', color: Colors.text },

  sideCardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  sideCardTitle: { fontSize: 13, fontWeight: '800', color: Colors.text },

  insightsBox: { gap: 8, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 14, padding: 14, backgroundColor: Colors.primaryFaint },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  insightText: { flex: 1, fontSize: 12.5, color: Colors.text, lineHeight: 17 },

  chartCard: { gap: 10, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 14, padding: 14, backgroundColor: Colors.surface },
});
