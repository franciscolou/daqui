import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, withSpring, Easing,
} from 'react-native-reanimated';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { goBack } from '../../lib/navigation';
import { adsApi, AdPlan, AdPlanCategory, AdFormat } from '../../lib/adsApi';
import { AD_CONTACT_CHANNELS } from '../../constants/ads';
import AdCirculationArt from '../../components/AdCirculationArt';

const CONTENT_MAX = 1180;

const FORMAT_LABEL: Record<AdFormat, string> = {
  post: 'Post no feed',
  map: 'Pin no mapa',
  conversation: 'Conversa',
  notification: 'Novidades',
  search_poster: 'Busca',
};

const FORMAT_ICON: Record<AdFormat, keyof typeof Ionicons.glyphMap> = {
  post: 'newspaper-outline',
  map: 'location-outline',
  conversation: 'chatbubbles-outline',
  notification: 'megaphone-outline',
  search_poster: 'search-outline',
};

const CATEGORIES: {
  key: AdPlanCategory;
  label: string;
  tagline: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: readonly [string, string, ...string[]];
}[] = [
  {
    key: 'local_business',
    label: 'Comércio local',
    tagline: 'Seja a referência do seu bairro',
    icon: 'storefront-outline',
    gradient: ['#22C55E', '#16A34A'],
  },
  {
    key: 'event',
    label: 'Anuncie seu evento',
    tagline: 'Encha seu evento de gente da vizinhança',
    icon: 'calendar-outline',
    gradient: ['#F97316', '#EF4444'],
  },
  {
    key: 'enterprise',
    label: 'Grandes empresas',
    tagline: 'Alcance sua cidade inteira com força total',
    icon: 'business-outline',
    gradient: ['#6366F1', '#3B82F6'],
  },
  {
    key: 'national',
    label: 'Alcance nacional',
    tagline: 'Várias cidades de uma vez ou o Brasil todo',
    icon: 'globe-outline',
    gradient: ['#0EA5E9', '#6366F1'],
  },
];

const HERO_BULLETS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'location-outline', text: 'Alcance por bairro, sob seu controle' },
  { icon: 'layers-outline', text: 'Controle cada detalhe' },
  { icon: 'people-outline', text: 'Monte a campanha perfeita' },
];

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function reachLabel(plan: AdPlan) {
  if (plan.geoScope === 'country') return 'Brasil todo';
  if (plan.geoScope === 'cities') return plan.maxCities ? `até ${plan.maxCities} cidades` : 'várias cidades';
  if (plan.geoScope === 'citywide') return 'cidade toda';
  return plan.maxNeighborhoods ? `até ${plan.maxNeighborhoods} bairro(s)` : 'cidade toda';
}

function FadeSlideIn({
  delay, children, style, reducedMotion,
}: { delay: number; children: React.ReactNode; style?: any; reducedMotion: boolean }) {
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withDelay(delay, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);
  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 16 }],
  }));
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}

// Wrapper de toque com escala + realce de foco de teclado próprios.
// O anel de foco vai no wrapper (não no Pressable interno, que tem o mesmo
// overflow:hidden do card arredondado) — como é uma borda comum (não
// box-shadow com espalhamento), fica sempre dentro da própria caixa e nunca
// é cortado pelo clip. Hover continua vindo de graça do realce global (ver
// lib/globalStyles.web.ts), que já reage a qualquer Pressable com raio.
function PressableScale({
  onPress, children, style, radius = 0, accessibilityRole, accessibilityLabel, accessibilityState, disabled,
  onHoverIn, onHoverOut,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  radius?: number;
  accessibilityRole?: 'button' | 'radio' | 'link';
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  disabled?: boolean;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
}) {
  const scale = useSharedValue(1);
  const [focused, setFocused] = useState(false);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const clipStyle = { borderRadius: radius, overflow: 'hidden' as const };
  return (
    // `style` (flex/flexBasis/width — sizing dentro do grid) vai no wrapper
    // externo, que é o item de verdade dentro do row/wrap do chamador; o
    // Pressable interno só recebe estilo visual. Views RN esticam o filho
    // único no eixo cruzado por padrão (alignItems: 'stretch'), então o
    // Pressable acompanha a largura resolvida aqui sem precisar repetir nada.
    <Animated.View style={[clipStyle, animStyle, style, focused && localStyles.focusRing]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onHoverIn={onHoverIn}
        onHoverOut={onHoverOut}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 16, stiffness: 220 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 200 }); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        style={[clipStyle, { outlineStyle: 'none' } as any]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  focusRing: { borderWidth: 2, borderColor: '#22C55E' } as any,
});

