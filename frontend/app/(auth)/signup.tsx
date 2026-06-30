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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Colors } from '../../constants/Colors';

const STEPS = ['Conta', 'Bairro', 'Pronto'];

export default function SignupScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');

  const nextStep = () => {
    if (step < 2) setStep(step + 1);
    else router.replace('/(tabs)');
  };

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

            <Text style={styles.headerTitle}>
              {step === 0 ? 'Crie sua conta' : step === 1 ? 'Onde você mora?' : 'Tudo certo!'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {step === 0
                ? 'Junte-se a milhares de vizinhos'
                : step === 1
                ? 'Conecte-se com seu bairro'
                : 'Sua conta foi criada com sucesso'}
            </Text>
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
                    />
                  </View>
                </View>
              </>
            )}

            {step === 1 && (
              <>
                <View style={styles.infoBox}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="location" size={22} color={Colors.primaryDark} />
                  </View>
                  <Text style={styles.infoText}>
                    Verificamos seu endereço para garantir que você realmente mora no bairro. Sua localização exata é privada.
                  </Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Bairro</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="home-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: Vila Madalena"
                      placeholderTextColor={Colors.textTertiary}
                      value={neighborhood}
                      onChangeText={setNeighborhood}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Cidade</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="business-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: São Paulo"
                      placeholderTextColor={Colors.textTertiary}
                      value={city}
                      onChangeText={setCity}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <TouchableOpacity style={styles.locationBtn}>
                  <Ionicons name="navigate" size={16} color={Colors.primaryDark} />
                  <Text style={styles.locationBtnText}>Usar minha localização atual</Text>
                </TouchableOpacity>
              </>
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
                  <Text style={styles.successNeighborhood}>{neighborhood || 'Vila Madalena'}</Text>.
                  Conheça seus vizinhos e fique por dentro do que acontece no seu bairro.
                </Text>
                <View style={styles.statsRow}>
                  {[
                    { num: '238', label: 'vizinhos' },
                    { num: '47',  label: 'posts hoje' },
                    { num: '3',   label: 'eventos' },
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

            <TouchableOpacity style={styles.btnPrimary} onPress={nextStep} activeOpacity={0.85}>
              <LinearGradient
                colors={Colors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                <Text style={styles.btnText}>
                  {step === 2 ? 'Explorar o bairro' : 'Continuar'}
                </Text>
                <Ionicons name={step === 2 ? 'home' : 'arrow-forward'} size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

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

  // Info box (step 1)
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    marginBottom: 4,
  },
  locationBtnText: {
    fontSize: 14,
    color: Colors.primaryDark,
    fontWeight: '600',
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
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
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
