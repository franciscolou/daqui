import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemedStyles } from '../../lib/theme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// Ordem da barra inferior (mobile), da esquerda para a direita.
// 'perfil' fica de fora de propósito — é acessível pelo avatar/menu.
const TAB_ITEMS = [
  { name: 'index', label: 'Início', icon: 'home-outline', iconActive: 'home' },
  { name: 'busca', label: 'Buscar', icon: 'search-outline', iconActive: 'search' },
  { name: 'publish', label: '', icon: 'add', iconActive: 'add' },
  { name: 'mapa', label: 'Mapa', icon: 'map-outline', iconActive: 'map' },
  { name: 'mensagens', label: 'Mensagens', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

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
    if (activeName !== name && !event.defaultPrevented) {
      navigation.navigate(name);
    }
  };

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom || 16 }]}>
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

          return (
            <TouchableOpacity
              key={tabItem.name}
              onPress={() => go(tabItem.name)}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <View style={[styles.tabIconWrapper, isFocused && styles.tabIconWrapperActive]}>
                <Ionicons
                  name={(isFocused ? tabItem.iconActive : tabItem.icon) as any}
                  size={22}
                  color={isFocused ? Colors.primary : Colors.textTertiary}
                />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {tabItem.label}
              </Text>
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
      <Tabs.Screen name="busca" />
      <Tabs.Screen name="publish" />
      <Tabs.Screen name="mapa" />
      <Tabs.Screen name="mensagens" />
      <Tabs.Screen name="perfil" options={{ href: null }} />
    </Tabs>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  tabBarContainer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
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
    gap: 3,
  },
  tabIconWrapper: {
    width: 40,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapperActive: {
    backgroundColor: Colors.primaryFaint,
  },
  tabLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
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
    marginBottom: 4,
    ...Colors.shadow.md,
  },
});
