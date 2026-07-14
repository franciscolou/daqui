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
import { adsApi, AdPlan, AdPlanCategory } from '../../lib/adsApi';
import { AD_CONTACT_CHANNELS } from '../../constants/ads';

const FORMAT_LABEL: Record<string, string> = {
  post: 'Post + mapa',
  conversation: 'Conversa',
  notification: 'Novidades',
  search_poster: 'Busca',
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
    tagline: 'Alcance São Paulo inteira com força total',
    icon: 'business-outline',
    gradient: ['#6366F1', '#3B82F6'],
  },
];

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function FadeSlideIn({ delay, children, style }: { delay: number; children: React.ReactNode; style?: any }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 18 }],
  }));
  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}

function PressableScale({
  onPress, children, style, radius = 0,
}: { onPress: () => void; children: React.ReactNode; style?: any; radius?: number }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Sem borderRadius/overflow aqui, o hover/foco do RN Web desenha um
  // retângulo por cima do card arredondado — o clip precisa estar no
  // próprio elemento pressionável, não só no filho visual.
  const clipStyle = { borderRadius: radius, overflow: 'hidden' as const };
  return (
    <Animated.View style={[clipStyle, animStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 16, stiffness: 220 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 200 }); }}
        style={[clipStyle, { outlineStyle: 'none' } as any, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function AnunciarScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

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
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Anuncie no Daqui</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <FadeSlideIn delay={0}>
            <LinearGradient colors={['#16A34A', '#22C55E', '#4ADE80']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.heroGlow1} />
              <View style={styles.heroGlow2} />
              <Ionicons name="megaphone" size={30} color="#fff" style={{ marginBottom: 10 }} />
              <Text style={styles.heroTitle}>Sua marca na vida do bairro</Text>
              <Text style={styles.heroSubtitle}>
                Post no feed com pin no mapa, conversa nas Mensagens, novidade e poster na Busca — tudo segmentado por bairro.
              </Text>
            </LinearGradient>
          </FadeSlideIn>

          <FadeSlideIn delay={80}>
            <Text style={styles.sectionTitle}>Escolha o seu perfil</Text>
          </FadeSlideIn>

          <FadeSlideIn delay={120}>
            <View style={[styles.categoryRow, isWide && styles.categoryRowWide]}>
              {CATEGORIES.map((cat) => {
                const active = cat.key === activeCategory;
                return (
                  <PressableScale key={cat.key} onPress={() => setActiveCategory(cat.key)} style={{ flex: isWide ? 1 : undefined }} radius={18}>
                    <View style={[styles.categoryCard, active && styles.categoryCardActive]}>
                      {active ? (
                        <LinearGradient colors={cat.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.categoryIconBg}>
                          <Ionicons name={cat.icon} size={20} color="#fff" />
                        </LinearGradient>
                      ) : (
                        <View style={[styles.categoryIconBg, { backgroundColor: Colors.borderLight }]}>
                          <Ionicons name={cat.icon} size={20} color={Colors.textSecondary} />
                        </View>
                      )}
                      <Text style={[styles.categoryLabel, active && { color: Colors.text }]} numberOfLines={1}>{cat.label}</Text>
                      {active && <Text style={styles.categoryTagline} numberOfLines={2}>{cat.tagline}</Text>}
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </FadeSlideIn>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
          ) : (
            <View key={activeCategory} style={[styles.plansRow, isWide && styles.plansRowWide]}>
              {activePlans.map((plan, i) => {
                const popular = plan.badge === 'Mais popular';
                return (
                  <FadeSlideIn key={plan.id} delay={80 * i} style={{ flex: isWide ? 1 : undefined }}>
                    <View style={[styles.planCard, popular && styles.planCardPopular, isWide && styles.planCardWide]}>
                      {plan.badge && popular && (
                        <LinearGradient colors={activeMeta.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.planBadge}>
                          <Ionicons name="star" size={11} color="#fff" />
                          <Text style={styles.planBadgeText}>{plan.badge}</Text>
                        </LinearGradient>
                      )}
                      {plan.badge && !popular && (
                        <View style={styles.planBadgeSoft}>
                          <Ionicons name="sparkles" size={11} color={Colors.textSecondary} />
                          <Text style={styles.planBadgeSoftText}>{plan.badge}</Text>
                        </View>
                      )}
                      <Text style={styles.planName}>{plan.name}</Text>
                      <View style={styles.planPriceRow}>
                        <Text style={styles.planPrice}>{formatMoney(plan.priceCents)}</Text>
                        <Text style={styles.planPriceMeta}>/ {plan.durationDays} dias</Text>
                      </View>
                      <Text style={styles.planDesc}>{plan.description}</Text>
                      <View style={styles.formatsRow}>
                        {plan.formats.map((f) => (
                          <View key={f} style={styles.formatTag}>
                            <Text style={styles.formatTagText}>{FORMAT_LABEL[f] || f}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.planMeta}>
                        <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />{' '}
                        {plan.maxNeighborhoods ? `até ${plan.maxNeighborhoods} bairro(s)` : 'cidade toda'}
                      </Text>
                      <PressableScale
                        onPress={() => router.push({ pathname: '/anunciar/personalizar', params: { planId: String(plan.id) } })}
                        radius={13}
                      >
                        {popular ? (
                          <LinearGradient colors={activeMeta.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.planBtn}>
                            <Text style={styles.planBtnTextLight}>Contratar este plano</Text>
                          </LinearGradient>
                        ) : (
                          <View style={[styles.planBtn, styles.planBtnOutline]}>
                            <Text style={styles.planBtnTextDark}>Contratar este plano</Text>
                          </View>
                        )}
                      </PressableScale>
                    </View>
                  </FadeSlideIn>
                );
              })}
            </View>
          )}

          <TouchableOpacity style={styles.customBtn} activeOpacity={0.85} onPress={() => router.push('/anunciar/personalizar')}>
            <Ionicons name="options-outline" size={18} color={Colors.primary} />
            <Text style={styles.customBtnText}>Ou monte seu próprio plano</Text>
          </TouchableOpacity>

          <View style={styles.contactSection}>
            <Text style={styles.sectionTitle}>Prefere negociar direto?</Text>
            <Text style={styles.contactHint}>Fale com o responsável pelos anúncios e a gente monta uma proposta sob medida.</Text>
            <View style={styles.contactRow}>
              {AD_CONTACT_CHANNELS.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={styles.contactBtn}
                  activeOpacity={0.85}
                  onPress={() => Linking.openURL(c.url)}
                >
                  <Ionicons name={c.icon as any} size={20} color={Colors.primary} />
                  <Text style={styles.contactBtnText} numberOfLines={1}>{c.label}</Text>
                </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  iconBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: Colors.text },
  scrollBody: { padding: 16, paddingBottom: 48 },
  body: { gap: 16, maxWidth: 880, width: '100%', alignSelf: 'center' },

  hero: {
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    overflow: 'hidden',
    ...Colors.shadow.lg,
  },
  heroGlow1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.14)', top: -50, right: -40 },
  heroGlow2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.10)', bottom: -40, left: -30 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.92)', textAlign: 'center', marginTop: 8, lineHeight: 19, maxWidth: 420 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginTop: 4 },

  categoryRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  categoryRowWide: { flexWrap: 'nowrap' },
  categoryCard: {
    minWidth: 150,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  categoryCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaint },
  categoryIconBg: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { fontSize: 14, fontWeight: '800', color: Colors.textSecondary },
  categoryTagline: { fontSize: 11, color: Colors.textTertiary, lineHeight: 15 },

  plansRow: { gap: 14 },
  plansRowWide: { flexDirection: 'row', alignItems: 'stretch' },
  planCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    ...Colors.shadow.sm,
  },
  planCardWide: { flex: 1 },
  planCardPopular: { borderColor: Colors.primary, borderWidth: 2, ...Colors.shadow.md },
  planBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    ...Colors.shadow.sm,
  },
  planBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  planBadgeSoft: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.borderLight,
  },
  planBadgeSoftText: { fontSize: 10.5, fontWeight: '700', color: Colors.textSecondary },
  planName: { fontSize: 16, fontWeight: '800', color: Colors.text, marginTop: 4 },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  planPrice: { fontSize: 22, fontWeight: '800', color: Colors.text },
  planPriceMeta: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary },
  planDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, minHeight: 57 },
  formatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  formatTag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: Colors.borderLight },
  formatTagText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  planMeta: { fontSize: 12, color: Colors.textTertiary },
  planBtn: { borderRadius: 13, paddingVertical: 12, alignItems: 'center' },
  planBtnOutline: { borderWidth: 1.5, borderColor: Colors.primary },
  planBtnTextLight: { fontSize: 14, fontWeight: '800', color: '#fff' },
  planBtnTextDark: { fontSize: 14, fontWeight: '800', color: Colors.primary },

  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  customBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  contactSection: { marginTop: 6, gap: 8 },
  contactHint: { fontSize: 13, color: Colors.textTertiary, lineHeight: 19 },
  contactRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  contactBtn: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  contactBtnText: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.text },
});
