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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Colors } from '../../constants/Colors';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { submitOnEnter } from '../../lib/keyboard';
import { useAvailability } from '../../lib/useAvailability';

function AvailabilityIcon({ status }: { status: 'idle' | 'checking' | 'ok' | 'error' }) {
  if (status === 'checking') return <ActivityIndicator size="small" color={Colors.textTertiary} />;
  if (status === 'ok') return <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />;
  if (status === 'error') return <Ionicons name="close-circle" size={18} color={Colors.error} />;
  return null;
}

// Último passo de "Entrar com Google" quando é a primeira vez desse usuário
// (ver GoogleSignInButton + useAuth().loginWithGoogle): a conta ainda não foi
// criada no backend, só o e-mail/nome/foto já validados pelo Google — falta
// escolher um nome de usuário antes de poder usar o Daqui. Aberta com
// ?ticket=... (ver lib/auth.tsx::loginWithGoogle, mesmo padrão do link de
// redefinição de senha em reset-password.tsx).
export default function GoogleUsernameScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { ticket } = useLocalSearchParams<{ ticket?: string }>();
  const { completeGoogleSignup } = useAuth();

  const [username, setUsername] = useState('');
  const usernameCheck = useAvailability(username, api.checkSignupUsername, {
    ready: (v) => v.length >= 3,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (submitting || !ticket) return;
    setError(null);
    if (!username.trim()) {
      setError('Escolha um nome de usuário.');
      return;
    }
    if (usernameCheck.status === 'checking') {
      setError('Aguarde a verificação do nome de usuário.');
      return;
    }
    if (usernameCheck.status !== 'ok') {
      setError(usernameCheck.error ?? 'Escolha um nome de usuário válido e disponível.');
      return;
    }
    setSubmitting(true);
    try {
      await completeGoogleSignup(ticket, username.trim());
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setSubmitting(false);
    }
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
          <LinearGradient
            colors={['#0D2918', '#15803D']}
            style={[styles.header, isWide && styles.headerWide]}
          >
            <Text style={styles.headerTitle}>Falta pouco!</Text>
            <Text style={styles.headerSubtitle}>Escolha um nome de usuário para começar</Text>
          </LinearGradient>

          <View style={styles.form}>
            {!ticket ? (
              <View style={styles.successArea}>
                <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
                <Text style={[styles.successDesc, { marginTop: 16 }]}>
                  Sessão de cadastro inválida ou expirada. Entre com o Google novamente.
                </Text>
                <TouchableOpacity style={styles.altRow} onPress={() => router.replace('/(auth)/login')}>
                  <Text style={styles.altLink}>Voltar ao login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
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
                      autoFocus
                      onKeyPress={submitOnEnter(handleSubmit)}
                      onSubmitEditing={handleSubmit}
                    />
                    <AvailabilityIcon status={usernameCheck.status} />
                  </View>
                  {usernameCheck.status === 'error' && !!usernameCheck.error && (
                    <Text style={styles.fieldError}>{usernameCheck.error}</Text>
                  )}
                </View>

                {error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color={Colors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.btnPrimary, submitting && styles.btnDisabled]}
                  onPress={handleSubmit}
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
                        <Text style={styles.btnText}>Começar a usar o Daqui</Text>
                        <Ionicons name="navigate" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F0FDF4' },
  scrollOuter: { flex: 1 },
  scroll: { flexGrow: 1 },
  scrollWide: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },

  card: { backgroundColor: Colors.surface, overflow: 'hidden' },
  cardWide: { width: '100%', maxWidth: 460, borderRadius: 24, ...Colors.shadow.lg },

  header: { paddingTop: 56, paddingBottom: 32, paddingHorizontal: 28 },
  headerWide: { paddingTop: 36, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  form: { padding: 28 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 7 },
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
  input: { flex: 1, fontSize: 15, color: Colors.text },

  btnPrimary: { borderRadius: 14, overflow: 'hidden', marginTop: 8, marginBottom: 8, ...Colors.shadow.md },
  btnDisabled: { opacity: 0.7 },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

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

  altRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  altLink: { fontSize: 14, color: Colors.primaryDark, fontWeight: '700' },

  successArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  successDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
});
