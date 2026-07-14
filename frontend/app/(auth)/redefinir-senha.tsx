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
import { submitOnEnter } from '../../lib/keyboard';

// Aberta a partir do link enviado por e-mail (?token=...), válido por 20min —
// ver `FRONTEND_URL` em backend/app/core/config.py e `forgot_password` em
// backend/app/services/auth.py.
export default function ResetPasswordScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (submitting || !token) return;
    setError(null);
    if (password.length < 6) {
      setError('A nova senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível redefinir a senha.');
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
            <Text style={styles.headerTitle}>Nova senha</Text>
            <Text style={styles.headerSubtitle}>
              {done ? 'Senha redefinida' : 'Escolha uma nova senha para sua conta'}
            </Text>
          </LinearGradient>

          <View style={styles.form}>
            {!token ? (
              <View style={styles.successArea}>
                <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
                <Text style={[styles.successDesc, { marginTop: 16 }]}>
                  Link inválido. Solicite um novo link de redefinição de senha.
                </Text>
                <TouchableOpacity style={styles.altRow} onPress={() => router.replace('/(auth)/esqueci-senha')}>
                  <Text style={styles.altLink}>Solicitar novo link</Text>
                </TouchableOpacity>
              </View>
            ) : done ? (
              <View style={styles.successArea}>
                <View style={styles.successIconWrap}>
                  <LinearGradient colors={Colors.gradient.primary} style={styles.successIcon}>
                    <Ionicons name="checkmark" size={32} color="#fff" />
                  </LinearGradient>
                </View>
                <Text style={styles.successDesc}>
                  Sua senha foi redefinida. Todas as sessões anteriores foram encerradas por
                  segurança — entre novamente com a nova senha.
                </Text>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => router.replace('/(auth)/login')}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={Colors.gradient.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.btnGradient}
                  >
                    <Text style={styles.btnText}>Ir para o login</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nova senha</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputFlex}
                      placeholder="Mínimo 6 caracteres"
                      placeholderTextColor={Colors.textTertiary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoFocus
                      onKeyPress={submitOnEnter(handleSubmit)}
                      onSubmitEditing={handleSubmit}
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

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirmar nova senha</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputFlex}
                      placeholder="Repita a senha"
                      placeholderTextColor={Colors.textTertiary}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
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
                        <Text style={styles.btnText}>Redefinir senha</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
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
  inputFlex: { flex: 1, fontSize: 15, color: Colors.text },
  eyeBtn: { padding: 4, borderRadius: 8 },

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
