import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../../../constants/Colors';
import { useTheme, useThemedStyles } from '../../../lib/theme';
import { adsApi, AdsApiError, MyCampaign, CampaignStatus } from '../../../lib/adsApi';
import VideoPlayer from '../../../components/VideoPlayer';
import RankedBarChart from '../../../components/charts/RankedBarChart';

const FORMAT_LABEL: Record<string, string> = {
  post: 'Post + mapa',
  conversation: 'Conversa (Mensagens)',
  notification: 'Novidades',
  search_poster: 'Poster de busca',
};

const STATUS_META: Record<CampaignStatus, { label: string; color: keyof Palette }> = {
  pending_payment: { label: 'Aguardando pagamento', color: 'warning' },
  active: { label: 'Ativo', color: 'success' },
  paused: { label: 'Pausado', color: 'textTertiary' },
  expired: { label: 'Encerrado', color: 'textTertiary' },
  rejected: { label: 'Rejeitado', color: 'error' },
};

type GroupBy = 'hour' | 'weekday' | 'neighborhood';
const GROUP_TABS: { key: GroupBy; label: string }[] = [
  { key: 'weekday', label: 'Dia da semana' },
  { key: 'hour', label: 'Hora' },
  { key: 'neighborhood', label: 'Bairro' },
];

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdvertiserPanelScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { token } = useLocalSearchParams<{ token: string }>();

  const [campaign, setCampaign] = useState<MyCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('weekday');

  const load = useCallback((gb: GroupBy) => {
    if (!token) return;
    setLoading(true);
    setNotFound(false);
    adsApi.getMyCampaign(token, gb)
      .then(setCampaign)
      .catch((e) => setNotFound(e instanceof AdsApiError && e.status === 404))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(groupBy); }, [load, groupBy]);

  const reactivate = () => {
    if (!campaign || !token) return;
    const prefill = JSON.stringify({
      formats: campaign.formats,
      durationDays: campaign.durationDays,
      citywide: campaign.citywide,
      neighborhoods: campaign.neighborhoods,
      objective: campaign.objective,
      priority: campaign.priority,
      rotationWeight: campaign.rotationWeight,
      pacing: campaign.pacing,
      dailyImpressionCap: campaign.dailyImpressionCap,
      perUserImpressionCap: campaign.perUserImpressionCap,
      advertiserName: campaign.advertiserName,
      advertiserEmail: campaign.advertiserEmail,
      advertiserPhone: campaign.advertiserPhone,
      advertiserType: campaign.advertiserType,
      advertiserDocument: campaign.advertiserDocument,
      creatives: campaign.creatives.map((c) => ({
        format: c.format,
        title: c.title,
        content: c.content,
        imageUrl: c.imageUrl,
        videoUrl: c.videoUrl,
        ctaLabel: c.ctaLabel,
        targetUrl: c.targetUrl,
        latitude: c.latitude,
        longitude: c.longitude,
        linkedUserId: c.linkedUserId,
      })),
    });
    router.push({ pathname: '/anunciar/personalizar', params: { prefill, renewedFromToken: token } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.replace('/anunciar/painel')}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Meu anúncio</Text>
          {campaign && (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.actionPill}
                onPress={() => router.push(`/anunciar/painel/editar/${token}` as any)}
              >
                <Ionicons name="pencil-outline" size={14} color={Colors.primary} />
                <Text style={styles.actionPillText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionPill} onPress={reactivate}>
                <Ionicons name="refresh-outline" size={14} color={Colors.primary} />
                <Text style={styles.actionPillText}>Reativar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {loading && !campaign ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : notFound || !campaign ? (
        <View style={styles.centerFill}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.notFoundText}>
            Não encontramos nenhum anúncio com esse link. Confira se o endereço está
            completo, ou fale com quem contratou o anúncio.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: Colors[STATUS_META[campaign.status].color] as string }]} />
            <Text style={[styles.statusText, { color: Colors[STATUS_META[campaign.status].color] as string }]}>
              {STATUS_META[campaign.status].label}
            </Text>
          </View>

          {campaign.creatives.map((c) => (
            <View key={c.id} style={styles.creativeCard}>
              {c.videoUrl ? (
                <VideoPlayer uri={c.videoUrl} style={styles.creativeMedia} contentFit="cover" />
              ) : c.imageUrl ? (
                <Image source={{ uri: c.imageUrl }} style={styles.creativeMedia} resizeMode="cover" />
              ) : null}
              <View style={styles.creativeInfo}>
                <Text style={styles.creativeTitle}>{c.title}</Text>
                {!!c.content && <Text style={styles.creativeContent}>{c.content}</Text>}
                {!c.isActive && <Text style={styles.creativePaused}>Variante pausada</Text>}
              </View>
            </View>
          ))}

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Período</Text>
              <Text style={styles.infoValue}>{formatDate(campaign.startsAt)} – {formatDate(campaign.endsAt)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Formatos</Text>
              <Text style={styles.infoValue}>{campaign.formats.map((f) => FORMAT_LABEL[f] ?? f).join(', ')}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Segmentação</Text>
              <Text style={styles.infoValue}>{campaign.citywide ? 'Cidade toda' : campaign.neighborhoods.join(', ') || '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Investimento</Text>
              <Text style={styles.infoValue}>{formatMoney(campaign.priceCents)}</Text>
            </View>
          </View>

          {campaign.history.length > 1 && (
            <>
              <Text style={styles.sectionTitle}>Histórico</Text>
              <View style={{ gap: 8 }}>
                {campaign.history.map((p) => {
                  const isCurrent = p.accessToken === token;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.historyRow, isCurrent && styles.historyRowCurrent]}
                      activeOpacity={isCurrent ? 1 : 0.8}
                      disabled={isCurrent}
                      onPress={() => router.replace(`/anunciar/painel/${p.accessToken}` as any)}
                    >
                      <View style={[styles.statusDot, { backgroundColor: Colors[STATUS_META[p.status].color] as string }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyDates}>
                          {formatDate(p.startsAt)} – {formatDate(p.endsAt)}{isCurrent ? ' · atual' : ''}
                        </Text>
                        <Text style={styles.historyStats}>
                          {p.impressionsCount} imp · {p.clicksCount} cliques · {formatMoney(p.priceCents)}
                        </Text>
                      </View>
                      {!isCurrent && <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>Resultados</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{campaign.analytics.impressions}</Text>
              <Text style={styles.metricLabel}>Impressões</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{campaign.analytics.clicks}</Text>
              <Text style={styles.metricLabel}>Cliques</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{(campaign.analytics.ctr * 100).toFixed(1)}%</Text>
              <Text style={styles.metricLabel}>CTR</Text>
            </View>
          </View>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{campaign.analytics.cpcCents != null ? formatMoney(campaign.analytics.cpcCents) : '—'}</Text>
              <Text style={styles.metricLabel}>Custo por clique</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{campaign.analytics.cpmCents != null ? formatMoney(campaign.analytics.cpmCents) : '—'}</Text>
              <Text style={styles.metricLabel}>Custo por mil impressões</Text>
            </View>
          </View>

          <View style={styles.tabsRow}>
            {GROUP_TABS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, groupBy === t.key && styles.tabActive]}
                onPress={() => setGroupBy(t.key)}
              >
                <Text style={[styles.tabText, groupBy === t.key && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />
          ) : (
            <View style={styles.chartCard}>
              <RankedBarChart
                emptyLabel="Sem dados suficientes ainda."
                data={campaign.analytics.buckets.map((b) => ({
                  key: b.key,
                  label: b.key,
                  value: b.impressions,
                  sublabel: `${b.clicks} cliques`,
                }))}
              />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  // Mesma largura máxima do `body` abaixo (640, centralizado) — em telas
  // largas os botões ficam alinhados com o painel, não colados no canto da
  // janela do navegador.
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  iconBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: Colors.text },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.primaryFaint,
  },
  actionPillText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.surface,
  },
  historyRowCurrent: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  historyDates: { fontSize: 13, fontWeight: '700', color: Colors.text },
  historyStats: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  notFoundText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 340 },

  body: { padding: 16, paddingBottom: 48, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '700' },

  creativeCard: { borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.surface },
  creativeMedia: { width: '100%', height: 180, backgroundColor: Colors.borderLight },
  creativeInfo: { padding: 12, gap: 4 },
  creativeTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  creativeContent: { fontSize: 13, color: Colors.textSecondary },
  creativePaused: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary, marginTop: 2 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoItem: { flexBasis: '47%', flexGrow: 1, gap: 2 },
  infoLabel: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase' },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '600' },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginTop: 6 },

  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 2, backgroundColor: Colors.surface },
  metricValue: { fontSize: 17, fontWeight: '800', color: Colors.text },
  metricLabel: { fontSize: 11, color: Colors.textTertiary, textAlign: 'center' },

  tabsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.borderLight },
  tabActive: { backgroundColor: Colors.primaryFaint },
  tabText: { fontSize: 12, fontWeight: '700', color: Colors.textTertiary },
  tabTextActive: { color: Colors.primary },

  chartCard: { borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 14, padding: 14, backgroundColor: Colors.surface },
});
