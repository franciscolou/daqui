import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TAB_ITEMS = [
  { name: 'index', label: 'Início', icon: 'home', iconActive: 'home' },
  { name: 'mapa', label: 'Mapa', icon: 'map-outline', iconActive: 'map' },
  { name: 'publicar', label: '', icon: 'add', iconActive: 'add' },
  { name: 'mensagens', label: 'Mensagens', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { name: 'perfil', label: 'Perfil', icon: 'person-outline', iconActive: 'person' },
];

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom || 16 }]}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const tabItem = TAB_ITEMS[index];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (tabItem.name === 'publicar') {
            return (
              <TouchableOpacity key={route.key} onPress={onPress} style={styles.publishBtnWrapper} activeOpacity={0.85}>
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
              key={route.key}
              onPress={onPress}
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
      <Tabs.Screen name="mapa" />
      <Tabs.Screen name="publicar" />
      <Tabs.Screen name="mensagens" />
      <Tabs.Screen name="perfil" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
