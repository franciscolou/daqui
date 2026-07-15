import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { adsApi, AdFormat, AdObjective, AdsApiError } from '../../lib/adsApi';
import AdCreativeEditor, {
  CreativeBlocks,
  blocksToCreatives,
  creativesToBlocks,
  emptyCreativeBlocks,
} from '../../components/AdCreativeEditor';

export default function CheckoutScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{
    formats: string;
    durationDays: string;
    neighborhoods: string;
    citywide: string;
    planId?: string;
    objective?: string;
    priority?: string;
    rotationWeight?: string;
    pacing?: string;
    dailyImpressionCap?: string;
    perUserImpressionCap?: string;
    targeting?: string;
    schedule?: string;
    prefill?: string;
    renewedFromToken?: string;
  }>();

  const formats = useMemo<AdFormat[]>(() => JSON.parse(params.formats || '[]'), [params.formats]);
  const neighborhoods = useMemo<string[]>(() => JSON.parse(params.neighborhoods || '[]'), [params.neighborhoods]);
  const durationDays = Number(params.durationDays || 0);
  const citywide = params.citywide === 'true';
  const planId = params.planId ? Number(params.planId) : undefined;
  const targeting = useMemo(() => (params.targeting ? JSON.parse(params.targeting) : undefined), [params.targeting]);
  const schedule = useMemo(() => (params.schedule ? JSON.parse(params.schedule) : undefined), [params.schedule]);
  const prefill = useMemo(() => (params.prefill ? JSON.parse(params.prefill) : null), [params.prefill]);

  const [advertiserName, setAdvertiserName] = useState(prefill?.advertiserName ?? '');
  const [advertiserEmail, setAdvertiserEmail] = useState(prefill?.advertiserEmail ?? '');
  const [advertiserPhone, setAdvertiserPhone] = useState(prefill?.advertiserPhone ?? '');
  const [blocks, setBlocks] = useState<CreativeBlocks>(() =>
    prefill?.creatives ? creativesToBlocks(prefill.creatives) : emptyCreativeBlocks(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit =
    advertiserName.trim() && advertiserEmail.trim() &&
    blocks.default.title.trim() && blocks.default.targetUrl.trim() && !submitting;

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const { checkoutUrl } = await adsApi.createAdCheckout({
        planId,
        formats,
        durationDays,
        neighborhoods,
        citywide,
        targeting,
        schedule,
        objective: (params.objective as AdObjective) || undefined,
        priority: params.priority ? Number(params.priority) : undefined,
        rotationWeight: params.rotationWeight ? Number(params.rotationWeight) : undefined,
        pacing: (params.pacing as 'asap' | 'even') || undefined,
        dailyImpressionCap: params.dailyImpressionCap ? Number(params.dailyImpressionCap) : undefined,
        perUserImpressionCap: params.perUserImpressionCap ? Number(params.perUserImpressionCap) : undefined,
        advertiserName: advertiserName.trim(),
        advertiserEmail: advertiserEmail.trim(),
        advertiserPhone: advertiserPhone.trim(),
        creatives: blocksToCreatives(blocks),
        renewedFromToken: params.renewedFromToken || undefined,
      });
      await Linking.openURL(checkoutUrl);
    } catch (e) {
      setError(e instanceof AdsApiError ? e.message : 'Não foi possível iniciar o pagamento. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{params.renewedFromToken ? 'Reativar campanha' : 'Dados do anúncio'}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.summary}>
          {durationDays} dias · {citywide ? 'cidade toda' : neighborhoods.join(', ')}
        </Text>

        <Text style={styles.sectionTitle}>Seus dados</Text>
        <TextInput style={styles.input} placeholder="Nome / empresa" placeholderTextColor={Colors.textTertiary} value={advertiserName} onChangeText={setAdvertiserName} />
        <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor={Colors.textTertiary} value={advertiserEmail} onChangeText={setAdvertiserEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Telefone (opcional)" placeholderTextColor={Colors.textTertiary} value={advertiserPhone} onChangeText={setAdvertiserPhone} />

        <AdCreativeEditor formats={formats} value={blocks} onChange={setBlocks} />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          activeOpacity={0.85}
          disabled={!canSubmit}
          onPress={submit}
        >
          {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Ir para o pagamento</Text>}
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

  summary: { fontSize: 13, color: Colors.textTertiary },
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
