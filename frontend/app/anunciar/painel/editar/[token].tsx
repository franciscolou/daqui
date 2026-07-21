import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../../../../constants/Colors';
import { useTheme, useThemedStyles } from '../../../../lib/theme';
import { goBack } from '../../../../lib/navigation';
import { adsApi, AdsApiError, AdvertiserType, MyCampaign } from '../../../../lib/adsApi';
import { isValidDocument } from '../../../../lib/brDocuments';
import AdCreativeEditor, {
  CreativeBlocks,
  blocksToCreatives,
  creativesToBlocks,
  emptyCreativeBlocks,
} from '../../../../components/AdCreativeEditor';
import AdPreview from '../../../../components/AdPreview';
import AdvertiserIdentityFields from '../../../../components/AdvertiserIdentityFields';

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
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [campaign, setCampaign] = useState<MyCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [advertiserType, setAdvertiserType] = useState<AdvertiserType>('individual');
  const [advertiserName, setAdvertiserName] = useState('');
  const [advertiserDocument, setAdvertiserDocument] = useState('');
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
        setAdvertiserType(c.advertiserType);
        setAdvertiserName(c.advertiserName);
        setAdvertiserDocument(c.advertiserDocument);
        setAdvertiserEmail(c.advertiserEmail);
        setAdvertiserPhone(c.advertiserPhone);
        setBlocks(creativesToBlocks(c.creatives));
      })
      .catch((e) => setNotFound(e instanceof AdsApiError && e.status === 404))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const canSubmit = !!(advertiserName.trim() && advertiserEmail.trim() &&
    isValidDocument(advertiserType, advertiserDocument) &&
    blocks.default.title.trim() && blocks.default.targetUrl.trim() && !saving);

  const submit = async () => {
    if (!token) return;
    setError('');
    setSaving(true);
    try {
      await adsApi.updateMyCampaign(token, {
        advertiserName: advertiserName.trim(),
        advertiserEmail: advertiserEmail.trim(),
        advertiserPhone: advertiserPhone.trim(),
        advertiserType,
        advertiserDocument: advertiserDocument.trim(),
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
          <View style={[styles.columns, wide && styles.columnsWide]}>
            <View style={[styles.formCol, wide && styles.formColWide]}>
              <Text style={styles.summary}>
                {formatDate(campaign.startsAt)} – {formatDate(campaign.endsAt)} ·{' '}
                {campaign.formats.map((f) => FORMAT_LABEL[f] ?? f).join(', ')} ·{' '}
                {campaign.citywide ? 'Cidade toda' : campaign.neighborhoods.join(', ') || '—'}
              </Text>
              <Text style={styles.summaryHint}>
                Período, segmentação e formatos não são editáveis por aqui — fale com o time de anúncios pra mudar isso.
              </Text>

              <Text style={styles.sectionTitle}>Seus dados</Text>
              <AdvertiserIdentityFields
                type={advertiserType}
                name={advertiserName}
                document={advertiserDocument}
                onChangeType={setAdvertiserType}
                onChangeName={setAdvertiserName}
                onChangeDocument={setAdvertiserDocument}
              />
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
            </View>

            <View style={[styles.previewCol, wide && styles.previewColWide]}>
              <AdPreview formats={campaign.formats} blocks={blocks} />
            </View>
          </View>
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

  body: { padding: 16, paddingBottom: 48, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  columns: { gap: 10 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  formCol: { flex: 1, gap: 10, minWidth: 0, maxWidth: 640, width: '100%', alignSelf: 'center' },
  // Ver checkout.tsx: alinha o formulário ao topo no layout largo pra ele não
  // ficar centralizado verticalmente contra a coluna de preview mais alta.
  formColWide: { alignSelf: 'flex-start' },
  previewCol: { gap: 10 },
  previewColWide: { flex: 1, minWidth: 0, maxWidth: 420, position: 'sticky', top: 16 } as any,

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
