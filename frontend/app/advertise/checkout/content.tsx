import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Palette } from '../../../constants/Colors';
import { DESKTOP_BREAKPOINT } from '../../../constants/config';
import { useTheme, useThemedStyles } from '../../../lib/theme';
import { goBack } from '../../../lib/navigation';
import { adsApi, AdFormat, AdObjective, AdvertiserType, AdsApiError, GeoScope } from '../../../lib/adsApi';
import { saveAdvertiserInfo, clearSavedAdvertiserInfo } from '../../../lib/storage';
import AdCreativeEditor, {
  CreativeBlocks,
  blocksToCreatives,
  creativesToBlocks,
  emptyCreativeBlocks,
} from '../../../components/AdCreativeEditor';
import AdPreview from '../../../components/AdPreview';
import { useT } from '../../../lib/i18n';

// Passo 2 de 2 do checkout: conteúdo do anúncio (criativos). Recebe do passo
// anterior (`checkout.tsx`) todos os dados da campanha + a identidade do
// anunciante já validada via route params, e é aqui que o checkout de
// verdade é criado.
export default function CheckoutContentScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const params = useLocalSearchParams<{
    formats: string;
    durationDays: string;
    startsAt?: string;
    geoScope: string;
    neighborhoods: string;
    city: string;
    cities: string;
    planId?: string;
    objective?: string;
    priority?: string;
    rotationWeight?: string;
    perUserImpressionCap?: string;
    targeting?: string;
    schedule?: string;
    prefill?: string;
    renewedFromToken?: string;
    advertiserType: string;
    advertiserName: string;
    advertiserDocument: string;
    advertiserEmail: string;
    advertiserPhone: string;
    rememberInfo: string;
  }>();

  const formats = useMemo<AdFormat[]>(() => JSON.parse(params.formats || '[]'), [params.formats]);
  const neighborhoods = useMemo<string[]>(() => JSON.parse(params.neighborhoods || '[]'), [params.neighborhoods]);
  const cities = useMemo<string[]>(() => JSON.parse(params.cities || '[]'), [params.cities]);
  const durationDays = Number(params.durationDays || 0);
  const geoScope = (params.geoScope || 'neighborhood') as GeoScope;
  const city = params.city || undefined;
  const planId = params.planId ? Number(params.planId) : undefined;
  const targeting = useMemo(() => (params.targeting ? JSON.parse(params.targeting) : undefined), [params.targeting]);
  const schedule = useMemo(() => (params.schedule ? JSON.parse(params.schedule) : undefined), [params.schedule]);
  const prefill = useMemo(() => (params.prefill ? JSON.parse(params.prefill) : null), [params.prefill]);

  const advertiserType = params.advertiserType as AdvertiserType;
  const advertiserName = params.advertiserName;
  const advertiserDocument = params.advertiserDocument;
  const advertiserEmail = params.advertiserEmail;
  const advertiserPhone = params.advertiserPhone;
  const rememberInfo = params.rememberInfo === '1';

  const { width } = useWindowDimensions();
  const wide = width >= DESKTOP_BREAKPOINT;

  const [blocks, setBlocks] = useState<CreativeBlocks>(() =>
    prefill?.creatives ? creativesToBlocks(prefill.creatives) : emptyCreativeBlocks(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Campanha com o formato "mapa" precisa de um ponto marcado — sem ele o
  // anúncio não teria pin nenhum pra mostrar (o ads-backend recusa, ver
  // `schemas/ad.py::check_map_has_pin`).
  const missingPin = formats.includes('map') && blocks.default.locationStatus !== 'valid';

  const canSubmit = !!(blocks.default.title.trim() && blocks.default.targetUrl.trim() && !missingPin && !submitting);

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const { checkoutUrl } = await adsApi.createAdCheckout({
        planId,
        formats,
        durationDays,
        startsAt: params.startsAt || undefined,
        geoScope,
        neighborhoods,
        city,
        cities,
        targeting,
        schedule,
        objective: (params.objective as AdObjective) || undefined,
        priority: params.priority ? Number(params.priority) : undefined,
        rotationWeight: params.rotationWeight ? Number(params.rotationWeight) : undefined,
        perUserImpressionCap: params.perUserImpressionCap ? Number(params.perUserImpressionCap) : undefined,
        advertiserName,
        advertiserEmail,
        advertiserPhone,
        advertiserType,
        advertiserDocument,
        creatives: blocksToCreatives(blocks),
        renewedFromToken: params.renewedFromToken || undefined,
      });
      if (rememberInfo) {
        await saveAdvertiserInfo({
          type: advertiserType,
          name: advertiserName,
          document: advertiserDocument,
          email: advertiserEmail,
          phone: advertiserPhone,
        });
      } else {
        await clearSavedAdvertiserInfo();
      }
      await Linking.openURL(checkoutUrl);
    } catch (e) {
      setError(e instanceof AdsApiError ? e.message : t('ads.checkout.paymentError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/advertise')}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t(params.renewedFromToken ? 'ads.checkout.reactivate' : 'ads.checkout.adContent')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.columns, wide && styles.columnsWide]}>
          <View style={[styles.formCol, wide && styles.formColWide]}>
            <AdCreativeEditor formats={formats} value={blocks} onChange={setBlocks} />

            {missingPin && (
              <Text style={styles.hintText}>
                {t('ads.checkout.pinRequired')}
              </Text>
            )}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              activeOpacity={0.85}
              disabled={!canSubmit}
              onPress={submit}
            >
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>{t('ads.checkout.goToPayment')}</Text>}
            </TouchableOpacity>
          </View>

          <View style={[styles.previewCol, wide && styles.previewColWide]}>
            <AdPreview formats={formats} blocks={blocks} />
          </View>
        </View>
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
  body: { padding: 16, paddingBottom: 48, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  columns: { gap: 10 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  formCol: { flex: 1, gap: 10, minWidth: 0, maxWidth: 640, width: '100%', alignSelf: 'center' },
  // Ver checkout.tsx (passo 1): alinha o formulário ao topo no layout largo
  // pra ele não ficar centralizado verticalmente contra a coluna de preview.
  formColWide: { alignSelf: 'flex-start' },
  previewCol: { gap: 10 },
  previewColWide: { flex: 1, minWidth: 0, maxWidth: 420, position: 'sticky', top: 16 } as any,

  errorText: { fontSize: 12, fontWeight: '600', color: Colors.error },
  hintText: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary },

  submitBtn: { marginTop: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
