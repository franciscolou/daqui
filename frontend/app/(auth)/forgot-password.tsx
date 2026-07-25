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
import { api, ApiError } from '../../lib/api';
import { submitOnEnter } from '../../lib/keyboard';
import { goBack } from '../../lib/navigation';

export default function ForgotPasswordScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);
    if (!email.trim()) {
      setError('Informe seu e-mail.');
      return;
    }
    setSubmitting(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível enviar o e-mail.');
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
            <TouchableOpacity style={styles.backBtn} onPress={() => goBack('/(auth)/login')}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Esqueceu a senha?</Text>
            <Text style={styles.headerSubtitle}>
              {sent ? 'Confira seu e-mail' : 'Enviamos um link pra você redefinir'}
            </Text>
          </LinearGradient>

          <View style={styles.form}>
            {sent ? (
              <View style={styles.successArea}>
                <View style={styles.successIconWrap}>
                  <LinearGradient colors={Colors.gradient.primary} style={styles.successIcon}>
                    <Ionicons name="mail-open-outline" size={32} color="#fff" />
                  </LinearGradient>
                </View>
                <Text style={styles.successDesc}>
                  Se <Text style={{ fontWeight: '700' }}>{email.trim()}</Text> estiver cadastrado,
                  enviamos um link de redefinição de senha. Ele vale por 20 minutos.
                </Text>
                <TouchableOpacity style={styles.altRow} onPress={() => router.replace('/(auth)/login')}>
                  <Text style={styles.altLink}>Voltar ao login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.intro}>
                  Digite o e-mail da sua conta — vamos enviar um link para você escolher uma nova senha.
                </Text>
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
                      autoFocus
                      onKeyPress={submitOnEnter(handleSubmit)}
                      onSubmitEditing={handleSubmit}
                    />
                  </View>
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
                        <Text style={styles.btnText}>Enviar link</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.altRow}>
                  <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                    <Text style={styles.altLink}>Voltar ao login</Text>
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
  page: { flex: 1, backgroundColor: '#F0FDF4' },
  scrollOuter: { flex: 1 },
  scroll: { flexGrow: 1 },
  scrollWide: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },

  card: { backgroundColor: Colors.surface, overflow: 'hidden' },
  cardWide: { width: '100%', maxWidth: 460, borderRadius: 24, ...Colors.shadow.lg },

  header: { paddingTop: 56, paddingBottom: 32, paddingHorizontal: 28 },
  headerWide: { paddingTop: 36, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  form: { padding: 28 },
  intro: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 7 },
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

  btnPrimary: { borderRadius: 14, overflow: 'hidden', marginBottom: 20, ...Colors.shadow.md },
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

  altRow: { flexDirection: 'row', justifyContent: 'center' },
  altLink: { fontSize: 14, color: Colors.primaryDark, fontWeight: '700' },

  successArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  successIconWrap: { marginBottom: 20 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Colors.shadow.lg,
  },
  successDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
});