// Botão "Contratar este plano": hover próprio (não o realce cinza global)
// para reforçar a hierarquia entre o CTA cheio (popular) e o com contorno —
// o preenchido aprofunda pro verde escuro da marca + ganha "peso" (sombra +
// leve elevação), o com contorno vira preenchido de leve. Troca de estilo é
// instantânea (mesmo padrão de app/(auth)/welcome.tsx), só a `transition`
// CSS deixa o câmbio suave — sem depender de Reanimated pra isso.
function PlanCtaButton({
  popular, label, onPress, accessibilityLabel,
}: { popular: boolean; label: string; onPress: () => void; accessibilityLabel: string }) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const clipStyle = { borderRadius: 14, overflow: 'hidden' as const };

  return (
    <Animated.View style={[clipStyle, animStyle, focused && localStyles.focusRing]}>
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 16, stiffness: 220 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 200 }); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[clipStyle, { outlineStyle: 'none' } as any]}
      >
        {popular ? (
          <LinearGradient
            colors={hovered ? ['#15803D', '#16A34A'] : ['#16A34A', '#22C55E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.planBtn, hovered && styles.planBtnPopularHover]}
          >
            <Text style={styles.planBtnTextLight}>{label}</Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color="#fff"
              style={[styles.planBtnIcon, hovered && styles.planBtnIconHover]}
            />
          </LinearGradient>
        ) : (
          <View style={[styles.planBtn, styles.planBtnTinted, hovered && styles.planBtnTintedHover]}>
            <Text style={[styles.planBtnTextDark, hovered && styles.planBtnTextDarkHover]}>{label}</Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={styles.planBtnTextDarkHover.color}
              style={[styles.planBtnIcon, hovered && styles.planBtnIconHover]}
            />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function AdvertiseScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [customHovered, setCustomHovered] = useState(false);
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const bp: 'mobile' | 'tablet' | 'desktop' = width >= 1040 ? 'desktop' : width >= 680 ? 'tablet' : 'mobile';

  const [plans, setPlans] = useState<AdPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<AdPlanCategory>('local_business');

  useEffect(() => {
    adsApi.getAdPlans().then(setPlans).catch(() => setPlans([])).finally(() => setLoading(false));
  }, []);

  const plansByCategory = useMemo(() => {
    const map: Record<string, AdPlan[]> = {};
    for (const p of plans) {
      const key = p.category ?? 'outros';
      (map[key] ||= []).push(p);
    }
    return map;
  }, [plans]);

  const activeMeta = CATEGORIES.find((c) => c.key === activeCategory)!;
  const activePlans = plansByCategory[activeCategory] ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => goBack('/')}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} accessibilityRole="header">Anuncie no Daqui</Text>
          <View style={styles.iconBtn} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          {/* ── Hero ────────────────────────────────────────────────── */}
          <FadeSlideIn delay={0} reducedMotion={reducedMotion}>
            <LinearGradient
              colors={['#15803D', '#16A34A', '#22C55E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.hero, bp !== 'mobile' && styles.heroWide]}
            >
              <View style={styles.heroGlow} />
              <View style={[styles.heroContent, bp !== 'mobile' && styles.heroContentRow]}>
                <View style={styles.heroText}>
                  {/* <View style={styles.eyebrowPill}>
                    <Ionicons name="megaphone" size={13} color="#fff" />
                    <Text style={styles.eyebrowText}>PUBLICIDADE LOCAL</Text>
                  </View> */}
                  <Text style={styles.heroTitle} accessibilityRole="header">Foque no seu negócio, a divulgação a gente resolve.</Text>
                  <Text style={styles.heroSubtitle}>
                    Apareça para quem mora perto: post no feed, pin no mapa, aviso em Novidades e recomendação
                    nas Mensagens — tudo segmentado por bairro.
                  </Text>
                  <View style={styles.heroBullets}>
                    {HERO_BULLETS.map((b) => (
                      <View key={b.text} style={styles.heroBulletRow}>
                        <Ionicons name={b.icon} size={15} color="rgba(255,255,255,0.95)" />
                        <Text style={styles.heroBulletText}>{b.text}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                {bp !== 'mobile' && (
                  <View style={styles.heroArt}>
                    <AdCirculationArt reducedMotion={reducedMotion} />
                  </View>
                )}
              </View>
            </LinearGradient>
          </FadeSlideIn>

          {/* ── Seleção de perfil ──────────────────────────────────── */}
          <FadeSlideIn delay={70} reducedMotion={reducedMotion} style={styles.sectionHead}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Escolha o seu perfil</Text>
            <Text style={styles.sectionSubtitle}>O perfil define quais planos fazem mais sentido pro seu anúncio.</Text>
          </FadeSlideIn>

          <FadeSlideIn delay={110} reducedMotion={reducedMotion}>
            <View style={[styles.categoryGrid, bp === 'desktop' && styles.categoryGridDesktop]} accessibilityRole="radiogroup">
              {CATEGORIES.map((cat) => {
                const active = cat.key === activeCategory;
                return (
                  <PressableScale
                    key={cat.key}
                    onPress={() => setActiveCategory(cat.key)}
                    style={bp !== 'desktop' ? styles.categoryItemGrid : { flex: 1 }}
                    radius={18}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${cat.label}. ${cat.tagline}`}
                  >
                    <View style={[styles.categoryCard, active && styles.categoryCardActive]}>
                      {active ? (
                        <LinearGradient colors={cat.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.categoryIconBg}>
                          <Ionicons name={cat.icon} size={19} color="#fff" />
                        </LinearGradient>
                      ) : (
                        <LinearGradient
                          colors={cat.gradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[styles.categoryIconBg, styles.categoryIconBgInactive]}
                        >
                          <Ionicons name={cat.icon} size={19} color="#fff" />
                        </LinearGradient>
                      )}
                      <View style={styles.categoryTextCol}>
                        <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{cat.label}</Text>
                        <Text style={styles.categoryTagline} numberOfLines={2}>{cat.tagline}</Text>
                      </View>
                      {active && (
                        <View style={styles.categoryCheck}>
                          <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                        </View>
                      )}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </FadeSlideIn>

          {/* ── Planos ─────────────────────────────────────────────── */}
          <FadeSlideIn delay={140} reducedMotion={reducedMotion} style={styles.sectionHead}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Planos para {activeMeta.label.toLowerCase()}</Text>
            <Text style={styles.sectionSubtitle}>Compare preço, duração e alcance — contrate pronto ou personalize do seu jeito.</Text>
          </FadeSlideIn>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
          ) : (
            <View key={activeCategory} style={[styles.plansRow, bp === 'desktop' && styles.plansRowDesktop, bp === 'tablet' && styles.plansRowTablet]}>
              {activePlans.map((plan, i) => {
                const popular = plan.badge === 'Mais popular';
                return (
                  <FadeSlideIn
                    key={plan.id}
                    delay={90 * i}
                    reducedMotion={reducedMotion}
                    style={bp === 'desktop' ? { flex: 1 } : bp === 'tablet' ? styles.planItemTablet : undefined}
                  >
                    <View style={[styles.planCard, popular && styles.planCardPopular]}>
                      {popular && (
                        <View style={styles.popularRibbon}>
                          <Ionicons name="star" size={13} color="#fff" />
                          <Text style={styles.popularRibbonText}>{plan.badge}</Text>
                        </View>
                      )}
                      <View style={styles.planCardBody}>
                        {!popular && plan.badge && (
                          <View style={styles.softBadge}>
                            <Ionicons name="sparkles" size={12} color={Colors.primary} />
                            <Text style={styles.softBadgeText}>{plan.badge}</Text>
                          </View>
                        )}
                        <Text style={styles.planName}>{plan.name}</Text>
                        <View style={styles.planPriceRow}>
                          <Text style={styles.planPrice}>{formatMoney(plan.priceCents)}</Text>
                          <Text style={styles.planPriceMeta}>/ {plan.durationDays} dias</Text>
                        </View>
                        <Text style={styles.planDesc} numberOfLines={4}>{plan.description}</Text>

                        <View style={styles.planDivider} />

                        <Text style={styles.planFormatsLabel}>Aparece em</Text>
                        <View style={styles.formatsRow}>
                          {plan.formats.map((f) => (
                            <View key={f} style={styles.formatTag}>
                              <Ionicons name={FORMAT_ICON[f]} size={12} color={Colors.primaryDark} />
                              <Text style={styles.formatTagText}>{FORMAT_LABEL[f] || f}</Text>
                            </View>
                          ))}
                        </View>

                        <View style={styles.planReachRow}>
                          <Ionicons name="navigate-outline" size={13} color={Colors.textSecondary} />
                          <Text style={styles.planReachText}>{reachLabel(plan)}</Text>
                        </View>

                        <View style={styles.planCtaSpacer} />

                        <PlanCtaButton
                          popular={popular}
                          label="Contratar este plano"
                          onPress={() => router.push({ pathname: '/advertise/customize', params: { planId: String(plan.id) } })}
                          accessibilityLabel={`Contratar plano ${plan.name}, ${formatMoney(plan.priceCents)} por ${plan.durationDays} dias`}
                        />
                      </View>
                    </View>
                  </FadeSlideIn>
                );
              })}
            </View>
          )}

          {/* ── Plano personalizado ────────────────────────────────── */}
          <PressableScale
            onPress={() => router.push('/advertise/customize')}
            onHoverIn={() => setCustomHovered(true)}
            onHoverOut={() => setCustomHovered(false)}
            radius={20}
            style={styles.customCardWrap}
            accessibilityRole="button"
            accessibilityLabel="Montar meu próprio plano de anúncio"
          >
            <View style={styles.customCard}>
              <View style={styles.customIconBg}>
                <Ionicons name="options-outline" size={22} color={Colors.primary} />
              </View>
              <View style={styles.customTextCol}>
                <Text style={styles.customTitle}>Ou monte seu próprio plano</Text>
                <Text style={styles.customSubtitle}>Escolha formatos, alcance e duração sob medida para o seu orçamento.</Text>
              </View>
              <View style={[styles.customCtaPill, customHovered && styles.customCtaPillHover]}>
                <Text style={[styles.customCtaText, customHovered && styles.customCtaTextHover]}>Personalizar</Text>
                <Ionicons
                  name="arrow-forward"
                  size={15}
                  color={customHovered ? '#fff' : Colors.primary}
                  style={[styles.customCtaIcon, customHovered && styles.customCtaIconHover]}
                />
              </View>
            </View>
          </PressableScale>

          {/* ── Negociação direta ──────────────────────────────────── */}
          <View style={styles.contactSection}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Prefere negociar direto?</Text>
            <Text style={styles.contactHint}>Fale com a equipe responsável pelos anúncios para montarmos uma proposta sob medida.</Text>
            <View style={styles.contactRow}>
              {AD_CONTACT_CHANNELS.map((c) => (
                <PressableScale
                  key={c.key}
                  onPress={() => Linking.openURL(c.url)}
                  radius={14}
                  style={styles.contactTileWrap}
                  accessibilityRole="link"
                  accessibilityLabel={`${c.title}: ${c.label}`}
                >
                  <View style={styles.contactTile}>
                    <View style={styles.contactIconBg}>
                      <Ionicons name={c.icon as any} size={18} color={Colors.primary} />
                    </View>
                    <View style={styles.contactTextCol}>
                      <Text style={styles.contactTitleText}>{c.title}</Text>
                      <Text style={styles.contactValueText} numberOfLines={1}>{c.label}</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={Colors.textTertiary} />
                  </View>
                </PressableScale>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    ...Colors.shadow.sm,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    maxWidth: CONTENT_MAX,
    width: '100%',
    alignSelf: 'center',
  },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 19, fontWeight: '800', color: Colors.text, letterSpacing: -0.2 },

  scrollBody: { padding: 20, paddingBottom: 56 },
  body: { gap: 28, maxWidth: CONTENT_MAX, width: '100%', alignSelf: 'center' },

  // ── Hero ──────────────────────────────────────────────────────
  hero: {
    borderRadius: 26,
    padding: 28,
    overflow: 'hidden',
    boxShadow: '0px 16px 40px rgba(15,60,30,0.28)',
  } as any,
  heroWide: { padding: 40 },
  heroGlow: {
    position: 'absolute', width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.08)', top: -140, left: -100,
  },
  heroContent: { gap: 24 },
  heroContentRow: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  heroText: { gap: 14, flex: 1.05, minWidth: 0 },
  eyebrowPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  eyebrowText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.6 },
  heroTitle: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.6, lineHeight: 36 },
  heroSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.94)', lineHeight: 22, maxWidth: 480 },
  heroBullets: { gap: 9, marginTop: 4 },
  heroBulletRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroBulletText: { fontSize: 13.5, fontWeight: '600', color: 'rgba(255,255,255,0.96)' },
  heroArt: { flex: 0.95, height: 260, minWidth: 260 },

  // ── Cabeçalhos de seção ──────────────────────────────────────
  sectionHead: { gap: 4 },
  sectionTitle: { fontSize: 21, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  // ── Seletor de perfil ────────────────────────────────────────
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' },
  categoryGridDesktop: { flexWrap: 'nowrap' },
  categoryItemGrid: { flexBasis: '48%', flexGrow: 1 },
  categoryCard: {
    flex: 1,
    minHeight: 84,
    padding: 14,
    paddingRight: 22,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  categoryCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaint,
    ...Colors.shadow.sm,
  },
  categoryIconBg: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  categoryIconBgInactive: { opacity: 0.55 },
  categoryTextCol: { flex: 1, minWidth: 0, gap: 2 },
  categoryCheck: { position: 'absolute', top: 10, right: 10 },
  categoryLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.textSecondary, lineHeight: 18 },
  categoryLabelActive: { color: Colors.text, fontWeight: '800' },
  categoryTagline: { fontSize: 12, color: Colors.textTertiary, lineHeight: 16 },

  // ── Planos ───────────────────────────────────────────────────
  plansRow: { gap: 16 },
  plansRowDesktop: { flexDirection: 'row', alignItems: 'stretch' },
  plansRowTablet: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  planItemTablet: { flexBasis: '48%', flexGrow: 1 },

  planCard: {
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    flex: 1,
    ...Colors.shadow.sm,
  },
  planCardPopular: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.primaryFaint,
    ...Colors.shadow.md,
  },
  popularRibbon: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, backgroundColor: Colors.primaryDark,
  },
  popularRibbonText: { fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: 0.1 },
  planCardBody: { padding: 22, gap: 10, flex: 1 },

  softBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    backgroundColor: Colors.borderLight,
  },
  softBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.2 },

  planName: { fontSize: 18, fontWeight: '800', color: Colors.text },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  planPrice: { fontSize: 30, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  planPriceMeta: { fontSize: 13, fontWeight: '700', color: Colors.textTertiary },
  planDesc: { fontSize: 13.5, color: Colors.textSecondary, lineHeight: 19, minHeight: 57 },

  planDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: 2 },

  planFormatsLabel: { fontSize: 10.5, fontWeight: '800', color: Colors.textTertiary, letterSpacing: 0.6, textTransform: 'uppercase' },
  formatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  formatTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999,
    backgroundColor: Colors.borderLight,
  },
  formatTagText: { fontSize: 11.5, fontWeight: '700', color: Colors.text },

  planReachRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  planReachText: { fontSize: 12.5, fontWeight: '600', color: Colors.textSecondary },

  planCtaSpacer: { flex: 1, minHeight: 6 },

  planBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 14,
    transition: 'background-color .18s ease, border-color .18s ease, box-shadow .18s ease, transform .18s ease',
  } as any,
  planBtnPopularHover: {
    transform: [{ translateY: -2 }],
    boxShadow: '0px 12px 26px rgba(21,128,61,0.38)',
  } as any,
  planBtnTinted: { backgroundColor: Colors.primaryFaint, borderWidth: 1.5, borderColor: Colors.primary },
  planBtnTintedHover: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryDark,
    transform: [{ translateY: -2 }],
    ...Colors.shadow.sm,
  } as any,
  planBtnTextLight: { fontSize: 14.5, fontWeight: '800', color: '#fff' },
  planBtnTextDark: { fontSize: 14.5, fontWeight: '800', color: Colors.primaryDark },
  planBtnTextDarkHover: { color: Colors.primaryDeep },
  planBtnIcon: {
    opacity: 0,
    transform: [{ translateX: -6 }],
    transition: 'opacity .18s ease, transform .18s ease',
  } as any,
  planBtnIconHover: { opacity: 1, transform: [{ translateX: 0 }] } as any,

  // ── Plano personalizado ──────────────────────────────────────
  customCardWrap: { alignSelf: 'center', maxWidth: '100%' },
  customCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    ...Colors.shadow.sm,
  },
  customIconBg: {
    width: 48, height: 48, borderRadius: 15,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  customTextCol: { flexShrink: 1, minWidth: 0, gap: 3 },
  customTitle: { fontSize: 16.5, fontWeight: '800', color: Colors.text },
  customSubtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  customCtaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.primary,
    transition: 'background-color .18s ease, border-color .18s ease, transform .18s ease, box-shadow .18s ease',
  } as any,
  customCtaPillHover: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
    transform: [{ translateY: -1 }],
    boxShadow: '0px 5px 12px rgba(22,163,74,0.22)',
  } as any,
  customCtaText: { fontSize: 13.5, fontWeight: '800', color: Colors.primaryDark },
  customCtaTextHover: { color: '#fff' },
  customCtaIcon: { transition: 'transform .18s ease' } as any,
  customCtaIconHover: { transform: [{ translateX: 2 }] },

  // ── Negociação direta ────────────────────────────────────────
  contactSection: {
    gap: 12,
    padding: 22,
    borderRadius: 20,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactHint: { fontSize: 13.5, color: Colors.textSecondary, lineHeight: 19, marginTop: -6 },
  contactRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  contactTileWrap: { flex: 1, minWidth: 220 },
  contactTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  contactIconBg: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  contactTextCol: { flex: 1, minWidth: 0, gap: 1 },
  contactTitleText: { fontSize: 12.5, fontWeight: '700', color: Colors.textTertiary },
  contactValueText: { fontSize: 13.5, fontWeight: '700', color: Colors.text },
});
