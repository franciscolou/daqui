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
import { api, ApiError } from '../../lib/api';
import { submitOnEnter } from '../../lib/keyboard';
import { useAvailability, AvailabilityState } from '../../lib/useAvailability';

const STEPS = ['Conta', 'Verificar', 'Pronto'];

const emailLooksReady = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

// Indicador de status de disponibilidade (dentro do input).
function AvailabilityIcon({ state }: { state: AvailabilityState }) {
  if (state.status === 'checking') return <ActivityIndicator size="small" color={Colors.textTertiary} />;
  if (state.status === 'ok') return <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />;
  if (state.status === 'error') return <Ionicons name="close-circle" size={18} color={Colors.error} />;
  return null;
}

export default function SignupScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { signup, verifyEmailCode, resendVerification } = useAuth();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Validação em tempo real (formato + disponibilidade) de username e e-mail.
  const usernameCheck = useAvailability(username, api.checkSignupUsername, {
    ready: (v) => v.length >= 3,
  });
  const emailCheck = useAvailability(email, api.checkSignupEmail, { ready: emailLooksReady });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Verificação do e-mail (código de 6 dígitos, válido por 10min): ticket
  // identifica essa verificação pendente (devolvido pelo cadastro/reenvio).
  const [ticket, setTicket] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Cria a conta (sem localização — o bairro é configurado depois, em "Meu
  // bairro"; o usuário entra direto vendo "Perto de mim"). A conta só fica
  // utilizável depois de confirmar o código enviado por e-mail (step 1).
  const createAccount = async () => {
    setError(null);
    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      setError('Preencha nome, usuário, e-mail e senha.');
      return;
    }
    if (usernameCheck.status === 'checking' || emailCheck.status === 'checking') {
      setError('Aguarde a verificação do usuário e do e-mail.');
      return;
    }
    if (usernameCheck.status !== 'ok') {
      setError(usernameCheck.error ?? 'Escolha um nome de usuário válido e disponível.');
      return;
    }
    if (emailCheck.status !== 'ok') {
      setError(emailCheck.error ?? 'Informe um e-mail válido e disponível.');
      return;
    }
    setSubmitting(true);
    try {
      const t = await signup({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      });
      setTicket(t);
      setCode('');
      setStep(1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao criar conta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (submitting || !ticket) return;
    setError(null);
    if (code.trim().length < 6) {
      setError('Digite o código de 6 dígitos que enviamos por e-mail.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyEmailCode(ticket, code.trim());
      setStep(2);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível verificar o código.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resending || !ticket) return;
    setError(null);
    setResent(false);
    setResending(true);
    try {
      setTicket(await resendVerification(ticket));
      setCode('');
      setResent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível reenviar o código.');
    } finally {
      setResending(false);
    }
  };

  const headerTitle = step === 0 ? 'Crie sua conta' : step === 1 ? 'Confirme seu e-mail' : 'Tudo certo!';
  const headerSubtitle =
    step === 0 ? 'Junte-se a milhares de vizinhos'
    : step === 1 ? 'Enviamos um código de 6 dígitos para você'
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
              onPress={() => {
                // Depois de criar a conta não dá pra voltar a editar o cadastro
                // (já existe no backend) — volta pro login, de onde dá pra
                // completar a verificação de novo a qualquer momento.
                if (step === 1) router.replace('/(auth)/login');
                else if (step > 0) setStep(step - 1);
                else router.back();
              }}
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
                      onKeyPress={submitOnEnter(createAccount)}
                      onSubmitEditing={createAccount}
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nome de usuário</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="at-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="seu.usuario"
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
                  <Text style={styles.label}>Senha</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputFlex}
                      placeholder="Mínimo 8 caracteres"
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
                    Enviamos um código de 6 dígitos para <Text style={{ fontWeight: '700' }}>{email.trim()}</Text>.
                    Ele vale por 10 minutos.
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Código de verificação</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="keypad-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="000000"
                      placeholderTextColor={Colors.textTertiary}
                      value={code}
                      onChangeText={(t) => { setCode(t.replace(/[^0-9]/g, '').slice(0, 6)); setResent(false); }}
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
                    {resending ? 'Reenviando…' : resent ? 'Código reenviado ✓' : 'Reenviar código'}
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
                <Text style={styles.successTitle}>Bem-vindo ao Daqui! 🎉</Text>
                <Text style={styles.successDesc}>
                  Sua conta foi criada. Você já pode ver o que está rolando perto de você em
                  "Perto de mim" — quando quiser, configure "Meu bairro" para participar da
                  comunidade onde você mora.
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
                      {step === 0 ? 'Continuar' : step === 1 ? 'Verificar' : 'Começar a usar o Daqui'}
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
  altLink: { fontSize: 14, color: Colors.primaryDark, fontWeight: '700' },
});
