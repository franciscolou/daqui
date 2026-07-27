import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ScrollView, useWindowDimensions, KeyboardAvoidingView, Platform,
  StyleProp, ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withDelay, withSpring,
  runOnJS, Easing, SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';
import { submitOnEnter } from '../../lib/keyboard';
import { ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/Colors';
import { BRAND_FONT } from '../../constants/BrandFont';
import { AvailabilityState } from '../../lib/useAvailability';
import { useSignupFlow } from '../../lib/useSignupFlow';
import { useLoginFlow } from '../../lib/useLoginFlow';

// ─── Dados estáticos ────────────────────────────────────────────
const FEATURES = [
  { icon: 'people-outline' as const,          label: 'Conecte-se com vizinhos' },
  { icon: 'megaphone-outline' as const,        label: 'Fique por dentro do bairro' },
  { icon: 'shield-checkmark-outline' as const, label: 'Segurança em primeiro lugar' },
];
const AVATARS = ['47', '52', '44', '57', '25'];
const POSTS = [
  { color: '#EF4444', label: 'Aviso', text: 'Obra na esquina com a...' },
  { color: '#F59E0B', label: 'Recomendação',  text: 'Padaria nova na Harmonia 🥐' },
  { color: '#EC4899', label: 'Pets',  text: 'Gatinha encontrada aqui no…' },
];
// Espelha STEPS de app/(auth)/signup.tsx — ambos consomem useSignupFlow, que
// é a única fonte de verdade pro número/ordem dos passos.
const SIGNUP_STEPS = ['Conta', 'Verificar', 'Pronto'];

// ─── Bolha decorativa animada ────────────────────────────────────
// Flutua sozinha (drift suave em X/Y, com fases próprias) e reage ao mouse
// via parallax: `depth` controla o quanto acompanha o cursor (px normalizado
// -1..1), dando sensação de camadas. Só-decorativa, não captura toques.
function FloatingBlob({
  style, px, py, depth, driftX = 16, driftY = 20, durX = 7000, durY = 8000, delay = 0,
}: {
  style: StyleProp<ViewStyle>;
  px: SharedValue<number>;
  py: SharedValue<number>;
  depth: number;
  driftX?: number;
  driftY?: number;
  durX?: number;
  durY?: number;
  delay?: number;
}) {
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);

  useEffect(() => {
    fx.value = withDelay(delay, withRepeat(withTiming(1, { duration: durX, easing: Easing.inOut(Easing.quad) }), -1, true));
    fy.value = withDelay(delay + 400, withRepeat(withTiming(1, { duration: durY, easing: Easing.inOut(Easing.quad) }), -1, true));
    // Anima só na montagem; os parâmetros são estáveis por bolha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      // Parallax invertido: as bolhas se afastam do cursor (sinal negativo).
      { translateX: (fx.value * 2 - 1) * driftX - px.value * depth },
      { translateY: (fy.value * 2 - 1) * driftY - py.value * depth },
    ],
  }));

  return <Animated.View pointerEvents="none" style={[style, animStyle]} />;
}

// ─── Grade de bolinhas "tátil" ────────────────────────────────────
// Cada bolinha cresce conforme o cursor se aproxima, como se a grade fosse
// sensível ao toque. `mx`/`my` guardam a posição do mouse em px, já
// relativa ao canto da própria grade e suavizada por spring (ver captura em
// WelcomeScreen); cada bolinha só lê a distância até seu próprio centro —
// puramente reativo, sem spring extra aqui dentro.
const DOT_COLS = 12;
const DOT_SIZE = 2.5;
const DOT_GAP = 6;
const DOT_STEP = DOT_SIZE + DOT_GAP;
const DOT_INFLUENCE = 42; // raio (px) de influência do cursor
const DOT_MAX_SCALE = 2.6;

