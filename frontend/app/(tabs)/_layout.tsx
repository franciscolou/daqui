import { Tabs } from 'expo-router';
import { View, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette } from '../../constants/Colors';
import { useRealtime } from '../../lib/realtime';
import { useScrollToTop } from '../../lib/scrollToTop';
import { useTheme, useThemedStyles } from '../../lib/theme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// Ordem da barra inferior (mobile), da esquerda para a direita.
// 'perfil' fica de fora de propósito — é acessível pelo avatar/menu.
// 'mapa' também fica de fora — acessível pela barra lateral/menu — para abrir
// espaço para as notificações aqui embaixo.
const TAB_ITEMS = [
  { name: 'index', label: 'Início', icon: 'home-outline', iconActive: 'home' },
  { name: 'search', label: 'Buscar', icon: 'search-outline', iconActive: 'search' },
  { name: 'publish', label: '', icon: 'add', iconActive: 'add' },
  { name: 'notifications', label: 'Novidades', icon: 'notifications-outline', iconActive: 'notifications' },
  { name: 'messages', label: 'Mensagens', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { unreadMessages, unreadNotifications } = useRealtime();
  const { trigger } = useScrollToTop();

  if (width >= 900) return null;

  const activeName = state.routes[state.index]?.name;

  const go = (name: string) => {
    const route = state.routes.find((r: { name: string; key: string }) => r.name === name);
    if (!route) return;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (event.defaultPrevented) return;
    if (activeName !== name) {
      navigation.navigate(name);
    } else {
      trigger(name);
    }
  };

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: 10 + insets.bottom }]}>
      <View style={styles.tabBar}>
        {TAB_ITEMS.map((tabItem) => {
          const isFocused = activeName === tabItem.name;

          if (tabItem.name === 'publish') {
            return (
              <TouchableOpacity key={tabItem.name} onPress={() => go('publish')} style={styles.publishBtnWrapper} activeOpacity={0.85}>
                <LinearGradient
                  colors={Colors.gradient.primary}
                  style={styles.publishBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="add" size={28} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            );
          }

          const showDot =
            (tabItem.name === 'messages' && unreadMessages > 0) ||
            (tabItem.name === 'notifications' && unreadNotifications > 0);

          return (
            <TouchableOpacity
              key={tabItem.name}
              onPress={() => go(tabItem.name)}
              style={styles.tabItem}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={tabItem.label}
            >
              <View style={[styles.tabIconWrapper, isFocused && styles.tabIconWrapperActive]}>
                <Ionicons
                  name={(isFocused ? tabItem.iconActive : tabItem.icon) as any}
                  size={24}
                  color={isFocused ? Colors.primary : Colors.textTertiary}
                />
                {showDot && <View style={styles.tabDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="publish" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="map" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  tabBarContainer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    ...Colors.shadow.lg,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabIconWrapper: {
    width: 44,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabIconWrapperActive: {
    backgroundColor: Colors.primaryFaint,
  },
  tabDot: {
    position: 'absolute',
    top: 4,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  publishBtnWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtn: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Colors.shadow.md,
  },
});
