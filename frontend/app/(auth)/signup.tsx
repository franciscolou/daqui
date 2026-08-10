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
import GoogleSignInButton from '../../components/GoogleSignInButton';
import { Colors } from '../../constants/Colors';
import { useT } from '../../lib/i18n';
import { submitOnEnter } from '../../lib/keyboard';
import { goBack } from '../../lib/navigation';
import { useAuth } from '../../lib/auth';
import { AvailabilityState } from '../../lib/useAvailability';
import { useSignupFlow } from '../../lib/useSignupFlow';

// Indicador de status de disponibilidade (dentro do input).
function AvailabilityIcon({ state }: { state: AvailabilityState }) {
  if (state.status === 'checking') return <ActivityIndicator size="small" color={Colors.textTertiary} />;
  if (state.status === 'ok') return <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />;
  if (state.status === 'error') return <Ionicons name="close-circle" size={18} color={Colors.error} />;
  return null;
}

export default function SignupScreen() {
  const { t } = useT();
  const STEPS = [t('auth.signup.steps.account'), t('auth.signup.steps.verify'), t('auth.signup.steps.done')];
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const {
    step, setStep, name, setName, username, setUsername, email, setEmail, password, setPassword,
    showPassword, setShowPassword, usernameCheck, emailCheck, submitting, error,
    code, onCodeChange, resending, resent,
    createAccount, handleVerify, handleResend,
  } = useSignupFlow();
  const { loginWithGoogle } = useAuth();
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleToken = async (idToken: string) => {
    setGoogleError(null);
    try {
      const result = await loginWithGoogle(idToken);
      if (result.status === 'needs_username') {
        router.push({ pathname: '/(auth)/google-username', params: { ticket: result.ticket } });
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      setGoogleError(t('auth.login.googleError'));
    }
  };

  const headerTitle = step === 0 ? t('auth.signup.title') : step === 1 ? t('auth.signup.verifyTitle') : t('auth.signup.doneTitle');
  const headerSubtitle =
    step === 0 ? t('auth.signup.subtitle')
    : step === 1 ? t('auth.signup.verifySubtitle')
    : t('auth.signup.doneSubtitle');

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
              onPress={() => {
                // Depois de criar a conta não dá pra voltar a editar o cadastro
                // (já existe no backend) — volta pro login, de onde dá pra
                // completar a verificação de novo a qualquer momento.
                if (step === 1) router.replace('/(auth)/login');
                else if (step > 0) setStep(step - 1);
                else goBack('/(auth)/welcome');
              }}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
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
                  <Text style={styles.label}>{t('auth.signup.fullName')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('auth.signup.fullNamePlaceholder')}
                      placeholderTextColor={Colors.textTertiary}
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                      onKeyPress={submitOnEnter(createAccount)}
                      onSubmitEditing={createAccount}
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('auth.signup.username')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="at-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('auth.signup.usernamePlaceholder')}
                      placeholderTextColor={Colors.textTertiary}
                      value={username}
                      onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={18}
                      onKeyPress={submitOnEnter(createAccount)}
                      onSubmitEditing={createAccount}
                    />
                    <AvailabilityIcon state={usernameCheck} />
                  </View>
                  {usernameCheck.status === 'error' && !!usernameCheck.error && (
                    <Text style={styles.fieldError}>{usernameCheck.error}</Text>
                  )}
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('auth.signup.email')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('auth.emailPlaceholder')}
                      placeholderTextColor={Colors.textTertiary}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onKeyPress={submitOnEnter(createAccount)}
                      onSubmitEditing={createAccount}
                    />
                    <AvailabilityIcon state={emailCheck} />
                  </View>
                  {emailCheck.status === 'error' && !!emailCheck.error && (
                    <Text style={styles.fieldError}>{emailCheck.error}</Text>
                  )}
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('auth.signup.password')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputFlex}
                      placeholder={t('auth.signup.passwordPlaceholder')}
                      placeholderTextColor={Colors.textTertiary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      onKeyPress={submitOnEnter(createAccount)}
                      onSubmitEditing={createAccount}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={Colors.textTertiary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {step === 1 && (
              <View>
                <View style={styles.twoFaIntro}>
                  <Ionicons name="mail-open-outline" size={22} color={Colors.primary} />
                  <Text style={styles.twoFaText}>
                    {t('auth.signup.sentCodeTo')} <Text style={{ fontWeight: '700' }}>{email.trim()}</Text>.
                    {' '}{t('auth.signup.codeValidFor')}
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('auth.signup.verificationCode')}</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="keypad-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="000000"
                      placeholderTextColor={Colors.textTertiary}
                      value={code}
                      onChangeText={onCodeChange}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                      onKeyPress={submitOnEnter(handleVerify)}
                      onSubmitEditing={handleVerify}
                    />
                  </View>
                </View>

                <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.altRow}>
                  <Text style={styles.altLink}>
                    {resending ? t('auth.login.resending') : resent ? t('auth.login.resent') : t('auth.login.resendCode')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 2 && (
              <View style={styles.successArea}>
                <View style={styles.successIconWrap}>
                  <LinearGradient colors={Colors.gradient.primary} style={styles.successIcon}>
                    <Ionicons name="checkmark" size={36} color="#fff" />
                  </LinearGradient>
                </View>
                <Text style={styles.successTitle}>{t('auth.signup.welcomeTitle')}</Text>
                <Text style={styles.successDesc}>
                  {t('auth.signup.welcomeDesc')}
                </Text>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* CTA — comportamento por step */}
            <TouchableOpacity
              style={[styles.btnPrimary, submitting && styles.btnDisabled]}
              onPress={
                step === 0 ? createAccount
                : step === 1 ? handleVerify
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
                      {step === 0 ? t('auth.signup.continueLabel') : step === 1 ? t('auth.signup.verify') : t('auth.signup.startUsing')}
                    </Text>
                    <Ionicons
                      name={step === 2 ? 'navigate' : 'arrow-forward'}
                      size={18}
                      color="#fff"
                    />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {step === 0 && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t('auth.login.orContinueWith')}</Text>
                  <View style={styles.dividerLine} />
                </View>

                {googleError && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color={Colors.error} />
                    <Text style={styles.errorText}>{googleError}</Text>
                  </View>
                )}

                <View style={styles.socialRow}>
                  <GoogleSignInButton
                    style={styles.socialBtn}
                    textStyle={styles.socialText}
                    onIdToken={handleGoogleToken}
                    onError={setGoogleError}
                  />
                </View>
              </>
            )}

            {step === 0 && (
              <View style={styles.altRow}>
                <Text style={styles.altText}>{t('auth.signup.haveAccount')}</Text>
                <TouchableOpacity style={styles.altLinkBtn} onPress={() => router.replace('/(auth)/login')}>
                  <Text style={styles.altLink}>{t('auth.signup.signIn')}</Text>
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
  fieldError: { fontSize: 12, color: Colors.error, marginTop: 6, fontWeight: '500' },
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
  inputFlex: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  eyeBtn: { padding: 4, borderRadius: 8 },

  // Verificação de e-mail (step 1)
  twoFaIntro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  twoFaText: { flex: 1, fontSize: 13, color: Colors.primaryDark, lineHeight: 18 },

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
  altLinkBtn: { borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2, marginHorizontal: -4, marginVertical: -2 },
  altLink: { fontSize: 14, color: Colors.primaryDark, fontWeight: '700' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  socialText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
});
