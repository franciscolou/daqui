import { View, Text, StyleSheet, TouchableOpacity, Pressable, Image, Switch, useWindowDimensions } from 'react-native';
import { useEffect, useState } from 'react';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { Palette } from '../constants/Colors';
import { BRAND_FONT } from '../constants/BrandFont';
import { CATEGORIES, PostCategory } from '../data/mock';
import { adsApi } from '../lib/adsApi';
import { useAuth } from '../lib/auth';
import { useRealtime } from '../lib/realtime';
import { useScrollToTop } from '../lib/scrollToTop';
import { useTheme, useThemedStyles, useThemeMode } from '../lib/theme';
import RateModal from './RateModal';

const WIDE = 900;

interface Props {
  activeCategory?: string;
  onCategoryChange?: (key: string) => void;
  importantOnly?: boolean;
  onImportantChange?: (value: boolean) => void;
  // Redondezas: liga/desliga a inclusão de bairros vizinhos na visualização
  // ativa do feed. Reflete a preferência da aba atual ("Meu bairro"/"Perto de mim").
  includeNearby?: boolean;
  onIncludeNearbyChange?: (value: boolean) => void;
  onNavigate?: () => void; // chamado ao tocar em um item (ex.: fechar o drawer no mobile)
}

const NAV_ITEMS = [
  { key: 'index',     route: '/(tabs)',             label: 'Início',     icon: 'home-outline'         as const, iconActive: 'home'         as const },
  { key: 'search',     route: '/search',              label: 'Buscar',     icon: 'search-outline'       as const, iconActive: 'search'       as const },
  { key: 'notifications', route: '/(tabs)/notifications', label: 'Novidades',  icon: 'notifications-outline' as const, iconActive: 'notifications' as const },
  { key: 'map',      route: '/(tabs)/map',        label: 'Mapa',       icon: 'map-outline'          as const, iconActive: 'map'          as const },
  { key: 'messages', route: '/(tabs)/messages',   label: 'Mensagens',  icon: 'chatbubbles-outline'  as const, iconActive: 'chatbubbles'  as const },
  { key: 'profile',    route: '/(tabs)/profile',      label: 'Perfil',     icon: 'person-outline'       as const, iconActive: 'person'       as const },
  { key: 'settings', route: '/settings',  label: 'Configurações', icon: 'settings-outline'  as const, iconActive: 'settings'     as const },
];

const PEOPLE_ITEMS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
}[] = [
  { key: 'neighbors', label: 'Vizinhos', icon: 'people-outline', route: '/neighbors' },
  { key: 'groups', label: 'Grupos', icon: 'grid-outline', route: '/groups' },
];

const APP_ITEMS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
}[] = [
  { key: 'rate', label: 'Avaliar o Daqui', icon: 'star-outline' },
  { key: 'help',   label: 'Ajuda e suporte', icon: 'help-circle-outline', route: '/help' },
  { key: 'ads',    label: 'Anuncie conosco', icon: 'megaphone-outline', route: '/anunciar' },
  { key: 'terms',  label: 'Termos de uso',   icon: 'document-text-outline' },
];

