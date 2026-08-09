import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Pressable,
  Image, ScrollView, useWindowDimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  runOnJS, Easing, FadeIn, FadeInDown, interpolate, interpolateColor, Extrapolation,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import DaquiMark from '../../components/DaquiMark';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import NeighborhoodScape, { SCAPE_ANCHORS, AmbientBackdrop } from '../../components/NeighborhoodScape';
import { useState, useRef, useEffect } from 'react';
import { submitOnEnter } from '../../lib/keyboard';
import { ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/Colors';
import { BRAND_FONT } from '../../constants/BrandFont';
import { DESKTOP_BREAKPOINT, ESTABLISHED_COMMUNITY_THRESHOLD } from '../../constants/config';
import { useT } from '../../lib/i18n';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { AvailabilityState } from '../../lib/useAvailability';
import { useAuth } from '../../lib/auth';
import { useSignupFlow } from '../../lib/useSignupFlow';
import { useLoginFlow } from '../../lib/useLoginFlow';
import { api, CommunityStats } from '../../lib/api';

type IconName = ComponentProps<typeof Ionicons>['name'];

// ─── Dados estáticos ────────────────────────────────────────────
const FEATURES: { icon: IconName; labelKey: string }[] = [
  { icon: 'people-outline',      labelKey: 'auth.features.connect' },
  { icon: 'megaphone-outline',   labelKey: 'auth.features.stayUpdated' },
  { icon: 'trending-up-outline', labelKey: 'auth.features.grow' },
];
// Abaixo desse total de contas (ESTABLISHED_COMMUNITY_THRESHOLD, ver
// constants/config.ts), expor o número exato faria a rede parecer vazia —
// troca por uma mensagem de "comunidade em formação" (ver
// CommunityStats/useEffect abaixo). Sem fallback estático: enquanto os dados
// reais não chegam, a vitrine simplesmente não aparece.
// Cada card "acontece" perto de um nó ativo do mapa (ver NeighborhoodScape) —
// por isso a cor casa com os nós luminosos e o conector tracejado da arte.
const ACTIVITY_CARDS: { color: string; labelKey: string; textKey: string; icon: IconName; anchor: 'cardA' | 'cardB' | 'cardC' }[] = [
  { color: '#F59E0B', labelKey: 'auth.activity.recommendation', textKey: 'auth.activity.recommendationText', icon: 'cafe-outline', anchor: 'cardA' },
  { color: '#EF4444', labelKey: 'auth.activity.notice', textKey: 'auth.activity.noticeText', icon: 'construct-outline', anchor: 'cardB' },
  { color: '#EC4899', labelKey: 'auth.activity.pets', textKey: 'auth.activity.petsText', icon: 'paw-outline', anchor: 'cardC' },
];

// Indicador de status de disponibilidade (dentro do input).
function AvailabilityIcon({ state }: { state: AvailabilityState }) {
  if (state.status === 'checking') return <ActivityIndicator size="small" color={FORM_ICON} />;
  if (state.status === 'ok') return <Ionicons name="checkmark-circle" size={18} color={FORM_ACCENT} />;
  if (state.status === 'error') return <Ionicons name="close-circle" size={18} color={Colors.error} />;
  return null;
}

// Paleta dos formulários de login/cadastro DENTRO do glassBox — o painel
// expandido permanece em vidro escuro (não vira mais painel branco, ver
// glassTintStyle), então esses textos/inputs usam a mesma família clara do
// hero em vez das cores claras-sobre-branco padrão do resto do app.
const FORM_TEXT = '#ffffff';
const FORM_TEXT_SECONDARY = 'rgba(255,255,255,0.78)';
const FORM_TEXT_TERTIARY = 'rgba(255,255,255,0.52)';
const FORM_ICON = 'rgba(255,255,255,0.55)';
const FORM_PLACEHOLDER = 'rgba(255,255,255,0.42)';
const FORM_ACCENT = '#4ADE80';
const FORM_ERROR_TEXT = '#FCA5A5';

// ─── Botão de ação principal (Começar agora / Já tenho conta) ───────────
// Hover/foco/pressionado próprios via Pressable (mesmo padrão de
// components/RightSidebar.tsx), isolado do styles.btnPrimary/btnSecondary
// usado pelos formulários de login/cadastro — não altera nada ali.
const CTA_STYLES = {
  heroPrimary: { base: 'ctaHeroPrimary', hover: 'ctaHeroPrimaryHover', pressed: 'ctaHeroPrimaryPressed', focus: 'ctaHeroPrimaryFocus', text: 'ctaHeroPrimaryText', iconColor: '#fff' },
  heroSecondary: { base: 'ctaHeroSecondary', hover: 'ctaHeroSecondaryHover', pressed: 'ctaHeroSecondaryPressed', focus: 'ctaHeroSecondaryFocus', text: 'ctaHeroSecondaryText', iconColor: Colors.text },
  mobilePrimary: { base: 'ctaMobilePrimary', hover: 'ctaMobilePrimaryHover', pressed: 'ctaMobilePrimaryPressed', focus: 'ctaMobilePrimaryFocus', text: 'ctaMobilePrimaryText', iconColor: Colors.primaryDark },
  mobileSecondary: { base: 'ctaMobileSecondary', hover: 'ctaMobileSecondaryHover', pressed: 'ctaMobileSecondaryPressed', focus: 'ctaMobileSecondaryFocus', text: 'ctaMobileSecondaryText', iconColor: '#fff' },
} as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function CtaButton({
  kind, label, icon, onPress, showIcon = true, extraStyle, labelStyle, hoverStyle,
}: {
  kind: keyof typeof CTA_STYLES;
  label: string;
  icon: IconName;
  onPress: () => void;
  showIcon?: boolean;
  // Estilo animado extra (cor/borda) só usado pelo "Já tenho conta" do hero,
  // que precisa ler bem tanto no cartão de vidro escuro quanto no painel
  // claro expandido — ver colorização animada em WelcomeScreen. Fica ANTES
  // dos overrides de hover/pressed/foco no array de estilos (não depois),
  // pra esses continuarem aparecendo por cima normalmente.
  extraStyle?: object;
  labelStyle?: object;
  // Sobrescreve styles[tokens.hover] quando informado — o hover estático
  // (cinza claro) não lê bem em cima do vidro escuro; o "Já tenho conta"
  // do hero passa uma versão animada que também crossfada com boxExpand.
  hoverStyle?: object;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const tokens = CTA_STYLES[kind];

  return (
    // AnimatedPressable (Reanimated) não entende a prop `style` como FUNÇÃO
    // — o recurso `style={({pressed}) => ...}` é implementado pelo próprio
    // Pressable puro; embrulhado, ele quebra silenciosamente (fundo/layout
    // do botão sumia). Por isso "pressed" vira estado próprio via
    // onPressIn/onPressOut, e `style` fica sempre um array simples.
    <AnimatedPressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      style={[
        styles[tokens.base],
        extraStyle,
        hovered && (hoverStyle ?? styles[tokens.hover]),
        pressed && styles[tokens.pressed],
        focused && styles[tokens.focus],
      ]}
    >
      <Animated.Text style={[styles[tokens.text], labelStyle]}>{label}</Animated.Text>
      {showIcon && <Ionicons name={icon} size={18} color={tokens.iconColor} />}
    </AnimatedPressable>
  );
}

// ─── Tipo de view ────────────────────────────────────────────────
type Panel = 'welcome' | 'login' | 'signup';

// ════════════════════════════════════════════════════════════════
export default function WelcomeScreen() {
  const { t, i18n } = useT();
  // Intl usa tag de locale completa (BCP 47); i18next guarda só 'pt'/'en' —
  // mapeamos pro país de referência de cada um (mesmo padrão do resto do app).
  const numberLocale = i18n.language === 'en' ? 'en-US' : 'pt-BR';
  const SIGNUP_STEPS = [t('auth.signup.steps.account'), t('auth.signup.steps.verify'), t('auth.signup.steps.done')];
  const { width, height } = useWindowDimensions();
  const isWide = width >= DESKTOP_BREAKPOINT;
  // Notebooks costumam ter 720–800px de altura útil depois das barras do
  // navegador/SO. Nessa faixa o hero desktop precisa ficar mais compacto
  // para o cartão continuar inteiro, sem alterar a composição espaçosa de
  // monitores altos.
  const isCompactDesktop = isWide && height < 840;
  const reducedMotion = useReducedMotion();
  // Largura real do painel esquerdo (medida, não estimada) — usada só pra
  // calcular o quanto o slide() precisa deslocar pra sair de tela por
  // completo. Fica em 0 até o primeiro layout; o fallback em slide() cobre
  // esse instante inicial.
  const [leftPanelWidth, setLeftPanelWidth] = useState(0);

  // Lógica de login/cadastro (validação, chamadas de API, ticket de 2FA/
  // verificação de e-mail) mora inteira nesses hooks — os mesmos usados por
  // app/(auth)/login.tsx e app/(auth)/signup.tsx. O painel deslizante aqui
  // embaixo só decide COMO mostrar esse estado no layout desktop; nunca
  // duplica a regra de negócio (é assim que as duas telas ficam em sync).
  const signupFlow = useSignupFlow();
  const loginFlow = useLoginFlow();
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

  // Vitrine "vizinhos" da arte (ver renderArt/mobile abaixo) — total de
  // contas + fotos reais, sem login (endpoint público). `null` enquanto não
  // chega: a seção só aparece com dado de verdade, nunca com placeholder.
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  useEffect(() => {
    api.getCommunityStats().then(setCommunityStats).catch(() => {});
  }, []);

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

  // ── Parallax do mouse + cauda do marcador (só na web) ────────────────
  // Posição do cursor normalizada em -1..1 relativa ao centro da janela —
  // só a camada de arte do bairro (NeighborhoodScape) lê isso, pra dar
  // sensação de profundidade sem mexer no texto/cards por cima.
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);
  // Direção (vetor 2D, não ângulo) que a cauda do marcador central deve
  // apontar — animar x/y separadamente evita de vez a classe de bug de
  // "ângulo dando volta": um escalar de ângulo acumulado precisa de lógica
  // de menor-caminho pra cruzar a fronteira -180/180 sem girar pelo lado
  // errado (uma tentativa anterior com essa lógica ainda quebrava e deixava
  // a seta tremendo/invertida). Um vetor não tem fronteira nenhuma — dois
  // valores interpolando linearmente sempre convergem pro alvo certo, sem
  // acúmulo, sem "%", sem caso especial. O ângulo final só é calculado (via
  // atan2) na hora de desenhar, dentro do próprio worklet (ver LocationCore).
  // Calculado no MESMO espaço percentual 0–100 do SVG (não em pixels de
  // tela), pra que a direção saia correta mesmo com o
  // preserveAspectRatio="none" esticando os eixos de forma desigual.
  const tailDirX = useSharedValue(0);
  const tailDirY = useSharedValue(1); // padrão = "apontando pra baixo", igual à cauda sem rotação
  const rightPanelRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || reducedMotion) return;
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      pointerX.value = withSpring(nx, { damping: 22, stiffness: 80, mass: 0.6 });
      pointerY.value = withSpring(ny, { damping: 22, stiffness: 80, mass: 0.6 });

      const panelEl = rightPanelRef.current as unknown as HTMLElement | null;
      const rect = panelEl?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        const px = ((e.clientX - rect.left) / rect.width) * 100;
        const py = ((e.clientY - rect.top) / rect.height) * 100;
        const dx = px - SCAPE_ANCHORS.marker.x;
        const dy = py - SCAPE_ANCHORS.marker.y;
        const mag = Math.sqrt(dx * dx + dy * dy) || 1;
        tailDirX.value = withSpring(dx / mag, { damping: 20, stiffness: 150, mass: 0.4 });
        tailDirY.value = withSpring(dy / mag, { damping: 20, stiffness: 150, mass: 0.4 });
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const artParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -pointerX.value * 10 },
      { translateY: -pointerY.value * 8 },
    ],
  }));

  // ── Painel de vidro: cartão flutuante (welcome) ⇄ painel cheio (login/
  // cadastro) ──────────────────────────────────────────────────────────
  // 0 = cartão flutuante com cantos arredondados e material translúcido;
  // 1 = painel cheio rente às bordas do slot, igual ao visual anterior.
  // Roda em paralelo ao slide() horizontal existente (não o substitui —
  // são duas animações independentes na mesma transição: o CONTAINER muda
  // de forma enquanto o CONTEÚDO desliza dentro dele).
  const boxExpand = useSharedValue(0);
  useEffect(() => {
    boxExpand.value = withTiming(panel === 'welcome' ? 0 : 1, {
      duration: reducedMotion ? 0 : 560,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [panel, reducedMotion, boxExpand]);

  const glassBoxStyle = useAnimatedStyle(() => {
    const inset = interpolate(boxExpand.value, [0, 1], [isCompactDesktop ? 32 : 44, 0], Extrapolation.CLAMP);
    const radius = interpolate(boxExpand.value, [0, 1], [isCompactDesktop ? 24 : 28, 0], Extrapolation.CLAMP);
    const shadowOpacity = interpolate(boxExpand.value, [0, 1], [0.22, 0], Extrapolation.CLAMP);
    const shadowOffset = interpolate(boxExpand.value, [0, 1], [20, 0], Extrapolation.CLAMP);
    const shadowBlur = interpolate(boxExpand.value, [0, 1], [48, 0], Extrapolation.CLAMP);
    return {
      top: inset, left: inset, right: inset, bottom: inset,
      borderRadius: radius,
      // `boxShadow` em vez das props shadow*/elevation (deprecadas no RN
      // Web) — mesmo padrão já usado nos CTAs deste arquivo, só que
      // recalculado a cada frame aqui pra poder animar.
      boxShadow: `0px ${shadowOffset}px ${shadowBlur}px rgba(3,18,11,${shadowOpacity})`,
    } as any;
  });
  // Vidro escuro (igual aos chips "Padaria nova..."/"Gatinha encontrada
  // aqui" do mapa) tanto no cartão flutuante quanto no painel cheio — só a
  // opacidade sobe um pouco no painel cheio (mais área de vidro, menos "ar"
  // do bairro ao redor pedindo mais opacidade pra legibilidade dos
  // formulários), a família de cor (vidro escuro) permanece a mesma; antes
  // essa transição virava branco/off-white, que destoava do resto da tela.
  const glassTintStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      boxExpand.value, [0, 1], ['rgba(8,26,17,0.34)', 'rgba(6,20,13,0.62)'],
    ),
  }));
  const glassBorderStyle = useAnimatedStyle(() => ({
    // Precisa do mesmo raio animado do glassBox: o overflow:hidden do pai
    // corta este filho na forma arredondada de qualquer jeito, mas sem o
    // raio aqui o traço da borda fica com cantos quadrados por baixo do
    // corte, em vez de acompanhar a curva.
    borderRadius: interpolate(boxExpand.value, [0, 1], [isCompactDesktop ? 24 : 28, 0], Extrapolation.CLAMP),
    borderColor: interpolateColor(boxExpand.value, [0, 1], ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']),
  }));
  const edgeVeilAnimStyle = useAnimatedStyle(() => ({ opacity: boxExpand.value }));

  // ── Cores do conteúdo do hero: claras sobre o vidro escuro ────────────
  // O glassBox permanece em vidro escuro tanto no cartão flutuante quanto
  // no painel cheio (ver glassTintStyle) — então o conteúdo do hero não
  // precisa mais crossfadar pra cores escuras-sobre-claro; fica fixo na
  // paleta clara em ambos os estados. Continuam como useAnimatedStyle (em
  // vez de objeto plano) só pra manter a mesma assinatura usada pelos
  // Animated.Text/View que os consomem.
  const heroLogoTextStyle = useAnimatedStyle(() => ({ color: FORM_TEXT }));
  const heroHeadlineStyle = useAnimatedStyle(() => ({ color: 'rgba(255,255,255,0.97)' }));
  const heroSublineStyle = useAnimatedStyle(() => ({ color: 'rgba(255,255,255,0.8)' }));
  const heroFeatureTextStyle = useAnimatedStyle(() => ({ color: 'rgba(255,255,255,0.94)' }));
  const heroFeatureIconBgStyle = useAnimatedStyle(() => ({ backgroundColor: 'rgba(255,255,255,0.14)' }));
  // Ionicons não aceita ser embrulhado em Animated.createAnimatedComponent
  // (o ref interno dele não expõe setNativeProps do jeito que o Reanimated
  // espera — quebra o app inteiro em runtime). Por isso o ícone claro fica
  // sempre visível e o ícone escuro (usado antes só no painel branco) some
  // de vez — mantidos como duas camadas pra não mexer no JSX que empilha
  // os dois.
  const heroFeatureIconLightStyle = useAnimatedStyle(() => ({ opacity: 1 }));
  const heroFeatureIconDarkStyle = useAnimatedStyle(() => ({ opacity: 0 }));
  const heroSecondaryBtnStyle = useAnimatedStyle(() => ({
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.3)',
  }));
  const heroSecondaryBtnTextStyle = useAnimatedStyle(() => ({ color: FORM_TEXT }));
  const heroSecondaryHoverStyle = useAnimatedStyle(() => ({
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.45)',
  }));
  const heroTermsStyle = useAnimatedStyle(() => ({ color: 'rgba(255,255,255,0.55)' }));
  const heroTermsLinkStyle = useAnimatedStyle(() => ({ color: 'rgba(255,255,255,0.88)' }));

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

    // Ligeiramente maior que o painel esquerdo medido, pra garantir que a
    // camada que sai fique totalmente fora da tela antes de desmontar.
    const W = Math.round((leftPanelWidth || width * 0.4) + 60);

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
      contentContainerStyle={[styles.leftContent, isCompactDesktop && styles.leftContentCompact]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.logoRow, isCompactDesktop && styles.logoRowCompact]}>
        <View style={[styles.logoIcon, isCompactDesktop && styles.logoIconCompact]}>
          <DaquiMark size={isCompactDesktop ? 42 : 52} color="#fff" />
        </View>
        <Animated.Text style={[styles.logoText, isCompactDesktop && styles.logoTextCompact, heroLogoTextStyle]}>daqui</Animated.Text>
      </View>

      <Animated.Text style={[styles.headline, isCompactDesktop && styles.headlineCompact, heroHeadlineStyle]}>{t('auth.headline')}</Animated.Text>
      <Animated.Text style={[styles.subline, isCompactDesktop && styles.sublineCompact, heroSublineStyle]}>
        {t('auth.subline')}
      </Animated.Text>

      <View style={[styles.featuresList, isCompactDesktop && styles.featuresListCompact]}>
        {FEATURES.map((f) => (
          <View key={f.icon} style={[styles.featureRow, isCompactDesktop && styles.featureRowCompact]}>
            <Animated.View style={[styles.featureIcon, isCompactDesktop && styles.featureIconCompact, heroFeatureIconBgStyle]}>
              <Animated.View style={[styles.featureIconGlyph, heroFeatureIconLightStyle]}>
                <Ionicons name={f.icon} size={18} color="#fff" />
              </Animated.View>
              <Animated.View style={[styles.featureIconGlyph, heroFeatureIconDarkStyle]}>
                <Ionicons name={f.icon} size={18} color={Colors.primaryDark} />
              </Animated.View>
            </Animated.View>
            <Animated.Text style={[styles.featureText, isCompactDesktop && styles.featureTextCompact, heroFeatureTextStyle]}>{t(f.labelKey)}</Animated.Text>
          </View>
        ))}
      </View>

      <View style={[styles.ctaArea, isCompactDesktop && styles.ctaAreaCompact]}>
        <CtaButton kind="heroPrimary" label={t('auth.getStarted')} icon="arrow-forward" extraStyle={isCompactDesktop ? styles.ctaHeroCompact : undefined} onPress={() => isWide ? goTo('signup') : router.push('/(auth)/signup')} />
        <CtaButton
          kind="heroSecondary" label={t('auth.haveAccount')} icon="arrow-forward" showIcon={false}
          onPress={() => isWide ? goTo('login') : router.push('/(auth)/login')}
          extraStyle={[heroSecondaryBtnStyle, isCompactDesktop && styles.ctaHeroCompact]} labelStyle={heroSecondaryBtnTextStyle} hoverStyle={heroSecondaryHoverStyle}
        />
      </View>

      <Animated.Text style={[styles.terms, heroTermsStyle]}>
        {t('auth.termsPrefix')}
        <Animated.Text style={[styles.termsLink, heroTermsLinkStyle]} onPress={() => router.push('/legal/terms')}>{t('auth.termsOfUse')}</Animated.Text>
        {t('auth.and')}
        <Animated.Text style={[styles.termsLink, heroTermsLinkStyle]} onPress={() => router.push('/legal/privacy')}>{t('auth.privacyPolicy')}</Animated.Text>
      </Animated.Text>
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
        <Ionicons name="chevron-back" size={18} color={FORM_TEXT} />
      </TouchableOpacity>

      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>
          {loginFlow.mode === '2fa' ? t('auth.login.twoFaTitle')
            : loginFlow.mode === 'verify' ? t('auth.login.verifyTitle')
            : t('auth.login.title')}
        </Text>
        <Text style={styles.formSubtitle}>
          {loginFlow.mode === '2fa' ? t('auth.login.twoFaSubtitleAlt')
            : loginFlow.mode === 'verify' ? t('auth.login.verifySubtitle')
            : t('auth.login.subtitleDaqui')}
        </Text>
      </View>

      {loginFlow.mode !== 'login' ? (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.login.verificationCode')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="keypad-outline" size={18} color={FORM_ICON} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="000000"
                placeholderTextColor={FORM_PLACEHOLDER}
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
                {loginFlow.resending ? t('auth.login.resending') : loginFlow.resent ? t('auth.login.resent') : t('auth.login.resendCode')}
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
                <Text style={styles.btnPrimaryText}>{t('auth.login.verify')}</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </>
      ) : (
      <>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>{t('auth.login.email')}</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="mail-outline" size={18} color={FORM_ICON} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={FORM_PLACEHOLDER}
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
        <Text style={styles.label}>{t('auth.login.password')}</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed-outline" size={18} color={FORM_ICON} style={styles.inputIcon} />
          <TextInput
            style={styles.inputFlex}
            placeholder={t('auth.login.passwordPlaceholder')}
            placeholderTextColor={FORM_PLACEHOLDER}
            value={loginFlow.password}
            onChangeText={loginFlow.setPassword}
            secureTextEntry={!loginFlow.showPassword}
            onKeyPress={submitOnEnter(loginFlow.handleLogin)}
            onSubmitEditing={loginFlow.handleLogin}
          />
          <TouchableOpacity onPress={() => loginFlow.setShowPassword(!loginFlow.showPassword)} style={styles.eyeBtn}>
            <Ionicons name={loginFlow.showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={FORM_ICON} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.forgotBtn} onPress={() => router.push('/(auth)/forgot-password')}>
        <Text style={styles.forgotText}>{t('auth.login.forgotPassword')}</Text>
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
            <Text style={styles.btnPrimaryText}>{t('auth.login.signIn')}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </>
        )}
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('auth.login.orContinueWith')}</Text>
        <View style={styles.dividerLine} />
      </View>

      {googleError && (
        <View style={styles.authErrorBox}>
          <Ionicons name="alert-circle" size={16} color={Colors.error} />
          <Text style={styles.authErrorText}>{googleError}</Text>
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

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>{t('auth.login.noAccount')}</Text>
        <TouchableOpacity style={styles.switchLinkBtn} onPress={() => goTo('signup')}>
          <Text style={styles.switchLink}>{t('auth.login.signUpLink')}</Text>
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
      contentContainerStyle={[styles.leftContent, styles.formContent, isCompactDesktop && styles.signupContentCompact]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={[styles.backBtn, isCompactDesktop && styles.backBtnCompact]} onPress={goBack}>
        <Ionicons name="chevron-back" size={18} color={FORM_TEXT} />
      </TouchableOpacity>

      {/* Step indicator */}
      <View style={[styles.stepRow, isCompactDesktop && styles.stepRowCompact]}>
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

      <View style={[styles.formHeader, isCompactDesktop && styles.formHeaderCompact]}>
        <Text style={[styles.formTitle, isCompactDesktop && styles.formTitleCompact]}>
          {step === 0 ? t('auth.signup.title') : step === 1 ? t('auth.signup.verifyTitle') : t('auth.signup.doneTitle')}
        </Text>
        <Text style={styles.formSubtitle}>
          {step === 0 ? t('auth.signup.subtitle')
            : step === 1 ? t('auth.signup.verifySubtitle')
            : t('auth.signup.doneSubtitle')}
        </Text>
      </View>

      {step === 0 && (
        <>
          <View style={[styles.inputGroup, isCompactDesktop && styles.inputGroupCompact]}>
            <Text style={[styles.label, isCompactDesktop && styles.labelCompact]}>{t('auth.signup.fullName')}</Text>
            <View style={[styles.inputWrapper, isCompactDesktop && styles.inputWrapperCompact]}>
              <Ionicons name="person-outline" size={18} color={FORM_ICON} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder={t('auth.signup.fullNamePlaceholder')} placeholderTextColor={FORM_PLACEHOLDER} value={signupFlow.name} onChangeText={signupFlow.setName} autoCapitalize="words" onKeyPress={submitOnEnter(signupFlow.createAccount)} onSubmitEditing={signupFlow.createAccount} />
            </View>
          </View>
          <View style={[styles.inputGroup, isCompactDesktop && styles.inputGroupCompact]}>
            <Text style={[styles.label, isCompactDesktop && styles.labelCompact]}>{t('auth.signup.username')}</Text>
            <View style={[styles.inputWrapper, isCompactDesktop && styles.inputWrapperCompact]}>
              <Ionicons name="at-outline" size={18} color={FORM_ICON} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder={t('auth.signup.usernamePlaceholder')} placeholderTextColor={FORM_PLACEHOLDER} value={signupFlow.username} onChangeText={(v) => signupFlow.setUsername(v.toLowerCase().replace(/[^a-z0-9._]/g, ''))} autoCapitalize="none" autoCorrect={false} maxLength={18} onKeyPress={submitOnEnter(signupFlow.createAccount)} onSubmitEditing={signupFlow.createAccount} />
              <AvailabilityIcon state={signupFlow.usernameCheck} />
            </View>
            {signupFlow.usernameCheck.status === 'error' && !!signupFlow.usernameCheck.error && (
              <Text style={styles.fieldError}>{signupFlow.usernameCheck.error}</Text>
            )}
          </View>
          <View style={[styles.inputGroup, isCompactDesktop && styles.inputGroupCompact]}>
            <Text style={[styles.label, isCompactDesktop && styles.labelCompact]}>{t('auth.signup.email')}</Text>
            <View style={[styles.inputWrapper, isCompactDesktop && styles.inputWrapperCompact]}>
              <Ionicons name="mail-outline" size={18} color={FORM_ICON} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder={t('auth.emailPlaceholder')} placeholderTextColor={FORM_PLACEHOLDER} value={signupFlow.email} onChangeText={signupFlow.setEmail} keyboardType="email-address" autoCapitalize="none" onKeyPress={submitOnEnter(signupFlow.createAccount)} onSubmitEditing={signupFlow.createAccount} />
              <AvailabilityIcon state={signupFlow.emailCheck} />
            </View>
            {signupFlow.emailCheck.status === 'error' && !!signupFlow.emailCheck.error && (
              <Text style={styles.fieldError}>{signupFlow.emailCheck.error}</Text>
            )}
          </View>
          <View style={[styles.inputGroup, isCompactDesktop && styles.inputGroupCompact]}>
            <Text style={[styles.label, isCompactDesktop && styles.labelCompact]}>{t('auth.signup.password')}</Text>
            <View style={[styles.inputWrapper, isCompactDesktop && styles.inputWrapperCompact]}>
              <Ionicons name="lock-closed-outline" size={18} color={FORM_ICON} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder={t('auth.signup.passwordPlaceholder')} placeholderTextColor={FORM_PLACEHOLDER} value={signupFlow.password} onChangeText={signupFlow.setPassword} secureTextEntry onKeyPress={submitOnEnter(signupFlow.createAccount)} onSubmitEditing={signupFlow.createAccount} />
            </View>
          </View>
        </>
      )}

      {step === 1 && (
        <View>
          <View style={styles.twoFaIntro}>
            <Ionicons name="mail-open-outline" size={22} color={Colors.primary} />
            <Text style={styles.twoFaText}>
              {t('auth.signup.sentCodeTo')} <Text style={{ fontWeight: '700' }}>{signupFlow.email.trim()}</Text>.
              {' '}{t('auth.signup.codeValidFor')}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('auth.signup.verificationCode')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="keypad-outline" size={18} color={FORM_ICON} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="000000"
                placeholderTextColor={FORM_PLACEHOLDER}
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
              {signupFlow.resending ? t('auth.login.resending') : signupFlow.resent ? t('auth.login.resent') : t('auth.login.resendCode')}
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
            {t('auth.signup.welcomeDesc')}
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
        const label = step === 0 ? t('auth.signup.continueLabel') : step === 1 ? t('auth.signup.verify') : t('auth.signup.startUsing');
        const icon = step === 2 ? 'navigate' : 'arrow-forward';
        const onPress = step === 0 ? signupFlow.createAccount
          : step === 1 ? signupFlow.handleVerify
          : () => router.replace('/(tabs)');
        return (
          <TouchableOpacity
            style={[styles.btnPrimary, isCompactDesktop && styles.btnPrimaryCompact, { marginTop: isCompactDesktop ? 12 : 16 }, busy && { opacity: 0.7 }]}
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
        <View style={[styles.switchRow, isCompactDesktop && styles.switchRowCompact]}>
          <Text style={styles.switchText}>{t('auth.signup.haveAccount')}</Text>
          <TouchableOpacity style={styles.switchLinkBtn} onPress={() => goTo('login')}>
            <Text style={styles.switchLink}>{t('auth.signup.signIn')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  // ── Painel direito: bairro abstrato vivo ─────────────────────
  // O gradiente de fundo agora é um layer único no root (ver return do
  // desktop abaixo), cobrindo os dois lados sem costura — antes cada
  // painel tinha o seu próprio gradiente, então a área por trás do cartão
  // flutuante (ver glassBox) ficaria branca em vez de continuar o mapa.
  const artHeadlineY = isCompactDesktop ? 42 : SCAPE_ANCHORS.headline.y;
  const avatarClusterY = isCompactDesktop ? 63 : SCAPE_ANCHORS.avatarCluster.y;
  const renderArt = () => (
    <View style={styles.rightPanel} ref={rightPanelRef}>

      <Animated.View
        style={StyleSheet.absoluteFill}
        entering={reducedMotion ? undefined : FadeIn.duration(1100)}
      >
        <Animated.View style={[StyleSheet.absoluteFill, artParallaxStyle]}>
          <NeighborhoodScape variant="full" reducedMotion={reducedMotion} pointerDirX={tailDirX} pointerDirY={tailDirY} />
        </Animated.View>
      </Animated.View>

      <View style={[
        styles.artHeadline,
        isCompactDesktop && styles.artHeadlineCompact,
        { top: `${artHeadlineY}%`, height: `${avatarClusterY - artHeadlineY}%` },
      ]}>
        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(200).duration(700)}>
          <Text style={[styles.artWord, isCompactDesktop && styles.artWordCompact]}>
            {t('auth.artHeadlinePrefix')}<Text style={styles.artWordAccent}>{t('auth.artHeadlineAccent')}</Text>
          </Text>
        </Animated.View>
        <Animated.View
          style={styles.artSublineSlot}
          entering={reducedMotion ? undefined : FadeInDown.delay(320).duration(700)}
        >
          <Text style={[styles.artSubline, isCompactDesktop && styles.artSublineCompact]}>
            {t('auth.artSubline')}
          </Text>
        </Animated.View>
      </View>

      {communityStats && (
        <View style={[
          styles.avatarClusterWrap,
          { top: `${avatarClusterY}%` },
        ]}>
          <Animated.View
            style={styles.avatarCluster}
            entering={reducedMotion ? undefined : FadeInDown.delay(360).duration(700)}
          >
            {communityStats.avatarUrls.slice(0, 5).map((url, i) => (
              <Image key={`${url}-${i}`} source={{ uri: url }}
                style={[styles.clusterAvatar, { marginLeft: i > 0 ? -14 : 0, zIndex: 10 - i }]} />
            ))}
            <View style={[styles.clusterBadge, communityStats.avatarUrls.length === 0 && { marginLeft: 0 }]}>
              <Text style={styles.clusterBadgeText}>
                {communityStats.totalUsers >= ESTABLISHED_COMMUNITY_THRESHOLD
                  ? t('auth.neighborsCount', { count: communityStats.totalUsers.toLocaleString(numberLocale) })
                  : t('auth.communityGrowingCta')}
              </Text>
            </View>
          </Animated.View>
        </View>
      )}

      {ACTIVITY_CARDS.map((c, i) => {
        const anchor = SCAPE_ANCHORS[c.anchor];
        const onRight = anchor.x > 50;
        return (
          <Animated.View
            key={c.anchor}
            style={[
              styles.floatCardWrap,
              { top: `${anchor.y}%` },
              onRight ? { right: `${100 - anchor.x}%` } : { left: `${anchor.x}%` },
            ]}
            entering={reducedMotion ? undefined : FadeInDown.delay(560 + i * 150).duration(650)}
          >
            <BlurView intensity={36} tint="dark" style={[styles.floatCard, isCompactDesktop && styles.floatCardCompact]}>
              <View style={[styles.floatCardIcon, isCompactDesktop && styles.floatCardIconCompact, { backgroundColor: `${c.color}2A` }]}>
                <Ionicons name={c.icon} size={15} color={c.color} />
              </View>
              <View style={styles.floatCardBody}>
                <Text style={styles.floatCardLabel}>{t(c.labelKey)}</Text>
                <Text style={styles.floatCardText} numberOfLines={1}>{t(c.textKey)}</Text>
              </View>
            </BlurView>
          </Animated.View>
        );
      })}
    </View>
  );

  // ── Mobile: composição compacta ───────────────────────────────
  if (!isWide) {
    return (
      <LinearGradient colors={['#041B10', '#0E3322', '#15803D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mobileRoot}>
        <ScrollView contentContainerStyle={styles.mobileContent} showsVerticalScrollIndicator={false}>
          <View style={styles.mobileLogo}>
            <View style={styles.mobileLogoIcon}>
              <DaquiMark size={26} color="#fff" />
            </View>
            <Text style={styles.mobileAppName}>daqui</Text>
          </View>

          <Animated.View
            style={styles.mobileScape}
            entering={reducedMotion ? undefined : FadeIn.duration(900)}
          >
            <NeighborhoodScape variant="compact" reducedMotion={reducedMotion} />
          </Animated.View>

          <Text style={styles.mobileHeadline}>
            {t('auth.headline')}
          </Text>
          <Text style={styles.mobileSubline}>
            {t('auth.subline')}
          </Text>

          {communityStats && (
            <View style={styles.mobileAvatarCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                {communityStats.avatarUrls.slice(0, 5).map((url, i) => (
                  <Image key={`${url}-${i}`} source={{ uri: url }}
                    style={[styles.mobileAvatar, { marginLeft: i > 0 ? -14 : 0, zIndex: 5 - i }]} />
                ))}
                {communityStats.totalUsers >= ESTABLISHED_COMMUNITY_THRESHOLD && (
                  <View style={styles.mobileBadge}>
                    <Text style={styles.mobileBadgeText}>{communityStats.totalUsers.toLocaleString(numberLocale)}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.mobileAvatarLabel}>
                {communityStats.totalUsers >= ESTABLISHED_COMMUNITY_THRESHOLD
                  ? t('auth.neighborsNearYou')
                  : t('auth.communityGrowingCta')}
              </Text>
            </View>
          )}

          <View style={styles.mobileFeaturesArea}>
            {FEATURES.map((f) => (
              <View key={f.icon} style={styles.mobileFeatureRow}>
                <View style={styles.mobileFeatureIcon}><Ionicons name={f.icon} size={16} color="#fff" /></View>
                <Text style={styles.mobileFeatureText}>{t(f.labelKey)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.mobileCtaArea}>
            <CtaButton kind="mobilePrimary" label={t('auth.getStarted')} icon="arrow-forward" onPress={() => router.push('/(auth)/signup')} />
            <CtaButton kind="mobileSecondary" label={t('auth.haveAccount')} icon="arrow-forward" showIcon={false} onPress={() => router.push('/(auth)/login')} />
          </View>

          <Text style={styles.mobileTerms}>
            {t('auth.termsPrefix')}
            <Text style={styles.mobileTermsLink} onPress={() => router.push('/legal/terms')}>{t('auth.termsOfUse')}</Text>
            {t('auth.and')}
            <Text style={styles.mobileTermsLink} onPress={() => router.push('/legal/privacy')}>{t('auth.privacyPolicy')}</Text>
          </Text>
        </ScrollView>
      </LinearGradient>
    );
  }

  // ── Desktop: cartão de vidro flutuante ⇄ painel cheio ────────
  // O slot esquerdo (leftPanel) tem tamanho fixo (mesma fração de sempre);
  // só o "glassBox" DENTRO dele muda de forma — cartão arredondado com
  // margem em welcome, painel rente às bordas em login/cadastro. O slide()
  // horizontal do conteúdo (exit/enter) continua exatamente como antes,
  // agora dentro do glassBox em vez de direto no slot.
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#041B10', '#0B3220', '#123E27', '#15803D']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Textura ambiente cobrindo a tela inteira — sem isso, o mapa
          detalhado (só do lado direito) parecia acabar bruscamente onde o
          cartão de vidro flutuante deixa o fundo à mostra. */}
      <AmbientBackdrop reducedMotion={reducedMotion} />
      <View
        style={styles.leftPanel}
        onLayout={(e) => setLeftPanelWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.glassBox, glassBoxStyle]}>
          {/* tint="dark" fixo — o crossfade de cor real é o glassBoxTint por
              cima; como ele fica quase opaco no estado expandido, o tint do
              blur em si deixa de importar visualmente nesse ponto. */}
          <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
          <Animated.View style={[styles.glassBoxTint, glassTintStyle]} pointerEvents="none" />
          <Animated.View style={[styles.glassBoxBorder, glassBorderStyle]} pointerEvents="none" />

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
          {/* Véu de transição — só aparece no estado "painel cheio", funde a
              borda no verde escuro do lado direito em vez de um corte reto.
              Sem sentido no cartão flutuante, que já tem margem visível pra
              todos os lados. */}
          <Animated.View style={[StyleSheet.absoluteFill, edgeVeilAnimStyle]} pointerEvents="none">
            <LinearGradient
              colors={['transparent', 'rgba(3,20,12,0.32)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.leftEdgeVeil}
            />
          </Animated.View>
        </Animated.View>
      </View>
      {renderArt()}
    </View>
  );
}

// ─── Estilos ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#041B10' },

  // Painel esquerdo — slot de tamanho fixo (mesma fração de sempre); é só o
  // glassBox lá dentro que muda de forma entre cartão flutuante e painel
  // cheio (ver boxExpand/glassBoxStyle no componente).
  leftPanel: { flex: 7, minWidth: 420, position: 'relative' },
  // Sem backgroundColor próprio — a cor vem inteira do glassBoxTint (filho
  // animado) por cima do BlurView; um fundo opaco fixo aqui atrás do blur
  // esconderia o mapa que deveria aparecer através do vidro escuro.
  glassBox: {
    position: 'absolute',
    overflow: 'hidden',
  },
  // Vidro escuro translúcido (igual aos chips do mapa) no cartão flutuante
  // ⇄ off-white quase opaco no painel cheio — cor E opacidade animam juntas
  // (ver glassTintStyle), não é só um tom fixo ficando mais opaco.
  glassBoxTint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Aro claro característico de liquid glass — só visível no cartão
  // flutuante (some conforme expande, ver glassBorderStyle).
  glassBoxBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1 },
  leftEdgeVeil: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 64 },
  leftScroll: { flex: 1 },
  leftContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 56,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  leftContentCompact: { paddingHorizontal: 36, paddingVertical: 28 },
  // Antes ficava ancorado no topo (justifyContent:'flex-start') — deixava
  // login/cadastro parecendo menores e "mais pra cima" que o welcome, que
  // centraliza verticalmente. Herda o center do leftContent pra ocupar o
  // mesmo espaço visual.
  formContent: { paddingTop: 4 },
  signupContentCompact: { paddingHorizontal: 36, paddingBottom: 24 },

  // Hero
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 48 },
  logoRowCompact: { gap: 13, marginBottom: 24 },
  logoIcon: { width: 84, height: 84, borderRadius: 23, backgroundColor: Colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  logoIconCompact: { width: 66, height: 66, borderRadius: 19 },
  logoText: { fontSize: 42, fontWeight: '800', color: Colors.text, letterSpacing: -1, fontFamily: BRAND_FONT },
  logoTextCompact: { fontSize: 36 },
  headline: { fontSize: 42, fontWeight: '800', color: Colors.text, letterSpacing: -1, lineHeight: 49, marginBottom: 16 },
  headlineCompact: { fontSize: 34, lineHeight: 39, marginBottom: 10 },
  subline: { fontSize: 16.5, color: Colors.textSecondary, lineHeight: 26, marginBottom: 38, maxWidth: 360 },
  sublineCompact: { fontSize: 15, lineHeight: 21, marginBottom: 22 },

  featuresList: { gap: 22, marginBottom: 40 },
  featuresListCompact: { gap: 10, marginBottom: 22 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureRowCompact: { gap: 11 },
  featureIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  featureIconCompact: { width: 32, height: 32, borderRadius: 10 },
  // Empilha os dois ícones (claro/escuro) exatamente um sobre o outro pra
  // o crossfade de opacidade não deslocar nada.
  featureIconGlyph: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  featureText: { fontSize: 15.5, color: Colors.text, fontWeight: '700' },
  featureTextCompact: { fontSize: 14.5 },

  // CTAs do hero/mobile (só "Começar agora" / "Já tenho conta")
  ctaArea: { gap: 10, marginBottom: 22 },
  ctaAreaCompact: { gap: 8, marginBottom: 14 },
  ctaHeroCompact: { height: 46 },
  ctaHeroPrimary: {
    backgroundColor: Colors.primaryDark, borderRadius: 14, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0px 6px 16px rgba(21,128,61,0.22)',
    transitionDuration: '160ms', transitionProperty: 'background-color, box-shadow, transform',
  } as any,
  ctaHeroPrimaryHover: { backgroundColor: '#127A3E', boxShadow: '0px 8px 20px rgba(21,128,61,0.3)' } as any,
  ctaHeroPrimaryPressed: { transform: [{ scale: 0.98 }] },
  ctaHeroPrimaryFocus: { outlineWidth: 2, outlineColor: Colors.primaryDark, outlineOffset: 3, outlineStyle: 'solid' } as any,
  ctaHeroPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ctaHeroSecondary: {
    borderRadius: 14, height: 54, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.border, flexDirection: 'row', gap: 8,
    transitionDuration: '160ms', transitionProperty: 'background-color, border-color, transform',
  } as any,
  ctaHeroSecondaryHover: { backgroundColor: Colors.borderLight, borderColor: Colors.textTertiary } as any,
  ctaHeroSecondaryPressed: { transform: [{ scale: 0.98 }] },
  ctaHeroSecondaryFocus: { outlineWidth: 2, outlineColor: Colors.primaryDark, outlineOffset: 3, outlineStyle: 'solid' } as any,
  ctaHeroSecondaryText: { color: Colors.text, fontSize: 16, fontWeight: '600' },

  authErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(239,68,68,0.16)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  authErrorText: { flex: 1, fontSize: 13, color: FORM_ERROR_TEXT, fontWeight: '500' },
  // Quebra a margem horizontal do leftContent (40px) só nesta linha — o
  // texto dos termos é o único conteúdo do hero largo o bastante pra
  // precisar da caixa inteira do glassBox pra caber numa linha só; os
  // demais elementos (headline, botões, etc.) continuam com o respiro
  // padrão do leftContent.
  terms: { textAlign: 'center', color: Colors.textTertiary, fontSize: 12, lineHeight: 18, marginHorizontal: -40 },
  termsLink: { color: Colors.textSecondary, textDecorationLine: 'underline' },

  // Formulários (login/cadastro) — o glassBox permanece em vidro escuro
  // também no painel expandido (ver glassTintStyle), então esses estilos
  // usam a paleta clara FORM_* em vez das cores escuras-sobre-branco padrão
  // do resto do app.
  btnPrimary: { backgroundColor: Colors.primaryDark, borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...Colors.shadow.md },
  btnPrimaryCompact: { paddingVertical: 13 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  backBtnCompact: { width: 34, height: 34, marginBottom: 14 },
  formHeader: { marginBottom: 28 },
  formHeaderCompact: { marginBottom: 18 },
  formTitle: { fontSize: 28, fontWeight: '800', color: FORM_TEXT, letterSpacing: -0.5, marginBottom: 4 },
  formTitleCompact: { fontSize: 25 },
  formSubtitle: { fontSize: 14, color: FORM_TEXT_SECONDARY },
  inputGroup: { marginBottom: 16 },
  inputGroupCompact: { marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', color: FORM_TEXT, marginBottom: 7 },
  labelCompact: { marginBottom: 5 },
  fieldError: { fontSize: 12, color: FORM_ERROR_TEXT, marginTop: 6, fontWeight: '500' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 13, height: 50 },
  inputWrapperCompact: { height: 46 },
  inputIcon: { marginRight: 9 },
  input: { flex: 1, fontSize: 15, color: FORM_TEXT },
  inputFlex: { flex: 1, fontSize: 15, color: FORM_TEXT },
  eyeBtn: { padding: 4 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: 13, color: FORM_ACCENT, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  dividerText: { fontSize: 12, color: FORM_TEXT_TERTIARY, fontWeight: '500' },
  socialRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 13, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' },
  socialText: { fontSize: 14, fontWeight: '600', color: FORM_TEXT },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  switchRowCompact: { marginTop: 12 },
  switchText: { fontSize: 14, color: FORM_TEXT_SECONDARY },
  switchLinkBtn: { borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2, marginHorizontal: -4, marginVertical: -2 },
  switchLink: { fontSize: 14, color: FORM_ACCENT, fontWeight: '700' },

  // Signup steps
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  stepRowCompact: { marginBottom: 16 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  stepNum: { fontSize: 11, fontWeight: '700', color: FORM_TEXT_TERTIARY },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: 11, color: FORM_TEXT_TERTIARY, marginLeft: 5, fontWeight: '500' },
  stepLabelActive: { color: FORM_TEXT },
  stepLine: { width: 20, height: 1.5, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.primary },

  // Verificação de e-mail (signup step 1 / login mode "verify")
  twoFaIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 14, marginBottom: 20 },
  twoFaText: { flex: 1, fontSize: 13, color: FORM_TEXT_SECONDARY, lineHeight: 18 },

  successArea: { alignItems: 'center', paddingVertical: 16 },
  successIcon: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20, ...Colors.shadow.lg },
  successDesc: { fontSize: 15, color: FORM_TEXT_SECONDARY, textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  // Painel direito — bairro abstrato
  rightPanel: { flex: 13, overflow: 'hidden', position: 'relative' },

  artHeadline: { position: 'absolute', left: '8%', right: '8%', alignItems: 'center' },
  artHeadlineCompact: { left: '10%', right: '10%' },
  artWord: { fontSize: 46, fontWeight: '800', color: 'rgba(255,255,255,0.96)', letterSpacing: -1.2, textAlign: 'center', lineHeight: 54 },
  artWordCompact: { fontSize: 40, lineHeight: 46 },
  artWordAccent: { color: '#4ADE80' },
  artSublineSlot: { flex: 1, justifyContent: 'center', width: '100%' },
  artSubline: {
    fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.72)',
    textAlign: 'center', lineHeight: 22,
    maxWidth: 460, alignSelf: 'center',
  },
  artSublineCompact: { fontSize: 14, lineHeight: 20, maxWidth: 430 },

  avatarClusterWrap: { position: 'absolute', left: '8%', right: '8%', alignItems: 'center' },
  avatarCluster: { flexDirection: 'row', alignItems: 'center' },
  clusterAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#0B3220' },
  clusterBadge: { marginLeft: 12, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  clusterBadgeText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  floatCardWrap: { position: 'absolute', maxWidth: 264 },
  floatCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 15, overflow: 'hidden',
    backgroundColor: 'rgba(10,30,20,0.30)',
  },
  floatCardCompact: { gap: 10, paddingVertical: 10, paddingHorizontal: 13 },
  floatCardIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  floatCardIconCompact: { width: 30, height: 30, borderRadius: 9 },
  floatCardBody: { flexShrink: 1 },
  floatCardLabel: { fontSize: 10.5, fontWeight: '700', color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  floatCardText: { fontSize: 14, color: '#fff', fontWeight: '500' },

  // Mobile
  mobileRoot: { flex: 1, overflow: 'hidden' },
  mobileContent: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 48, paddingBottom: 36 },
  mobileLogo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 18 },
  mobileLogoIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  mobileAppName: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -1, fontFamily: BRAND_FONT },
  mobileScape: { height: 132, marginBottom: 8, position: 'relative' },
  mobileHeadline: { fontSize: 27, fontWeight: '800', color: '#fff', letterSpacing: -0.6, lineHeight: 33, textAlign: 'center', marginBottom: 10 },
  mobileSubline: { fontSize: 14.5, color: 'rgba(255,255,255,0.78)', lineHeight: 21, textAlign: 'center', marginBottom: 24, maxWidth: 340, alignSelf: 'center' },
  mobileAvatarCard: { backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 18, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', marginBottom: 22 },
  mobileAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#0E3322' },
  mobileBadge: { marginLeft: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  mobileBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  mobileAvatarLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13.5, fontWeight: '500' },
  mobileFeaturesArea: { gap: 18, marginBottom: 28, alignSelf: 'center', alignItems: 'flex-start' },
  mobileFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mobileFeatureIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  mobileFeatureText: { color: 'rgba(255,255,255,0.92)', fontSize: 14.5, fontWeight: '600' },
  mobileCtaArea: { gap: 10, marginBottom: 20 },
  ctaMobilePrimary: {
    backgroundColor: '#fff', borderRadius: 14, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.18)',
    transitionDuration: '160ms', transitionProperty: 'background-color, box-shadow, transform',
  } as any,
  ctaMobilePrimaryHover: { backgroundColor: '#F0FDF4' } as any,
  ctaMobilePrimaryPressed: { transform: [{ scale: 0.98 }] },
  ctaMobilePrimaryFocus: { outlineWidth: 2, outlineColor: '#fff', outlineOffset: 3, outlineStyle: 'solid' } as any,
  ctaMobilePrimaryText: { color: Colors.primaryDark, fontSize: 16, fontWeight: '700' },
  ctaMobileSecondary: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)',
    flexDirection: 'row', gap: 8,
    transitionDuration: '160ms', transitionProperty: 'background-color, border-color, transform',
  } as any,
  ctaMobileSecondaryHover: { backgroundColor: 'rgba(255,255,255,0.18)' } as any,
  ctaMobileSecondaryPressed: { transform: [{ scale: 0.98 }] },
  ctaMobileSecondaryFocus: { outlineWidth: 2, outlineColor: '#fff', outlineOffset: 3, outlineStyle: 'solid' } as any,
  ctaMobileSecondaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  mobileTerms: { textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18 },
  mobileTermsLink: { color: 'rgba(255,255,255,0.8)', textDecorationLine: 'underline' },
});
