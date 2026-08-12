import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { goBack } from '../../lib/navigation';
import { AdvertiserType } from '../../lib/adsApi';
import { isValidDocument } from '../../lib/brDocuments';
import { getSavedAdvertiserInfo } from '../../lib/storage';
import AdvertiserIdentityFields from '../../components/AdvertiserIdentityFields';
import { useT } from '../../lib/i18n';

// Passo 1 de 2 do checkout: só identidade/contato de quem está anunciando.
// O conteúdo do anúncio (criativos) fica no passo seguinte
// (`checkout/content.tsx`), que recebe tudo daqui via route params — nada é
// enviado ao backend ainda neste passo.
export default function CheckoutDetailsScreen() {
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
  }>();

  const durationDays = Number(params.durationDays || 0);
  const geoScope = params.geoScope || 'neighborhood';
  const city = params.city || undefined;
  const neighborhoods: string[] = params.neighborhoods ? JSON.parse(params.neighborhoods) : [];
  const cities: string[] = params.cities ? JSON.parse(params.cities) : [];
  const prefill = params.prefill ? JSON.parse(params.prefill) : null;

  const [advertiserType, setAdvertiserType] = useState<AdvertiserType>(prefill?.advertiserType ?? 'individual');
  const [advertiserName, setAdvertiserName] = useState(prefill?.advertiserName ?? '');
  const [advertiserDocument, setAdvertiserDocument] = useState(prefill?.advertiserDocument ?? '');
  const [advertiserEmail, setAdvertiserEmail] = useState(prefill?.advertiserEmail ?? '');
  const [advertiserPhone, setAdvertiserPhone] = useState(prefill?.advertiserPhone ?? '');
  const [rememberInfo, setRememberInfo] = useState(true);

  // Renovação (`prefill`) já traz os dados da campanha anterior — não
  // sobrescreve com o que ficou lembrado de uma campanha diferente.
  useEffect(() => {
    if (prefill) return;
    getSavedAdvertiserInfo().then((saved) => {
      if (!saved) return;
      setAdvertiserType(saved.type);
      setAdvertiserName(saved.name);
      setAdvertiserDocument(saved.document);
      setAdvertiserEmail(saved.email);
      setAdvertiserPhone(saved.phone);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canContinue = !!(
    advertiserName.trim() && advertiserEmail.trim() && isValidDocument(advertiserType, advertiserDocument)
  );

  const goToContent = () => {
    router.push({
      pathname: '/advertise/checkout/content',
      params: {
        formats: params.formats || '[]',
        durationDays: params.durationDays || '0',
        startsAt: params.startsAt ?? '',
        geoScope: params.geoScope || 'neighborhood',
        neighborhoods: params.neighborhoods || '[]',
        city: params.city ?? '',
        cities: params.cities || '[]',
        planId: params.planId ?? '',
        objective: params.objective ?? '',
        priority: params.priority ?? '',
        rotationWeight: params.rotationWeight ?? '',
        perUserImpressionCap: params.perUserImpressionCap ?? '',
        targeting: params.targeting ?? '',
        schedule: params.schedule ?? '',
        prefill: params.prefill ?? '',
        renewedFromToken: params.renewedFromToken ?? '',
        advertiserType,
        advertiserName: advertiserName.trim(),
        advertiserDocument: advertiserDocument.trim(),
        advertiserEmail: advertiserEmail.trim(),
        advertiserPhone: advertiserPhone.trim(),
        rememberInfo: rememberInfo ? '1' : '0',
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/advertise')}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t(params.renewedFromToken ? 'ads.checkout.reactivate' : 'ads.checkout.yourDetails')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.formCol}>
          <Text style={styles.summary}>
            {t('ads.checkout.days', { count: durationDays })} ·{' '}
            {geoScope === 'country' ? t('ads.scope.country')
              : geoScope === 'citywide' ? (city || t('ads.scope.citywide'))
              : geoScope === 'cities' ? cities.join(', ')
              : neighborhoods.join(', ')}
          </Text>
          <Text style={styles.stepHint}>{t('ads.checkout.stepDetails')}</Text>

          <AdvertiserIdentityFields
            type={advertiserType}
            name={advertiserName}
            document={advertiserDocument}
            onChangeType={setAdvertiserType}
            onChangeName={setAdvertiserName}
            onChangeDocument={setAdvertiserDocument}
          />
          <TextInput style={styles.input} placeholder={t('ads.checkout.email')} placeholderTextColor={Colors.textTertiary} value={advertiserEmail} onChangeText={setAdvertiserEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder={t('ads.checkout.phoneOptional')} placeholderTextColor={Colors.textTertiary} value={advertiserPhone} onChangeText={setAdvertiserPhone} />

          <TouchableOpacity
            style={styles.rememberRow}
            activeOpacity={0.7}
            onPress={() => setRememberInfo((v) => !v)}
          >
            <Ionicons
              name={rememberInfo ? 'checkbox' : 'square-outline'}
              size={20}
              color={rememberInfo ? Colors.primary : Colors.textTertiary}
            />
            <Text style={styles.rememberText}>{t('ads.checkout.remember')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, !canContinue && styles.submitBtnDisabled]}
            activeOpacity={0.85}
            disabled={!canContinue}
            onPress={goToContent}
          >
            <Text style={styles.submitBtnText}>{t('ads.checkout.continue')}</Text>
          </TouchableOpacity>
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
  body: { padding: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  formCol: { gap: 10 },

  summary: { fontSize: 13, color: Colors.textTertiary },
  stepHint: { fontSize: 12, color: Colors.textTertiary, marginTop: -4, marginBottom: 4 },

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

  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', borderRadius: 8, paddingVertical: 2 },
  rememberText: { fontSize: 13, fontWeight: '600', color: Colors.text },

  submitBtn: { marginTop: 8, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
