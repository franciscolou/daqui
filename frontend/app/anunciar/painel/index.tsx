import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../../../constants/Colors';
import { useTheme, useThemedStyles } from '../../../lib/theme';
import { useAuth } from '../../../lib/auth';
import { goBack } from '../../../lib/navigation';
import { adsApi, CampaignSummary, MyCampaignsAnalytics } from '../../../lib/adsApi';
import TimeseriesChart from '../../../components/charts/TimeseriesChart';
import RankedBarChart from '../../../components/charts/RankedBarChart';

const FORMAT_LABEL: Record<string, string> = {
  post: 'Post + mapa',
  conversation: 'Conversa',
  notification: 'Novidades',
  search_poster: 'Busca',
};

const STATUS_META: Record<string, { label: string; color: keyof Palette }> = {
  pending_payment: { label: 'Aguardando pagamento', color: 'warning' },
  active: { label: 'Ativo', color: 'success' },
  paused: { label: 'Pausado', color: 'textTertiary' },
  expired: { label: 'Encerrado', color: 'textTertiary' },
  rejected: { label: 'Rejeitado', color: 'error' },
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function MyCampaignsDashboard() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const email = user?.email;

  const [allCampaigns, setAllCampaigns] = useState<CampaignSummary[]>([]);
  const [analytics, setAnalytics] = useState<MyCampaignsAnalytics | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]); // vazio = todas
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback((ids: number[]) => {
    if (!email) return;
    setLoading(true);
    setError(false);
    adsApi.getMyCampaignsAnalytics(email, { campaignIds: ids.length ? ids : undefined })
      .then((data) => {
        setAnalytics(data);
        if (ids.length === 0) setAllCampaigns(data.campaigns);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [email]);

  useEffect(() => { load(selectedIds); }, [load, selectedIds]);

  const toggleCampaign = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/')}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus anúncios</Text>
        <View style={styles.iconBtn} />
      </View>

      {!email || (loading && !analytics) ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerFill}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>Não foi possível carregar seus anúncios agora.</Text>
        </View>
      ) : allCampaigns.length === 0 ? (
        <View style={styles.centerFill}>
          <Ionicons name="megaphone-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>Você ainda não tem campanhas.</Text>
          <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.85} onPress={() => router.push('/anunciar')}>
            <LinearGradient colors={Colors.gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGrad}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.ctaBtnText}>Criar minha primeira campanha</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.85} onPress={() => router.push('/anunciar')}>
            <LinearGradient colors={Colors.gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGrad}>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.ctaBtnText}>Criar nova campanha</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Comparar campanhas</Text>
          <View style={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.chip, selectedIds.length === 0 && styles.chipActive]}
              onPress={() => setSelectedIds([])}
            >
              <Text style={[styles.chipText, selectedIds.length === 0 && styles.chipTextActive]}>Todas</Text>
            </TouchableOpacity>
            {allCampaigns.map((c) => {
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
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />
          ) : analytics ? (
            <>
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{analytics.summary.campaignsCount}</Text>
                  <Text style={styles.metricLabel}>Campanhas</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{analytics.summary.activeCampaigns}</Text>
                  <Text style={styles.metricLabel}>Ativas</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{analytics.summary.impressions}</Text>
                  <Text style={styles.metricLabel}>Impressões</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{analytics.summary.clicks}</Text>
                  <Text style={styles.metricLabel}>Cliques</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{(analytics.summary.ctr * 100).toFixed(1)}%</Text>
                  <Text style={styles.metricLabel}>CTR</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{formatMoney(analytics.summary.revenueCents)}</Text>
                  <Text style={styles.metricLabel}>Investido</Text>
                </View>
              </View>

              {analytics.insights.length > 0 && (
                <View style={styles.insightsBox}>
                  {analytics.insights.map((insight, i) => (
                    <View key={i} style={styles.insightRow}>
                      <Ionicons name="bulb-outline" size={15} color={Colors.primary} />
                      <Text style={styles.insightText}>{insight}</Text>
                    </View>
                  ))}
                </View>
              )}

              {analytics.timeseries.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Ao longo do tempo</Text>
                  <View style={styles.chartCard}>
                    <TimeseriesChart
                      data={analytics.timeseries.map((b) => ({ key: b.key, label: formatDayLabel(b.key), a: b.impressions, b: b.clicks }))}
                      seriesALabel="Impressões"
                      seriesBLabel="Cliques"
                    />
                  </View>
                </>
              )}

              {analytics.byFormat.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Por formato</Text>
                  <View style={styles.chartCard}>
                    <RankedBarChart
                      data={analytics.byFormat.map((b) => ({
                        key: b.key,
                        label: FORMAT_LABEL[b.key] ?? b.key,
                        value: b.impressions,
                        sublabel: `${(b.ctr * 100).toFixed(1)}% CTR`,
                      }))}
                    />
                  </View>
                </>
              )}

              <Text style={styles.sectionTitle}>Campanhas</Text>
              <View style={{ gap: 8 }}>
                {analytics.campaigns.map((c) => {
                  const meta = STATUS_META[c.status] ?? { label: c.status, color: 'textTertiary' as const };
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.campaignCard}
                      activeOpacity={0.8}
                      onPress={() => router.push(`/anunciar/painel/${c.accessToken}` as any)}
                    >
                      <View style={styles.campaignCardHead}>
                        <Text style={styles.campaignTitle} numberOfLines={1}>{c.title}</Text>
                        <View style={styles.statusRow}>
                          <View style={[styles.statusDot, { backgroundColor: Colors[meta.color] as string }]} />
                          <Text style={[styles.statusText, { color: Colors[meta.color] as string }]}>{meta.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.campaignMeta}>
                        {c.formats.map((f) => FORMAT_LABEL[f] ?? f).join(', ')} · {formatMoney(c.priceCents)}
                      </Text>
                      <Text style={styles.campaignStats}>
                        {c.impressions} impressões · {c.clicks} cliques · {(c.ctr * 100).toFixed(1)}% CTR
                      </Text>
                      <View style={styles.campaignLink}>
                        <Text style={styles.campaignLinkText}>Ver painel da campanha</Text>
                        <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
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

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', maxWidth: 320 },

  body: { padding: 16, paddingBottom: 48, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },

  ctaBtn: { borderRadius: 14, overflow: 'hidden' },
  ctaBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginTop: 6 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.borderLight, maxWidth: 220 },
  chipActive: { backgroundColor: Colors.primaryFaint },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary },
  chipTextActive: { color: Colors.primary },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    flexBasis: '31%', flexGrow: 1,
    borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', gap: 2, backgroundColor: Colors.surface,
  },
  metricValue: { fontSize: 16, fontWeight: '800', color: Colors.text },
  metricLabel: { fontSize: 11, color: Colors.textTertiary, textAlign: 'center' },

  insightsBox: { gap: 8, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 12, padding: 12, backgroundColor: Colors.primaryFaint },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  insightText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 18 },

  chartCard: { borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 14, padding: 14, backgroundColor: Colors.surface },

  campaignCard: { borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 14, padding: 12, gap: 4, backgroundColor: Colors.surface },
  campaignCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  campaignTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: Colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  campaignMeta: { fontSize: 12, color: Colors.textSecondary },
  campaignStats: { fontSize: 12, color: Colors.textTertiary },
  campaignLink: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  campaignLinkText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
});