export default function LeftSidebar({
  activeCategory,
  onCategoryChange,
  importantOnly,
  onImportantChange,
  includeNearby,
  onIncludeNearbyChange,
  onNavigate,
}: Props) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { unreadMessages, unreadNotifications } = useRealtime();
  const { trigger } = useScrollToTop();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { mode, toggle } = useThemeMode();
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  // "Anuncie conosco" vira "Meus anúncios" (e leva pro dashboard comparativo
  // em vez da tela de planos) assim que o usuário já teve alguma campanha —
  // checado 1x por sessão pelo e-mail do próprio usuário logado.
  const [hasMyAds, setHasMyAds] = useState(false);
  useEffect(() => {
    if (!user?.email) return;
    adsApi.hasMyCampaigns(user.email).then(setHasMyAds).catch(() => {});
  }, [user?.email]);

  // Colapso fluido das categorias: anima altura (medida) + opacidade da lista extra
  // e a rotação da setinha. Usamos shared values explícitos (padrão do welcome.tsx),
  // que funcionam bem na web — não entering/exiting.
  const progress = useSharedValue(0); // 0 = colapsado, 1 = expandido
  const contentHeight = useSharedValue(0);

  const toggleCategories = () => {
    const next = !categoriesExpanded;
    setCategoriesExpanded(next);
    progress.value = withTiming(next ? 1 : 0, {
      duration: 280,
      easing: Easing.inOut(Easing.cubic),
    });
  };

  const extraCatsStyle = useAnimatedStyle(() => ({
    height: contentHeight.value * progress.value,
    opacity: progress.value,
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  const renderCategory = (cat: (typeof CATEGORIES)[number]) => {
    const isActive = activeCategory === cat.key;
    const color = Colors.category[cat.key as PostCategory] ?? Colors.primary;
    return (
      <Pressable
        key={cat.key}
        style={({ hovered }) => [styles.navItem, isActive && styles.navItemActive, !isActive && hovered && styles.navItemHover]}
        onPress={() => { onCategoryChange?.(cat.key); onNavigate?.(); }}
      >
        <View style={[styles.catDot, { backgroundColor: isActive ? color : color + '40' }]} />
        <Text style={[styles.navLabel, isActive && { color: Colors.text, fontWeight: '600' }]}>
          {cat.label}
        </Text>
        {isActive && <View style={[styles.activeIndicator, { backgroundColor: color }]} />}
      </Pressable>
    );
  };

  const isTabActive = (key: string) =>
    key === 'index' ? pathname === '/' : pathname === `/${key}`;

  const navigate = (route: string) => {
    router.push(route as any);
    onNavigate?.();
  };

  const handleLogout = async () => {
    onNavigate?.();
    await logout();
    router.replace('/(auth)/welcome');
  };

  return (
    <View style={styles.sidebar}>
      {/* Brand */}
      <View style={styles.brand}>
        <LinearGradient colors={Colors.gradient.primary} style={styles.brandIcon}>
          <Ionicons name="location" size={18} color="#fff" />
        </LinearGradient>
        <Text style={styles.brandName}>daqui</Text>
      </View>

      {/* User info */}
      <Pressable
        style={({ hovered }) => [styles.userRow, hovered && styles.userRowHover]}
        onPress={() => navigate('/(tabs)/profile')}
      >
        <Image source={{ uri: user?.avatar }} style={styles.userAvatar} />
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{user?.name?.split(' ')[0]}</Text>
          <View style={styles.userNeighborhood}>
            <Ionicons name="location-outline" size={11} color={Colors.primary} />
            <Text style={styles.userNeighborhoodText}>{user?.neighborhood}</Text>
          </View>
        </View>
      </Pressable>

      {/* Publish button */}
      <TouchableOpacity
        style={styles.publishBtn}
        onPress={() => navigate('/(tabs)/publish')}
        activeOpacity={0.85}
      >
        <LinearGradient colors={Colors.gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.publishBtnGrad}>
          <Ionicons name="add" size={17} color="#fff" />
          <Text style={styles.publishBtnText}>Novo post</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Main navigation */}
      <View style={styles.group}>
        {NAV_ITEMS.map((item) => {
          const isActive = isTabActive(item.key);
          const showDot =
            (item.key === 'messages' && unreadMessages > 0) ||
            (item.key === 'notifications' && unreadNotifications > 0);
          return (
            <Pressable
              key={item.key}
              style={({ hovered }) => [styles.navItem, isActive && styles.navItemActive, !isActive && hovered && styles.navItemHover]}
              onPress={() => (isActive ? trigger(item.key) : navigate(item.route))}
            >
              <View style={styles.navIconWrapper}>
                <Ionicons
                  name={isActive ? item.iconActive : item.icon}
                  size={18}
                  color={isActive ? Colors.primary : Colors.textSecondary}
                />
                {showDot && <View style={styles.navDot} />}
              </View>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Categories — only shown on feed */}
      {onCategoryChange && (
        <>
          <View style={styles.divider} />

          <Pressable
            style={({ hovered }) => [styles.categoriesHeader, hovered && styles.navItemHover]}
            onPress={toggleCategories}
          >
            <Text style={styles.groupTitle}>Categorias</Text>
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-down" size={14} color={Colors.textTertiary} />
            </Animated.View>
          </Pressable>
          <View style={styles.group}>
            {/* "Todas": remove o filtro e mostra todas as publicações de uma vez */}
            <Pressable
              style={({ hovered }) => [
                styles.navItem,
                activeCategory === 'todos' && styles.navItemActive,
                activeCategory !== 'todos' && hovered && styles.navItemHover,
              ]}
              onPress={() => { onCategoryChange('todos'); onNavigate?.(); }}
            >
              <Ionicons
                name="apps"
                size={14}
                color={activeCategory === 'todos' ? Colors.primary : Colors.textTertiary}
                style={styles.catAllIcon}
              />
              <Text style={[styles.navLabel, activeCategory === 'todos' && { color: Colors.text, fontWeight: '600' }]}>
                Todas
              </Text>
              {activeCategory === 'todos' && (
                <View style={[styles.activeIndicator, { backgroundColor: Colors.primary }]} />
              )}
            </Pressable>
            {/* "Geral" fica sempre visível; o resto entra na lista colapsável */}
            {renderCategory(CATEGORIES.find((c) => c.key === 'geral')!)}
            <Animated.View style={[styles.extraCats, extraCatsStyle]}>
              <View
                style={styles.extraCatsInner}
                onLayout={(e) => { contentHeight.value = e.nativeEvent.layout.height; }}
              >
                {CATEGORIES.filter((c) => c.key !== 'todos' && c.key !== 'geral').map(renderCategory)}
              </View>
            </Animated.View>
            <Pressable
              style={styles.importantRow}
              onPress={() => onImportantChange?.(!importantOnly)}
              tabIndex={-1}
            >
              <View style={[styles.checkbox, importantOnly && styles.checkboxChecked]}>
                {importantOnly && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.importantLabel}>Somente importantes</Text>
            </Pressable>
            {/* Redondezas: aplica à visualização ativa do feed */}
            {onIncludeNearbyChange && (
              <View style={[styles.navItem, styles.nearbyRow]}>
                <Ionicons name="git-network-outline" size={17} color={Colors.textSecondary} />
                <Text style={styles.navLabel}>Incluir redondezas</Text>
                <Switch
                  value={!!includeNearby}
                  onValueChange={onIncludeNearbyChange}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            )}
          </View>
        </>
      )}

      <View style={styles.divider} />

      {/* People */}
      <Text style={styles.groupTitle}>Pessoas</Text>
      <View style={styles.group}>
        {PEOPLE_ITEMS.map((item) => (
          <Pressable
            key={item.key}
            style={({ hovered }) => [styles.navItem, hovered && styles.navItemHover]}
            onPress={() => (item.route ? navigate(item.route) : onNavigate?.())}
          >
            <Ionicons name={item.icon} size={17} color={Colors.textSecondary} />
            <Text style={styles.navLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.divider} />

      {/* App */}
      <Text style={styles.groupTitle}>Sobre</Text>
      <View style={styles.group}>
        {APP_ITEMS.map((item) => {
          const isAds = item.key === 'ads';
          const label = isAds ? (hasMyAds ? 'Meus anúncios' : item.label) : item.label;
          const route = isAds ? (hasMyAds ? '/anunciar/painel' : item.route) : item.route;
          const icon = isAds && hasMyAds ? 'stats-chart-outline' : item.icon;
          return (
            <Pressable
              key={item.key}
              style={({ hovered }) => [styles.navItem, hovered && styles.navItemHover]}
              onPress={() => {
                if (item.key === 'rate') {
                  // No desktop abre como modal; no mobile, o modal aninhado dentro do
                  // drawer do MobileMenu não funciona direito — vai para tela cheia.
                  if (isWide) {
                    setRateOpen(true);
                    onNavigate?.();
                  } else {
                    navigate('/rate');
                  }
                } else if (route) {
                  navigate(route);
                } else {
                  onNavigate?.();
                }
              }}
            >
              <Ionicons name={icon} size={17} color={Colors.textSecondary} />
              <Text style={styles.navLabel}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      {/* Appearance */}
      <Text style={styles.groupTitle}>Aparência</Text>
      <View style={[styles.navItem, styles.themeRow]}>
        <Ionicons name={mode === 'dark' ? 'moon' : 'moon-outline'} size={17} color={Colors.textSecondary} />
        <Text style={styles.navLabel}>Modo escuro</Text>
        <Switch
          value={mode === 'dark'}
          onValueChange={toggle}
          trackColor={{ false: Colors.border, true: Colors.primary }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.divider} />

      {/* Logout */}
      <Pressable
        style={({ hovered }) => [styles.navItem, hovered && styles.navItemHover]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={17} color={Colors.error} />
        <Text style={[styles.navLabel, styles.logoutLabel]}>Sair</Text>
      </Pressable>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Sobre · Privacidade · Termos</Text>
        <Text style={styles.footerVersion}>Daqui © 2025</Text>
      </View>

      {isWide && <RateModal visible={rateOpen} onClose={() => setRateOpen(false)} />}
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  themeRow: { justifyContent: 'space-between', paddingVertical: 4 },
  nearbyRow: { justifyContent: 'space-between', paddingVertical: 4 },
  sidebar: {
    width: 220,
    backgroundColor: Colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
    paddingTop: 20,
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1,
    fontFamily: BRAND_FONT,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  userRowHover: {
    backgroundColor: Colors.primaryLight,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 11,
  },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  userNeighborhood: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  userNeighborhoodText: { fontSize: 11, color: Colors.primary, fontWeight: '500' },

  publishBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  publishBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  publishBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  group: { gap: 1 },
  importantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  importantLabel: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  extraCats: { overflow: 'hidden' },
  extraCatsInner: { gap: 1, paddingTop: 1 },
  categoriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingRight: 8,
    borderRadius: 10,
  },
  groupTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    marginBottom: 4,
    marginTop: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: Colors.primaryFaint,
  },
  navItemHover: {
    backgroundColor: Colors.borderLight,
  },
  navLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  navLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  navIconWrapper: {
    position: 'relative',
  },
  navDot: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  logoutLabel: {
    color: Colors.error,
    fontWeight: '600',
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Ícone de "Todas" ocupando ~8px (como os pontos das categorias) p/ alinhar os rótulos.
  catAllIcon: { marginLeft: -3, marginRight: -3 },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 16,
    paddingHorizontal: 8,
  },
  footerText: { fontSize: 10, color: Colors.textTertiary, lineHeight: 16 },
  footerVersion: { fontSize: 10, color: Colors.textTertiary, marginTop: 2 },
});
