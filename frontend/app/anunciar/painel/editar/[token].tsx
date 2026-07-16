import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../../../../constants/Colors';
import { useTheme, useThemedStyles } from '../../../../lib/theme';
import { goBack } from '../../../../lib/navigation';
import { adsApi, AdsApiError, MyCampaign } from '../../../../lib/adsApi';
import AdCreativeEditor, {
  CreativeBlocks,
  blocksToCreatives,
  creativesToBlocks,
  emptyCreativeBlocks,
} from '../../../../components/AdCreativeEditor';

const FORMAT_LABEL: Record<string, string> = {
  post: 'Post + mapa',
  conversation: 'Conversa (Mensagens)',
  notification: 'Novidades',
  search_poster: 'Poster de busca',
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EditCampaignScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { token } = useLocalSearchParams<{ token: string }>();

  const [campaign, setCampaign] = useState<MyCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [advertiserName, setAdvertiserName] = useState('');
  const [advertiserEmail, setAdvertiserEmail] = useState('');
  const [advertiserPhone, setAdvertiserPhone] = useState('');
  const [blocks, setBlocks] = useState<CreativeBlocks>(emptyCreativeBlocks());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setNotFound(false);
    adsApi.getMyCampaign(token)
      .then((c) => {
        setCampaign(c);
        setAdvertiserName(c.advertiserName);
        setAdvertiserEmail(c.advertiserEmail);
        setAdvertiserPhone(c.advertiserPhone);
        setBlocks(creativesToBlocks(c.creatives));
      })
      .catch((e) => setNotFound(e instanceof AdsApiError && e.status === 404))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const canSubmit = advertiserName.trim() && advertiserEmail.trim() &&
    blocks.default.title.trim() && blocks.default.targetUrl.trim() && !saving;

  const submit = async () => {
    if (!token) return;
    setError('');
    setSaving(true);
    try {
      await adsApi.updateMyCampaign(token, {
        advertiserName: advertiserName.trim(),
        advertiserEmail: advertiserEmail.trim(),
        advertiserPhone: advertiserPhone.trim(),
        creatives: blocksToCreatives(blocks),
      });
      router.replace(`/anunciar/painel/${token}` as any);
    } catch (e) {
      setError(e instanceof AdsApiError ? e.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack(`/anunciar/painel/${token}` as any)}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar anúncio</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading && !campaign ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : notFound || !campaign ? (
        <View style={styles.centerFill}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.notFoundText}>Não encontramos nenhum anúncio com esse link.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.summary}>
            {formatDate(campaign.startsAt)} – {formatDate(campaign.endsAt)} ·{' '}
            {campaign.formats.map((f) => FORMAT_LABEL[f] ?? f).join(', ')} ·{' '}
            {campaign.citywide ? 'Cidade toda' : campaign.neighborhoods.join(', ') || '—'}
          </Text>
          <Text style={styles.summaryHint}>
            Período, segmentação e formatos não são editáveis por aqui — fale com o time de anúncios pra mudar isso.
          </Text>

          <Text style={styles.sectionTitle}>Seus dados</Text>
          <TextInput style={styles.input} placeholder="Nome / empresa" placeholderTextColor={Colors.textTertiary} value={advertiserName} onChangeText={setAdvertiserName} />
          <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor={Colors.textTertiary} value={advertiserEmail} onChangeText={setAdvertiserEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Telefone (opcional)" placeholderTextColor={Colors.textTertiary} value={advertiserPhone} onChangeText={setAdvertiserPhone} />

          <AdCreativeEditor formats={campaign.formats} value={blocks} onChange={setBlocks} />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            activeOpacity={0.85}
            disabled={!canSubmit}
            onPress={submit}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Salvar alterações</Text>}
          </TouchableOpacity>
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

  body: { padding: 16, paddingBottom: 48, gap: 10, maxWidth: 640, width: '100%', alignSelf: 'center' },

  summary: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  summaryHint: { fontSize: 12, color: Colors.textTertiary },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.text, marginTop: 10 },

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

  submitBtn: { marginTop: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