function TactileDot({ index, mx, my }: { index: number; mx: SharedValue<number>; my: SharedValue<number> }) {
  const cx = (index % DOT_COLS) * DOT_STEP + DOT_SIZE / 2;
  const cy = Math.floor(index / DOT_COLS) * DOT_STEP + DOT_SIZE / 2;

  const animStyle = useAnimatedStyle(() => {
    const dist = Math.sqrt((mx.value - cx) ** 2 + (my.value - cy) ** 2);
    const t = Math.max(0, 1 - dist / DOT_INFLUENCE);
    return {
      transform: [{ scale: 1 + t * (DOT_MAX_SCALE - 1) }],
      opacity: 0.2 + t * 0.8,
    };
  });

  return <Animated.View style={[styles.dot, animStyle]} />;
}

// Indicador de status de disponibilidade (dentro do input).
function AvailabilityIcon({ state }: { state: AvailabilityState }) {
  if (state.status === 'checking') return <ActivityIndicator size="small" color={Colors.textTertiary} />;
  if (state.status === 'ok') return <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />;
  if (state.status === 'error') return <Ionicons name="close-circle" size={18} color={Colors.error} />;
  return null;
}

// ─── Tipo de view ────────────────────────────────────────────────
type Panel = 'welcome' | 'login' | 'signup';

