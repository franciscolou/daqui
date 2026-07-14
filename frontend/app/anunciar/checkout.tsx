import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { adsApi, AdFormat, AdObjective, AdsApiError, CreativeInput } from '../../lib/adsApi';

const MAX_CREATIVES = 3;

interface CreativeDraft {
  title: string;
  content: string;
  targetUrl: string;
  imageUrl: string;
  ctaLabel: string;
}

const emptyCreative = (): CreativeDraft => ({ title: '', content: '', targetUrl: '', imageUrl: '', ctaLabel: '' });

function CreativeFields({
  draft,
  onChange,
  Colors,
  styles,
  label,
}: {
  draft: CreativeDraft;
  onChange: (next: CreativeDraft) => void;
  Colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  label: string;
}) {
  return (
    <View style={styles.creativeBlock}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <TextInput style={styles.input} placeholder="Título" placeholderTextColor={Colors.textTertiary} value={draft.title} onChangeText={(v) => onChange({ ...draft, title: v })} />
      <TextInput style={[styles.input, styles.inputMultiline]} placeholder="Texto" placeholderTextColor={Colors.textTertiary} value={draft.content} onChangeText={(v) => onChange({ ...draft, content: v })} multiline />
      <TextInput style={styles.input} placeholder="Link de destino (ao tocar no anúncio)" placeholderTextColor={Colors.textTertiary} value={draft.targetUrl} onChangeText={(v) => onChange({ ...draft, targetUrl: v })} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="URL da imagem (opcional)" placeholderTextColor={Colors.textTertiary} value={draft.imageUrl} onChangeText={(v) => onChange({ ...draft, imageUrl: v })} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Texto do botão (opcional)" placeholderTextColor={Colors.textTertiary} value={draft.ctaLabel} onChangeText={(v) => onChange({ ...draft, ctaLabel: v })} />
    </View>
  );
}

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
  }>();

  const formats = useMemo<AdFormat[]>(() => JSON.parse(params.formats || '[]'), [params.formats]);
  const neighborhoods = useMemo<string[]>(() => JSON.parse(params.neighborhoods || '[]'), [params.neighborhoods]);
  const durationDays = Number(params.durationDays || 0);
  const citywide = params.citywide === 'true';
  const planId = params.planId ? Number(params.planId) : undefined;
  const targeting = useMemo(() => (params.targeting ? JSON.parse(params.targeting) : undefined), [params.targeting]);
  const schedule = useMemo(() => (params.schedule ? JSON.parse(params.schedule) : undefined), [params.schedule]);

  const [advertiserName, setAdvertiserName] = useState('');
  const [advertiserEmail, setAdvertiserEmail] = useState('');
  const [advertiserPhone, setAdvertiserPhone] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [creatives, setCreatives] = useState<CreativeDraft[]>([emptyCreative()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const primary = creatives[0];
  const canSubmit =
    advertiserName.trim() && advertiserEmail.trim() && primary.title.trim() && primary.targetUrl.trim() && !submitting;

  const addVariant = () => setCreatives((prev) => (prev.length < MAX_CREATIVES ? [...prev, emptyCreative()] : prev));
  const updateCreative = (index: number, next: CreativeDraft) =>
    setCreatives((prev) => prev.map((c, i) => (i === index ? next : c)));

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const extraCreatives: CreativeInput[] = creatives.slice(1)
        .filter((c) => c.title.trim() && c.targetUrl.trim())
        .map((c) => ({
          title: c.title.trim(),
          content: c.content.trim(),
          imageUrl: c.imageUrl.trim() || undefined,
          ctaLabel: c.ctaLabel.trim() || undefined,
          targetUrl: c.targetUrl.trim(),
        }));

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
        title: primary.title.trim(),
        content: primary.content.trim(),
        imageUrl: primary.imageUrl.trim() || undefined,
        ctaLabel: primary.ctaLabel.trim() || undefined,
        targetUrl: primary.targetUrl.trim(),
        latitude: latitude.trim() ? Number(latitude) : undefined,
        longitude: longitude.trim() ? Number(longitude) : undefined,
        extraCreatives: extraCreatives.length ? extraCreatives : undefined,
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
        <Text style={styles.headerTitle}>Dados do anúncio</Text>
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

        {creatives.map((draft, i) => (
          <CreativeFields
            key={i}
            draft={draft}
            onChange={(next) => updateCreative(i, next)}
            Colors={Colors}
            styles={styles}
            label={i === 0 ? 'O anúncio' : `Variante ${i + 1} (teste A/B)`}
          />
        ))}

        {creatives.length < MAX_CREATIVES && (
          <TouchableOpacity style={styles.addVariantBtn} onPress={addVariant}>
            <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
            <Text style={styles.addVariantText}>Adicionar variante (teste A/B)</Text>
          </TouchableOpacity>
        )}

        {formats.includes('post') && (
          <>
            <Text style={styles.sectionTitle}>Pin no mapa (opcional)</Text>
            <View style={styles.row2}>
              <TextInput style={[styles.input, styles.inputHalf]} placeholder="Latitude" placeholderTextColor={Colors.textTertiary} value={latitude} onChangeText={setLatitude} keyboardType="numeric" />
              <TextInput style={[styles.input, styles.inputHalf]} placeholder="Longitude" placeholderTextColor={Colors.textTertiary} value={longitude} onChangeText={setLongitude} keyboardType="numeric" />
            </View>
          </>
        )}

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
  creativeBlock: { gap: 10, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 14, padding: 12 },

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
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 10 },
  inputHalf: { flex: 1 },

  addVariantBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  addVariantText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  errorText: { fontSize: 12, fontWeight: '600', color: Colors.error },

  submitBtn: { marginTop: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
