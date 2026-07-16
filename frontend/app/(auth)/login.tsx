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
import { ApiError } from '../../lib/api';
import { submitOnEnter } from '../../lib/keyboard';
import { goBack } from '../../lib/navigation';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { login, verifyLogin2fa, verifyEmailCode, resendVerification } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 'login': formulário normal. 'verify'/'2fa': senha certa, mas falta um
  // segundo passo — guardamos o ticket devolvido e pedimos o código de 6 dígitos
  // (por e-mail não confirmado, ou por A2F, respectivamente).
  const [mode, setMode] = useState<'login' | 'verify' | '2fa'>('login');
  const [ticket, setTicket] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleLogin = async () => {
    if (submitting) return;
    setError(null);
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      if (result.status === '2fa' || result.status === 'verify') {
        setMode(result.status);
        setTicket(result.ticket);
        setCode('');
      } else {
        router.replace('/(tabs)');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (submitting) return;
    setError(null);
    if (code.trim().length < 6) {
      setError(
        mode === '2fa'
          ? 'Digite o código de 6 dígitos do seu app autenticador.'
          : 'Digite o código de 6 dígitos que enviamos por e-mail.',
      );
      return;
    }
    setSubmitting(true);
    try {
      if (mode === '2fa') await verifyLogin2fa(ticket!, code.trim());
      else await verifyEmailCode(ticket!, code.trim());
      router.replace('/(tabs)');
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

  const cancelSecondStep = () => {
    setMode('login');
    setTicket(null);
    setCode('');
    setError(null);
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
          {/* Header gradiente */}
          <LinearGradient
            colors={['#0D2918', '#15803D']}
            style={[styles.header, isWide && styles.headerWide]}
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => goBack('/(auth)/welcome')}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                <Ionicons name="location" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.logoText}>daqui</Text>
            </View>

            <Text style={styles.headerTitle}>
              {mode === '2fa' ? 'Verificação em duas etapas'
                : mode === 'verify' ? 'Confirme seu e-mail'
                : 'Bem-vindo de volta'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {mode === '2fa' ? 'Confirme sua identidade'
                : mode === 'verify' ? 'Enviamos um código de 6 dígitos para você'
                : 'Entre na sua conta'}
            </Text>
          </LinearGradient>

          {/* Formulário */}
          <View style={styles.form}>
            {mode !== 'login' ? (
              <View>
                <View style={styles.twoFaIntro}>
                  <Ionicons
                    name={mode === '2fa' ? 'shield-checkmark' : 'mail-open-outline'}
                    size={22}
                    color={Colors.primary}
                  />
                  <Text style={styles.twoFaText}>
                    {mode === '2fa'
                      ? 'Digite o código de 6 dígitos gerado pelo seu app autenticador (Google Authenticator, Authy, etc.).'
                      : 'Digite o código de 6 dígitos que enviamos por e-mail. Ele vale por 10 minutos.'}
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

                {mode === 'verify' && (
                  <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.forgotBtn}>
                    <Text style={styles.forgotText}>
                      {resending ? 'Reenviando…' : resent ? 'Código reenviado ✓' : 'Reenviar código'}
                    </Text>
                  </TouchableOpacity>
                )}

                {error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color={Colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.btnPrimary, submitting && styles.btnDisabled]}
                  onPress={handleVerify}
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
                        <Text style={styles.btnText}>Verificar</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.altRow} onPress={cancelSecondStep}>
                  <Text style={styles.altLink}>Voltar ao login</Text>
                </TouchableOpacity>
              </View>
            ) : (
            <>

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
                  autoCorrect={false}
                  onKeyPress={submitOnEnter(handleLogin)}
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputFlex}
                  placeholder="Sua senha"
                  placeholderTextColor={Colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onKeyPress={submitOnEnter(handleLogin)}
                  onSubmitEditing={handleLogin}
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

            <TouchableOpacity style={styles.forgotBtn} onPress={() => router.push('/(auth)/esqueci-senha')}>
              <Text style={styles.forgotText}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btnPrimary, submitting && styles.btnDisabled]}
              onPress={handleLogin}
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
                    <Text style={styles.btnText}>Entrar</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou continue com</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn}>
                <Ionicons name="logo-google" size={20} color="#EA4335" />
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialBtn}>
                <Ionicons name="logo-facebook" size={20} color="#1877F2" />
                <Text style={styles.socialText}>Facebook</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.altRow}>
              <Text style={styles.altText}>Não tem conta? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/signup')}>
                <Text style={styles.altLink}>Cadastre-se grátis</Text>
              </TouchableOpacity>
            </View>
            </>
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
    maxWidth: 460,
    borderRadius: 24,
    ...Colors.shadow.lg,
  },

  // Header
  header: {
    paddingTop: 56,
    paddingBottom: 32,
    paddingHorizontal: 28,
  },
  headerWide: {
    paddingTop: 36,
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },

  // Form
  form: {
    padding: 28,
  },
  inputGroup: {
    marginBottom: 16,
  },
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
  inputFlex: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  eyeBtn: { padding: 4, borderRadius: 8 },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 22,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  btnPrimary: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
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
    marginBottom: 14,
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
    marginBottom: 28,
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
  altRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  altText: { fontSize: 14, color: Colors.textSecondary },
  altLink: { fontSize: 14, color: Colors.primaryDark, fontWeight: '700' },

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
});
