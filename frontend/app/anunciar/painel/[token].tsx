import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../../../constants/Colors';
import { useTheme, useThemedStyles } from '../../../lib/theme';
import { adsApi, AdsApiError, MyCampaign, CampaignStatus } from '../../../lib/adsApi';
import VideoPlayer from '../../../components/VideoPlayer';

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.replace('/')}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meu anúncio</Text>
        <View style={styles.iconBtn} />
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
          ) : campaign.analytics.buckets.length === 0 ? (
            <Text style={styles.emptyBuckets}>Sem dados suficientes ainda.</Text>
          ) : (
            <View style={styles.buckets}>
              {campaign.analytics.buckets.map((b) => {
                const maxImp = Math.max(...campaign.analytics.buckets.map((x) => x.impressions), 1);
                return (
                  <View key={b.key} style={styles.bucketRow}>
                    <Text style={styles.bucketKey}>{b.key}</Text>
                    <View style={styles.bucketBarTrack}>
                      <View style={[styles.bucketBarFill, { width: `${(b.impressions / maxImp) * 100}%` }]} />
                    </View>
                    <Text style={styles.bucketValue}>{b.impressions} imp · {b.clicks} cliques</Text>
                  </View>
                );
              })}
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

  emptyBuckets: { fontSize: 13, color: Colors.textTertiary, textAlign: 'center', marginTop: 12 },
  buckets: { gap: 8 },
  bucketRow: { gap: 3 },
  bucketKey: { fontSize: 12, fontWeight: '700', color: Colors.text },
  bucketBarTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.borderLight, overflow: 'hidden' },
  bucketBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  bucketValue: { fontSize: 11, color: Colors.textTertiary },
});
