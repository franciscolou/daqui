import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { Colors } from '../constants/Colors';
import { CATEGORIES, PostCategory } from '../data/mock';
import { useAuth } from '../lib/auth';

interface Props {
  activeCategory?: string;
  onCategoryChange?: (key: string) => void;
}

const NAV_ITEMS = [
  { key: 'index',     route: '/(tabs)',             label: 'Início',     icon: 'home-outline'         as const, iconActive: 'home'         as const },
  { key: 'mapa',      route: '/(tabs)/mapa',        label: 'Mapa',       icon: 'map-outline'          as const, iconActive: 'map'          as const },
  { key: 'mensagens', route: '/(tabs)/mensagens',   label: 'Mensagens',  icon: 'chatbubbles-outline'  as const, iconActive: 'chatbubbles'  as const },
  { key: 'perfil',    route: '/(tabs)/perfil',      label: 'Perfil',     icon: 'person-outline'       as const, iconActive: 'person'       as const },
];

const PEOPLE_ITEMS = [
  { key: 'vizinhos',  label: 'Vizinhos',   icon: 'people-outline'     as const },
  { key: 'grupos',    label: 'Grupos',     icon: 'grid-outline'       as const },
  { key: 'comercios', label: 'Comércios',  icon: 'storefront-outline' as const },
];

export default function LeftSidebar({ activeCategory, onCategoryChange }: Props) {
  const pathname = usePathname();
  const { user } = useAuth();

  const isTabActive = (key: string) =>
    key === 'index' ? pathname === '/' : pathname === `/${key}`;

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
      <TouchableOpacity style={styles.userRow} onPress={() => router.push('/(tabs)/perfil')}>
        <Image source={{ uri: user?.avatar }} style={styles.userAvatar} />
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{user?.name?.split(' ')[0]}</Text>
          <View style={styles.userNeighborhood}>
            <Ionicons name="location-outline" size={11} color={Colors.primary} />
            <Text style={styles.userNeighborhoodText}>{user?.neighborhood}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Publish button */}
      <TouchableOpacity
        style={styles.publishBtn}
        onPress={() => router.push('/(tabs)/publicar')}
        activeOpacity={0.85}
      >
        <LinearGradient colors={Colors.gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.publishBtnGrad}>
          <Ionicons name="add" size={17} color="#fff" />
          <Text style={styles.publishBtnText}>Nova publicação</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Main navigation */}
      <View style={styles.group}>
        {NAV_ITEMS.map((item) => {
          const isActive = isTabActive(item.key);
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? item.iconActive : item.icon}
                size={18}
                color={isActive ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Categories — only shown on feed */}
      {onCategoryChange && (
        <>
          <View style={styles.divider} />
          <Text style={styles.groupTitle}>Categorias</Text>
          <View style={styles.group}>
            {CATEGORIES.filter((c) => c.key !== 'todos').map((cat) => {
              const isActive = activeCategory === cat.key;
              const color = Colors.category[cat.key as PostCategory] ?? Colors.primary;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => onCategoryChange(cat.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.catDot, { backgroundColor: isActive ? color : color + '40' }]} />
                  <Text style={[styles.navLabel, isActive && { color: Colors.text, fontWeight: '600' }]}>
                    {cat.label}
                  </Text>
                  {isActive && <View style={[styles.activeIndicator, { backgroundColor: color }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.divider} />

      {/* People */}
      <Text style={styles.groupTitle}>Pessoas</Text>
      <View style={styles.group}>
        {PEOPLE_ITEMS.map((item) => (
          <TouchableOpacity key={item.key} style={styles.navItem} activeOpacity={0.7}>
            <Ionicons name={item.icon} size={17} color={Colors.textSecondary} />
            <Text style={styles.navLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Sobre · Privacidade · Termos</Text>
        <Text style={styles.footerVersion}>Daqui © 2025</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
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
