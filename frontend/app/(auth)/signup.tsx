import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../lib/auth';
import { api, ApiError, NeighborhoodStats } from '../../lib/api';
import { getDeviceCoords, LocationError } from '../../lib/location';
import { submitOnEnter } from '../../lib/keyboard';

const STEPS = ['Conta', 'Bairro', 'Pronto'];

type GeoStatus = 'idle' | 'locating' | 'resolved' | 'error';

export default function SignupScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { signup } = useAuth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bairro designado pela localização do dispositivo
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('São Paulo');
  const [uf, setUf] = useState('SP');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [stats, setStats] = useState<NeighborhoodStats | null>(null);

  // Descobre o bairro a partir das coordenadas do aparelho.
  const detectLocation = async () => {
    setError(null);
    setGeoStatus('locating');
    try {
      const c = await getDeviceCoords();
      const res = await api.resolveNeighborhood(c.latitude, c.longitude);
      setNeighborhood(res.neighborhood);
      setCity(res.city);
      setUf(res.state);
      setCoords({ latitude: res.latitude, longitude: res.longitude });
      setGeoStatus('resolved');
    } catch (e) {
      setGeoStatus('error');
      if (e instanceof LocationError) {
        setError(
          e.reason === 'denied'
            ? 'Permita o acesso à localização para descobrirmos seu bairro.'
            : 'Não conseguimos obter sua localização. Tente novamente.',
        );
      } else if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('Não foi possível identificar seu bairro.');
      }
    }
  };

  // Step 0 → valida a conta e já dispara a detecção do bairro.
  const goToLocation = () => {
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('Preencha nome, e-mail e senha.');
      return;
    }
    setStep(1);
    detectLocation();
  };

  // Step 1 → o usuário aceita o bairro designado e a conta é criada.
  const acceptNeighborhood = async () => {
    if (submitting || !coords) return;
    setError(null);
    setSubmitting(true);
    try {
      await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        neighborhood,
        city,
        state: uf,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      api.getNeighborhoodStats().then(setStats).catch(() => {});
      setStep(2);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao criar conta.');
    } finally {
      setSubmitting(false);
    }
  };

  const headerTitle =
    step === 0 ? 'Crie sua conta' : step === 1 ? 'Onde você mora?' : 'Tudo certo!';
  const headerSubtitle =
    step === 0
      ? 'Junte-se a milhares de vizinhos'
      : step === 1
      ? 'Seu bairro é definido por onde você está'
      : 'Sua conta foi criada com sucesso';

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollOuter}
        contentContainerStyle={[styles.scroll, isWide && styles.scrollWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, isWide && styles.cardWide]}>
          {/* Header */}
          <LinearGradient
            colors={['#0D2918', '#15803D']}
            style={[styles.header, isWide && styles.headerWide]}
          >
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => (step > 0 ? setStep(step - 1) : router.back())}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            {/* Step indicator */}
            <View style={styles.stepRow}>
              {STEPS.map((s, i) => (
                <View key={s} style={styles.stepItem}>
                  <View style={[
                    styles.stepDot,
                    i <= step && styles.stepDotActive,
                    i < step && styles.stepDotDone,
                  ]}>
                    {i < step
                      ? <Ionicons name="checkmark" size={13} color="#fff" />
                      : <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>{i + 1}</Text>
                    }
                  </View>
                  <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{s}</Text>
                  {i < STEPS.length - 1 && (
                    <View style={[styles.stepLine, i < step && styles.stepLineActive]} />
                  )}
                </View>
              ))}
            </View>

            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
          </LinearGradient>

          {/* Conteúdo do step */}
          <View style={styles.form}>
            {step === 0 && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nome completo</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Seu nome"
                      placeholderTextColor={Colors.textTertiary}
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                      onKeyPress={submitOnEnter(goToLocation)}
                      onSubmitEditing={goToLocation}
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>E-mail</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="seu@email.com"
                      placeholderTextColor={Colors.textTertiary}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onKeyPress={submitOnEnter(goToLocation)}
                      onSubmitEditing={goToLocation}
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Senha</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Mínimo 8 caracteres"
                      placeholderTextColor={Colors.textTertiary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      onKeyPress={submitOnEnter(goToLocation)}
                      onSubmitEditing={goToLocation}
                    />
                  </View>
                </View>
              </>
            )}

            {step === 1 && (
              <View style={styles.geoArea}>
                {geoStatus === 'locating' && (
                  <>
                    <View style={styles.geoSpinnerWrap}>
                      <ActivityIndicator color={Colors.primary} size="large" />
                    </View>
                    <Text style={styles.geoLocatingTitle}>Descobrindo seu bairro…</Text>
                    <Text style={styles.geoLocatingDesc}>
                      Estamos usando a localização do seu aparelho para encontrar sua comunidade.
                    </Text>
                  </>
                )}

                {geoStatus === 'resolved' && (
                  <>
                    <View style={styles.emblemWrap}>
                      <LinearGradient colors={Colors.gradient.primary} style={styles.emblem}>
                        <Ionicons name="location" size={40} color="#fff" />
                      </LinearGradient>
                      <View style={styles.emblemPulse} />
                    </View>
                    <Text style={styles.geoEyebrow}>Você está em</Text>
                    <Text style={styles.geoNeighborhood}>{neighborhood}</Text>
                    <Text style={styles.geoCity}>{city}{uf ? ` - ${uf}` : ''}</Text>

                    <View style={styles.hintBox}>
                      <Ionicons name="information-circle" size={18} color={Colors.primaryDark} />
                      <Text style={styles.hintText}>
                        Sua comunidade é definida por onde você está agora. Se você não está no
                        seu bairro neste momento, é melhor se cadastrar quando estiver lá.
                      </Text>
                    </View>
                  </>
                )}

                {geoStatus === 'error' && (
                  <>
                    <View style={styles.geoErrorIcon}>
                      <Ionicons name="location-outline" size={34} color={Colors.error} />
                    </View>
                    <Text style={styles.geoLocatingTitle}>Não encontramos seu bairro</Text>
                    <Text style={styles.geoLocatingDesc}>
                      {error ?? 'Verifique a permissão de localização e tente novamente.'}
                    </Text>
                  </>
                )}
              </View>
            )}

            {step === 2 && (
              <View style={styles.successArea}>
                <View style={styles.successIconWrap}>
                  <LinearGradient colors={Colors.gradient.primary} style={styles.successIcon}>
                    <Ionicons name="checkmark" size={36} color="#fff" />
                  </LinearGradient>
                </View>
                <Text style={styles.successTitle}>Bem-vindo ao Daqui! 🎉</Text>
                <Text style={styles.successDesc}>
                  Você agora faz parte da comunidade da{' '}
                  <Text style={styles.successNeighborhood}>{neighborhood}</Text>.
                  Conheça seus vizinhos e fique por dentro do que acontece no seu bairro.
                </Text>
                <View style={styles.statsRow}>
                  {[
                    { num: stats ? String(stats.neighbors) : '—', label: 'vizinhos' },
                    { num: stats ? String(stats.posts) : '—', label: 'posts' },
                  ].map((s, i, arr) => (
                    <View key={s.label} style={styles.statWrap}>
                      <View style={styles.stat}>
                        <Text style={styles.statNum}>{s.num}</Text>
                        <Text style={styles.statLabel}>{s.label}</Text>
                      </View>
                      {i < arr.length - 1 && <View style={styles.statDivider} />}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {error && step !== 1 && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* CTA — comportamento por step */}
            {step === 1 && geoStatus === 'locating' ? (
              <View style={[styles.btnPrimary, styles.btnDisabled]}>
                <View style={styles.btnGradientPlain}>
                  <ActivityIndicator color="#fff" />
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.btnPrimary, submitting && styles.btnDisabled]}
                onPress={
                  step === 0
                    ? goToLocation
                    : step === 1
                    ? geoStatus === 'resolved'
                      ? acceptNeighborhood
                      : detectLocation
                    : () => router.replace('/(tabs)')
                }
                activeOpacity={0.85}
                disabled={submitting}
              >
                <LinearGradient
                  colors={Colors.gradient.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btnGradient}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.btnText}>
                        {step === 0
                          ? 'Continuar'
                          : step === 1
                          ? geoStatus === 'resolved'
                            ? 'Sim, é aqui que eu moro'
                            : 'Tentar novamente'
                          : 'Explorar o bairro'}
                      </Text>
                      <Ionicons
                        name={
                          step === 1 && geoStatus === 'resolved'
                            ? 'checkmark'
                            : step === 2
                            ? 'home'
                            : 'arrow-forward'
                        }
                        size={18}
                        color="#fff"
                      />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {step === 0 && (
              <View style={styles.altRow}>
                <Text style={styles.altText}>Já tem conta? </Text>
                <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                  <Text style={styles.altLink}>Entrar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F0FDF4',
  },
  scrollOuter: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  scrollWide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  cardWide: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 24,
    ...Colors.shadow.lg,
  },

  // Header
  header: {
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 28,
  },
  headerWide: {
    paddingTop: 32,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepDotDone: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  stepNum: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
  },
  stepNumActive: { color: '#fff' },
  stepLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    marginLeft: 5,
    fontWeight: '500',
  },
  stepLabelActive: { color: 'rgba(255,255,255,0.9)' },
  stepLine: {
    width: 18,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 4,
  },
  stepLineActive: { backgroundColor: Colors.primary },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 3,
  },

  // Form
  form: {
    padding: 28,
  },
  inputGroup: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 7,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 13,
    height: 50,
  },
  inputIcon: { marginRight: 9 },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },

  // Localização (step 1)
  geoArea: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 20,
  },
  geoSpinnerWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  geoLocatingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  geoLocatingDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  emblemWrap: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblem: {
    width: 96,
    height: 96,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...Colors.shadow.lg,
  },
  emblemPulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
    opacity: 0.6,
  },
  geoEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  geoNeighborhood: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 4,
  },
  geoCity: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 20,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  geoErrorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  // Sucesso (step 2)
  successArea: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  successIconWrap: { marginBottom: 20 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Colors.shadow.lg,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  successDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  successNeighborhood: { color: Colors.primaryDark, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    width: '100%',
  },
  statWrap: {
    flex: 1,
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statNum: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },

  // CTA
  btnPrimary: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 20,
    ...Colors.shadow.md,
  },
  btnDisabled: { opacity: 0.7 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.error + '12',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.error, fontWeight: '500' },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  btnGradientPlain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: Colors.primary,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  altRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  altText: { fontSize: 14, color: Colors.textSecondary },
  altLink: { fontSize: 14, color: Colors.primaryDark, fontWeight: '700' },
});
