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

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (submitting) return;
    setError(null);
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao entrar.');
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
          {/* Header gradiente */}
          <LinearGradient
            colors={['#0D2918', '#15803D']}
            style={[styles.header, isWide && styles.headerWide]}
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                <Ionicons name="location" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.logoText}>daqui</Text>
            </View>

            <Text style={styles.headerTitle}>Bem-vindo de volta</Text>
            <Text style={styles.headerSubtitle}>Entre na sua conta</Text>
          </LinearGradient>

          {/* Formulário */}
          <View style={styles.form}>
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

            <TouchableOpacity style={styles.forgotBtn}>
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
  eyeBtn: { padding: 4 },
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
});