// ════════════════════════════════════════════════════════════════
export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  // Lógica de login/cadastro (validação, chamadas de API, ticket de 2FA/
  // verificação de e-mail) mora inteira nesses hooks — os mesmos usados por
  // app/(auth)/login.tsx e app/(auth)/signup.tsx. O painel deslizante aqui
  // embaixo só decide COMO mostrar esse estado no layout desktop; nunca
  // duplica a regra de negócio (é assim que as duas telas ficam em sync).
  const signupFlow = useSignupFlow();
  const loginFlow = useLoginFlow();

  // estado do painel esquerdo (só usado no desktop)
  const [panel, setPanel] = useState<Panel>('welcome');
  // Espelha signupFlow.step só pra animação de slide (ver efeito abaixo);
  // quem manda no valor real do passo é o hook.
  const [signupStep, setSignupStep] = useState(0);

  // ── Animação de deslize ──────────────────────────────────────
  // Duas camadas absolutas: exit (sai) + enter (entra)
  // withTiming anima as duas de forma explícita, sem depender de entering/exiting
  const exitX  = useSharedValue(0);
  const enterX = useSharedValue(0);
  const [exitPanel, setExitPanel] = useState<Panel>('welcome');
  const [exitStep,  setExitStep]  = useState(0);
  const [showExit,  setShowExit]  = useState(false);
  const animBusy = useRef(false);

  const exitStyle  = useAnimatedStyle(() => ({ transform: [{ translateX: exitX.value }] }));
  const enterStyle = useAnimatedStyle(() => ({ transform: [{ translateX: enterX.value }] }));

  // ── Parallax do mouse (só na web) ────────────────────────────
  // Posição do cursor normalizada em -1..1 relativa ao centro da janela.
  // As bolhas leem esses valores; o withSpring dá um leve atraso natural.
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);
  // Posição do mouse em px, relativa ao canto da grade de bolinhas (efeito
  // "sensor tátil" — ver TactileDot acima). Começa fora do raio de
  // influência pra nenhuma bolinha nascer "crescida".
  const dotGridRef = useRef<View>(null);
  const dotGridMouseX = useSharedValue(-1000);
  const dotGridMouseY = useSharedValue(-1000);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      pointerX.value = withSpring(nx, { damping: 22, stiffness: 80, mass: 0.6 });
      pointerY.value = withSpring(ny, { damping: 22, stiffness: 80, mass: 0.6 });

      const gridEl = dotGridRef.current as unknown as HTMLElement | null;
      if (gridEl) {
        const rect = gridEl.getBoundingClientRect();
        dotGridMouseX.value = withSpring(e.clientX - rect.left, { damping: 18, stiffness: 200, mass: 0.4 });
        dotGridMouseY.value = withSpring(e.clientY - rect.top, { damping: 18, stiffness: 200, mass: 0.4 });
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishSlide = () => {
    setShowExit(false);
    // A camada que entra fica no centro (já está em 0). NÃO reposicionamos a
    // camada que sai: ela permanece fora da tela até desmontar. Movê-la ao
    // centro aqui faria o conteúdo anterior "piscar" por 1 frame, porque o
    // desmonte (setShowExit) só acontece no próximo render do React.
    enterX.value = 0;
    animBusy.current = false;
  };

  const slide = (nextPanel: Panel, nextStep: number, dir: 'fwd' | 'bwd') => {
    if (animBusy.current) return;
    animBusy.current = true;

    const W = Math.round(width * 0.35); // ligeiramente maior que o painel 30%

    // captura estado atual como "saindo"
    setExitPanel(panel);
    setExitStep(signupStep);
    setShowExit(true);

    // atualiza estado para o novo conteúdo
    setPanel(nextPanel);
    setSignupStep(nextStep);

    exitX.value  = 0;
    enterX.value = dir === 'fwd' ? W : -W;

    exitX.value  = withTiming(dir === 'fwd' ? -W : W, { duration: 280, easing: Easing.inOut(Easing.cubic) });
    enterX.value = withTiming(0,                       { duration: 280, easing: Easing.inOut(Easing.cubic) },
      (finished) => { if (finished) runOnJS(finishSlide)(); else { animBusy.current = false; } });
  };

  const goTo = (next: Panel) => {
    // Garante que reabrir o painel de cadastro sempre comece do passo 0
    // (evita herdar um passo de uma sessão de cadastro anterior no mesmo
    // carregamento da tela, o que disparia o efeito de slide abaixo de
    // forma inesperada).
    if (next === 'signup' && signupFlow.step !== 0) signupFlow.setStep(0);
    slide(next, 0, 'fwd');
  };
  const goBack = () => {
    if (panel === 'signup' && signupFlow.step > 0) signupFlow.goToPreviousStep();
    else slide('welcome', 0, 'bwd');
  };

  // O passo do cadastro é controlado pelo hook (signupFlow.step, única fonte
  // de verdade — a mesma usada por app/(auth)/signup.tsx); este efeito só
  // traduz a mudança de passo na animação de deslize já existente aqui,
  // sem duplicar nenhuma regra de negócio.
  useEffect(() => {
    if (panel === 'signup' && signupFlow.step !== signupStep) {
      slide('signup', signupFlow.step, signupFlow.step > signupStep ? 'fwd' : 'bwd');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signupFlow.step, panel]);

  // ── Painel esquerdo: hero ────────────────────────────────────
  const renderHero = () => (
    <ScrollView
      style={styles.leftScroll}
      contentContainerStyle={styles.leftContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.logoRow}>
        <View style={styles.logoIcon}>
          <Ionicons name="location" size={22} color="#fff" />
        </View>
        <Text style={styles.logoText}>daqui</Text>
      </View>

      <Text style={styles.headline}>O seu bairro{'\n'}na palma da mão</Text>
      <Text style={styles.subline}>
        Entre numa rede de vizinhos que se ajudam, compartilham e cuidam do bairro juntos.
      </Text>

      <View style={styles.featuresArea}>
        {FEATURES.map((f) => (
          <View key={f.icon} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon} size={16} color={Colors.primaryDark} />
            </View>
            <Text style={styles.featureText}>{f.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.ctaArea}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => isWide ? goTo('signup') : router.push('/(auth)/signup')}
          activeOpacity={0.88}
        >
          <Text style={styles.btnPrimaryText}>Começar agora</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => isWide ? goTo('login') : router.push('/(auth)/login')}
          activeOpacity={0.88}
        >
          <Text style={styles.btnSecondaryText}>Já tenho conta</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.terms}>
        Ao continuar, você aceita os{' '}
        <Text style={styles.termsLink} onPress={() => router.push('/legal/terms')}>Termos de Uso</Text>
        {' '}e a{' '}
        <Text style={styles.termsLink} onPress={() => router.push('/legal/privacy')}>Política de Privacidade</Text>
      </Text>
    </ScrollView>
  );

  // ── Painel esquerdo: login ───────────────────────────────────
  const renderLogin = () => (
    <ScrollView
      style={styles.leftScroll}
      contentContainerStyle={[styles.leftContent, styles.formContent]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backBtn} onPress={loginFlow.mode !== 'login' ? loginFlow.cancelSecondStep : goBack}>
        <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>
          {loginFlow.mode === '2fa' ? 'Verificação em duas etapas'
            : loginFlow.mode === 'verify' ? 'Confirme seu e-mail'
            : 'Bem-vindo de volta'}
        </Text>
        <Text style={styles.formSubtitle}>
          {loginFlow.mode === '2fa' ? 'Confirme sua identidade para entrar'
            : loginFlow.mode === 'verify' ? 'Enviamos um código de 6 dígitos para você'
            : 'Entre na sua conta daqui'}
        </Text>
      </View>

      {loginFlow.mode !== 'login' ? (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Código de verificação</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="keypad-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="000000"
                placeholderTextColor={Colors.textTertiary}
                value={loginFlow.code}
                onChangeText={loginFlow.onCodeChange}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                onKeyPress={submitOnEnter(loginFlow.handleVerify)}
                onSubmitEditing={loginFlow.handleVerify}
              />
            </View>
          </View>

          {loginFlow.mode === 'verify' && (
            <TouchableOpacity onPress={loginFlow.handleResend} disabled={loginFlow.resending} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>
                {loginFlow.resending ? 'Reenviando…' : loginFlow.resent ? 'Código reenviado ✓' : 'Reenviar código'}
              </Text>
            </TouchableOpacity>
          )}

          {loginFlow.error && (
            <View style={styles.authErrorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.authErrorText}>{loginFlow.error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btnPrimary, loginFlow.submitting && { opacity: 0.7 }]}
            onPress={loginFlow.handleVerify}
            activeOpacity={0.88}
            disabled={loginFlow.submitting}
          >
            {loginFlow.submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.btnPrimaryText}>Verificar</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </>
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
            value={loginFlow.email}
            onChangeText={loginFlow.setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            onKeyPress={submitOnEnter(loginFlow.handleLogin)}
            onSubmitEditing={loginFlow.handleLogin}
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
            value={loginFlow.password}
            onChangeText={loginFlow.setPassword}
            secureTextEntry={!loginFlow.showPassword}
            onKeyPress={submitOnEnter(loginFlow.handleLogin)}
            onSubmitEditing={loginFlow.handleLogin}
          />
          <TouchableOpacity onPress={() => loginFlow.setShowPassword(!loginFlow.showPassword)} style={styles.eyeBtn}>
            <Ionicons name={loginFlow.showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.forgotBtn} onPress={() => router.push('/(auth)/forgot-password')}>
        <Text style={styles.forgotText}>Esqueceu a senha?</Text>
      </TouchableOpacity>

      {loginFlow.error && (
        <View style={styles.authErrorBox}>
          <Ionicons name="alert-circle" size={16} color={Colors.error} />
          <Text style={styles.authErrorText}>{loginFlow.error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.btnPrimary, loginFlow.submitting && { opacity: 0.7 }]}
        onPress={loginFlow.handleLogin}
        activeOpacity={0.88}
        disabled={loginFlow.submitting}
      >
        {loginFlow.submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.btnPrimaryText}>Entrar</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </>
        )}
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

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Não tem conta? </Text>
        <TouchableOpacity onPress={() => goTo('signup')}>
          <Text style={styles.switchLink}>Cadastre-se grátis</Text>
        </TouchableOpacity>
      </View>
      </>
      )}
    </ScrollView>
  );

  // ── Painel esquerdo: signup ──────────────────────────────────
  const renderSignup = (step = signupStep) => (
    <ScrollView
      style={styles.leftScroll}
      contentContainerStyle={[styles.leftContent, styles.formContent]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.backBtn} onPress={goBack}>
        <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
      </TouchableOpacity>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        {SIGNUP_STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
              {i < step
                ? <Ionicons name="checkmark" size={12} color="#fff" />
                : <Text style={[styles.stepNum, i === step && styles.stepNumActive]}>{i + 1}</Text>
              }
            </View>
            <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{s}</Text>
            {i < SIGNUP_STEPS.length - 1 && (
              <View style={[styles.stepLine, i < step && styles.stepLineActive]} />
            )}
          </View>
        ))}
      </View>

      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>
          {step === 0 ? 'Crie sua conta' : step === 1 ? 'Confirme seu e-mail' : 'Tudo certo!'}
        </Text>
        <Text style={styles.formSubtitle}>
          {step === 0 ? 'Junte-se a milhares de vizinhos'
            : step === 1 ? 'Enviamos um código de 6 dígitos para você'
            : 'Sua conta foi criada com sucesso'}
        </Text>
      </View>

      {step === 0 && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome completo</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Seu nome" placeholderTextColor={Colors.textTertiary} value={signupFlow.name} onChangeText={signupFlow.setName} autoCapitalize="words" onKeyPress={submitOnEnter(signupFlow.createAccount)} onSubmitEditing={signupFlow.createAccount} />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome de usuário</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="at-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="seu.usuario" placeholderTextColor={Colors.textTertiary} value={signupFlow.username} onChangeText={(v) => signupFlow.setUsername(v.toLowerCase().replace(/[^a-z0-9._]/g, ''))} autoCapitalize="none" autoCorrect={false} maxLength={18} onKeyPress={submitOnEnter(signupFlow.createAccount)} onSubmitEditing={signupFlow.createAccount} />
              <AvailabilityIcon state={signupFlow.usernameCheck} />
            </View>
            {signupFlow.usernameCheck.status === 'error' && !!signupFlow.usernameCheck.error && (
              <Text style={styles.fieldError}>{signupFlow.usernameCheck.error}</Text>
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="seu@email.com" placeholderTextColor={Colors.textTertiary} value={signupFlow.email} onChangeText={signupFlow.setEmail} keyboardType="email-address" autoCapitalize="none" onKeyPress={submitOnEnter(signupFlow.createAccount)} onSubmitEditing={signupFlow.createAccount} />
              <AvailabilityIcon state={signupFlow.emailCheck} />
            </View>
            {signupFlow.emailCheck.status === 'error' && !!signupFlow.emailCheck.error && (
              <Text style={styles.fieldError}>{signupFlow.emailCheck.error}</Text>
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Mínimo 8 caracteres" placeholderTextColor={Colors.textTertiary} value={signupFlow.password} onChangeText={signupFlow.setPassword} secureTextEntry onKeyPress={submitOnEnter(signupFlow.createAccount)} onSubmitEditing={signupFlow.createAccount} />
            </View>
          </View>
        </>
      )}

      {step === 1 && (
        <View>
          <View style={styles.twoFaIntro}>
            <Ionicons name="mail-open-outline" size={22} color={Colors.primary} />
            <Text style={styles.twoFaText}>
              Enviamos um código de 6 dígitos para <Text style={{ fontWeight: '700' }}>{signupFlow.email.trim()}</Text>.
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
                value={signupFlow.code}
                onChangeText={signupFlow.onCodeChange}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                onKeyPress={submitOnEnter(signupFlow.handleVerify)}
                onSubmitEditing={signupFlow.handleVerify}
              />
            </View>
          </View>

          <TouchableOpacity onPress={signupFlow.handleResend} disabled={signupFlow.resending} style={styles.switchRow}>
            <Text style={styles.switchLink}>
              {signupFlow.resending ? 'Reenviando…' : signupFlow.resent ? 'Código reenviado ✓' : 'Reenviar código'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View style={styles.successArea}>
          <LinearGradient colors={Colors.gradient.primary} style={styles.successIcon}>
            <Ionicons name="checkmark" size={32} color="#fff" />
          </LinearGradient>
          <Text style={styles.successDesc}>
            Sua conta foi criada. Você já pode ver o que está rolando perto de você em
            "Perto de mim" — quando quiser, configure "Meu bairro" para participar da
            comunidade onde você mora.
          </Text>
        </View>
      )}

      {signupFlow.error && (
        <View style={[styles.authErrorBox, { marginTop: 12 }]}>
          <Ionicons name="alert-circle" size={16} color={Colors.error} />
          <Text style={styles.authErrorText}>{signupFlow.error}</Text>
        </View>
      )}

      {(() => {
        const busy = signupFlow.submitting;
        const label = step === 0 ? 'Continuar' : step === 1 ? 'Verificar' : 'Começar a usar o Daqui';
        const icon = step === 2 ? 'navigate' : 'arrow-forward';
        const onPress = step === 0 ? signupFlow.createAccount
          : step === 1 ? signupFlow.handleVerify
          : () => router.replace('/(tabs)');
        return (
          <TouchableOpacity
            style={[styles.btnPrimary, { marginTop: 16 }, busy && { opacity: 0.7 }]}
            onPress={onPress}
            activeOpacity={0.88}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.btnPrimaryText}>{label}</Text>
                <Ionicons name={icon} size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        );
      })()}

      {step === 0 && (
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Já tem conta? </Text>
          <TouchableOpacity onPress={() => goTo('login')}>
            <Text style={styles.switchLink}>Entrar</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  // ── Painel direito: arte ──────────────────────────────────────
  const renderArt = () => (
    <View style={styles.rightPanel}>
      <LinearGradient
        colors={['#052E16', '#14532D', '#166534', '#15803D']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <FloatingBlob px={pointerX} py={pointerY} depth={16} driftX={16} driftY={22} durX={7600} durY={9000}
        style={[styles.blob, { width: 520, height: 520, top: -140, right: -140, opacity: 0.12 }]} />
      <FloatingBlob px={pointerX} py={pointerY} depth={32} driftX={22} driftY={16} durX={6400} durY={7600} delay={600}
        style={[styles.blob, { width: 320, height: 320, bottom: -80, left: -80,  opacity: 0.10 }]} />
      <FloatingBlob px={pointerX} py={pointerY} depth={48} driftX={14} driftY={24} durX={5200} durY={6200} delay={1200}
        style={[styles.blob, { width: 200, height: 200, top: '40%', left: '20%', opacity: 0.07 }]} />

      <View style={styles.ringOuter}>
        <View style={styles.ringInner}>
          <Ionicons name="location" size={52} color={Colors.primary} />
        </View>
      </View>
      <View style={styles.artCenter}>
        <Text style={styles.artWord}>Vizinhança</Text>
        <Text style={styles.artWord2}>de verdade.</Text>
      </View>
      <View style={styles.avatarCluster}>
        {AVATARS.map((img, i) => (
          <Image key={i} source={{ uri: `https://i.pravatar.cc/80?img=${img}` }}
            style={[styles.clusterAvatar, { marginLeft: i > 0 ? -14 : 0, zIndex: 10 - i }]} />
        ))}
        <View style={styles.clusterBadge}>
          <Text style={styles.clusterBadgeText}>+238 vizinhos</Text>
        </View>
      </View>
      {POSTS.map((p, i) => (
        <View key={i} style={[styles.floatCard,
          i === 0 && { bottom: 200, left: 32 },
          i === 1 && { top: 140,   right: 40 },
          i === 2 && { bottom: 120, right: 28 },
        ]}>
          <View style={[styles.floatCardDot, { backgroundColor: p.color }]} />
          <View>
            <Text style={styles.floatCardLabel}>{p.label}</Text>
            <Text style={styles.floatCardText} numberOfLines={1}>{p.text}</Text>
          </View>
        </View>
      ))}
      <View ref={dotGridRef} pointerEvents="none" style={styles.dotGrid}>
        {Array.from({ length: 48 }).map((_, i) => (
          <TactileDot key={i} index={i} mx={dotGridMouseX} my={dotGridMouseY} />
        ))}
      </View>
    </View>
  );

  // ── Mobile: gradiente completo ────────────────────────────────
  if (!isWide) {
    return (
      <LinearGradient colors={['#0D2918', '#15803D', '#22C55E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mobileRoot}>
        <FloatingBlob px={pointerX} py={pointerY} depth={20} driftX={18} driftY={24} durX={7200} durY={8400}
          style={[styles.blob, { width: 340, height: 340, top: -100, right: -100, opacity: 0.1 }]} />
        <FloatingBlob px={pointerX} py={pointerY} depth={34} driftX={22} driftY={18} durX={6000} durY={7000} delay={700}
          style={[styles.blob, { width: 240, height: 240, bottom: -60, left: -60, opacity: 0.08 }]} />
        <ScrollView contentContainerStyle={styles.mobileContent} showsVerticalScrollIndicator={false}>
          <View style={styles.mobileLogo}>
            <View style={styles.mobileLogoIcon}>
              <Ionicons name="location" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.mobileAppName}>daqui</Text>
            <Text style={styles.mobileTagline}>Seu bairro, do seu jeito</Text>
          </View>
          <View style={styles.mobileAvatarCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              {AVATARS.map((img, i) => (
                <Image key={i} source={{ uri: `https://i.pravatar.cc/80?img=${img}` }}
                  style={[styles.mobileAvatar, { marginLeft: i > 0 ? -14 : 0, zIndex: 5 - i }]} />
              ))}
              <View style={styles.mobileBadge}><Text style={styles.mobileBadgeText}>+238</Text></View>
            </View>
            <Text style={styles.mobileAvatarLabel}>vizinhos perto de você</Text>
          </View>
          <View style={styles.mobileFeaturesArea}>
            {FEATURES.map((f) => (
              <View key={f.icon} style={styles.mobileFeatureRow}>
                <View style={styles.mobileFeatureIcon}><Ionicons name={f.icon} size={16} color={Colors.primary} /></View>
                <Text style={styles.mobileFeatureText}>{f.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.mobileCtaArea}>
            <TouchableOpacity style={styles.mobileBtnPrimary} onPress={() => router.push('/(auth)/signup')} activeOpacity={0.88}>
              <Text style={styles.mobileBtnPrimaryText}>Começar agora</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.primaryDark} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mobileBtnSecondary} onPress={() => router.push('/(auth)/login')} activeOpacity={0.88}>
              <Text style={styles.mobileBtnSecondaryText}>Já tenho conta</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.mobileTerms}>
            Ao continuar, você aceita os{' '}
            <Text style={styles.mobileTermsLink} onPress={() => router.push('/legal/terms')}>Termos de Uso</Text>
            {' '}e a{' '}
            <Text style={styles.mobileTermsLink} onPress={() => router.push('/legal/privacy')}>Política de Privacidade</Text>
          </Text>
        </ScrollView>
      </LinearGradient>
    );
  }

  // ── Desktop: split fixo com animação de deslize ─────────────
  // Duas camadas absolutas: exit (sai) + enter (entra), cada uma com translate próprio
  return (
    <View style={styles.root}>
      <View style={styles.leftPanel}>
        {/* Camada que sai — visível apenas durante a animação */}
        {showExit && (
          <Animated.View style={[StyleSheet.absoluteFill, exitStyle]}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              {exitPanel === 'welcome' && renderHero()}
              {exitPanel === 'login'   && renderLogin()}
              {exitPanel === 'signup'  && renderSignup(exitStep)}
            </KeyboardAvoidingView>
          </Animated.View>
        )}
        {/* Camada que entra — sempre presente */}
        <Animated.View style={[StyleSheet.absoluteFill, enterStyle]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {panel === 'welcome' && renderHero()}
            {panel === 'login'   && renderLogin()}
            {panel === 'signup'  && renderSignup()}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
      {renderArt()}
    </View>
  );
}

// ─── Estilos ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#fff' },

  // Painel esquerdo
  leftPanel: { flex: 3, overflow: 'hidden' },
  leftScroll: { flex: 1 },
  leftContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 52,
    paddingVertical: 60,
  },
  formContent: { justifyContent: 'flex-start', paddingTop: 48 },

  // Hero
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 48 },
  logoIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, fontFamily: BRAND_FONT },
  headline: { fontSize: 42, fontWeight: '800', color: Colors.text, letterSpacing: -1.5, lineHeight: 50, marginBottom: 16 },
  subline: { fontSize: 16, color: Colors.textSecondary, lineHeight: 26, marginBottom: 36 },
  featuresArea: { gap: 12, marginBottom: 40 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 15, color: Colors.text, fontWeight: '500' },

  // CTAs compartilhados
  ctaArea: { gap: 10, marginBottom: 24 },
  btnPrimary: { backgroundColor: Colors.primaryDark, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...Colors.shadow.md },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  authErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.error + '12', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  authErrorText: { flex: 1, fontSize: 13, color: Colors.error, fontWeight: '500' },
  btnSecondary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border },
  btnSecondaryText: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  terms: { textAlign: 'center', color: Colors.textTertiary, fontSize: 12, lineHeight: 18 },
  termsLink: { color: Colors.textSecondary, textDecorationLine: 'underline' },

  // Formulários
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  formHeader: { marginBottom: 28 },
  formTitle: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: -0.5, marginBottom: 4 },
  formSubtitle: { fontSize: 14, color: Colors.textSecondary },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 7 },
  fieldError: { fontSize: 12, color: Colors.error, marginTop: 6, fontWeight: '500' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 13, height: 50 },
  inputIcon: { marginRight: 9 },
  input: { flex: 1, fontSize: 15, color: Colors.text },
  inputFlex: { flex: 1, fontSize: 15, color: Colors.text },
  eyeBtn: { padding: 4 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, color: Colors.primaryDark, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },
  socialRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: Colors.surface, borderRadius: 12, paddingVertical: 13, borderWidth: 1.5, borderColor: Colors.border },
  socialText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  switchText: { fontSize: 14, color: Colors.textSecondary },
  switchLink: { fontSize: 14, color: Colors.primaryDark, fontWeight: '700' },

  // Signup steps
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  stepNum: { fontSize: 11, fontWeight: '700', color: Colors.textTertiary },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: Colors.textTertiary, marginLeft: 5, fontWeight: '500' },
  stepLabelActive: { color: Colors.text },
  stepLine: { width: 20, height: 1.5, backgroundColor: Colors.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.primary },

  // Verificação de e-mail (signup step 1 / login mode "verify")
  twoFaIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.primaryFaint, borderRadius: 12, padding: 14, marginBottom: 20 },
  twoFaText: { flex: 1, fontSize: 13, color: Colors.primaryDark, lineHeight: 18 },

  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Colors.primaryFaint, borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.primaryLight },
  infoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: Colors.primaryFaint, borderRadius: 12, borderWidth: 1, borderColor: Colors.primaryLight, marginBottom: 4 },
  locationBtnText: { fontSize: 14, color: Colors.primaryDark, fontWeight: '600' },

  successArea: { alignItems: 'center', paddingVertical: 16 },
  successIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...Colors.shadow.lg },
  successDesc: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  // Painel direito (arte)
  rightPanel: { flex: 7, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  blob: { position: 'absolute', borderRadius: 9999, backgroundColor: '#fff' },
  ringOuter: { width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  ringInner: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  artCenter: { alignItems: 'center', marginBottom: 36 },
  artWord: { fontSize: 42, fontWeight: '800', color: '#fff', letterSpacing: -1.5, opacity: 0.95 },
  artWord2: { fontSize: 42, fontWeight: '800', color: Colors.primary, letterSpacing: -1.5 },
  avatarCluster: { flexDirection: 'row', alignItems: 'center' },
  clusterAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#14532D' },
  clusterBadge: { marginLeft: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  clusterBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  floatCard: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, maxWidth: 220 },
  floatCardDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  floatCardLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  floatCardText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  dotGrid: { position: 'absolute', top: 24, left: 24, flexDirection: 'row', flexWrap: 'wrap', width: DOT_COLS * DOT_STEP - DOT_GAP, gap: DOT_GAP },
  dot: { width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: '#fff' },

  // Mobile
  mobileRoot: { flex: 1, overflow: 'hidden' },
  mobileContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 60 },
  mobileLogo: { alignItems: 'center', marginBottom: 32 },
  mobileLogoIcon: { width: 68, height: 68, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  mobileAppName: { fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: -2, fontFamily: BRAND_FONT },
  mobileTagline: { fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  mobileAvatarCard: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', marginBottom: 28 },
  mobileAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#fff' },
  mobileBadge: { marginLeft: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  mobileBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  mobileAvatarLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' },
  mobileFeaturesArea: { gap: 12, marginBottom: 32 },
  mobileFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mobileFeatureIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  mobileFeatureText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '500' },
  mobileCtaArea: { gap: 10, marginBottom: 20 },
  mobileBtnPrimary: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...Colors.shadow.md },
  mobileBtnPrimaryText: { color: Colors.primaryDark, fontSize: 16, fontWeight: '700' },
  mobileBtnSecondary: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  mobileBtnSecondaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  mobileTerms: { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18 },
  mobileTermsLink: { color: 'rgba(255,255,255,0.8)', textDecorationLine: 'underline' },
});
