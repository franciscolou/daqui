import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Image,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { CATEGORIES, PostCategory, Post } from '../../data/mock';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import PostCard from '../../components/PostCard';
import LeftSidebar from '../../components/LeftSidebar';
import RightSidebar from '../../components/RightSidebar';
import MobileMenu from '../../components/MobileMenu';

type FilterKey = 'todos' | PostCategory;

const WIDE = 900;

export default function FeedScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [activeCategory, setActiveCategory] = useState<FilterKey>('todos');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const feed = await api.getFeed();
      setPosts(feed);
    } catch {
      setError('Não foi possível carregar o feed.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarrega ao focar a tela (reflete novos posts, curtidas e comentários)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filteredPosts = posts.filter(
    (p) => activeCategory === 'todos' || p.category === activeCategory,
  );

  const feedHeader = (
    <>
      {/* Compose box */}
      <View style={styles.composeBox}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
          <Image source={{ uri: user?.avatar }} style={styles.composeAvatar} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.composeFakeInput}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/publish')}
        >
          <Text style={styles.composePlaceholder}>
            Postar uma mensagem, evento, enquete ou aviso importante
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.composeDivider} />

      {/* Category filter tabs */}
      {!isWide && (
        <View style={styles.mobileTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileTabsRow}>
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key;
              const color = cat.key === 'todos' ? Colors.primary : (Colors.category[cat.key as PostCategory] ?? Colors.primary);
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.mobileTab, isActive && { borderBottomColor: color }]}
                  onPress={() => setActiveCategory(cat.key as FilterKey)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={cat.icon as any} size={12} color={isActive ? color : Colors.textTertiary} />
                  <Text style={[styles.mobileTabText, isActive && { color, fontWeight: '700' }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={styles.hairline} />
    </>
  );

  const feed = (
    <FlatList
      data={filteredPosts}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={feedHeader}
      renderItem={({ item }) => <PostCard post={item} />}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
      ListEmptyComponent={
        loading ? (
          <View style={styles.feedState}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <View style={styles.feedState}>
            <Ionicons
              name={error ? 'cloud-offline-outline' : 'newspaper-outline'}
              size={32}
              color={Colors.textTertiary}
            />
            <Text style={styles.feedStateText}>
              {error ?? 'Nenhum post por aqui ainda.'}
            </Text>
            {error && (
              <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
                <Text style={styles.retryText}>Tentar novamente</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      }
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ─── Body: 3-column on wide, 1-column on mobile ─── */}
      {isWide ? (
        <View style={[styles.wideBody, { paddingHorizontal: Math.max(0, (width - 1140) / 2) }]}>
          {/* Left sidebar — sticky */}
          <ScrollView style={styles.leftCol} showsVerticalScrollIndicator={false}>
            <LeftSidebar
              activeCategory={activeCategory}
              onCategoryChange={(k) => setActiveCategory(k as FilterKey)}
            />
          </ScrollView>

          {/* Center feed */}
          <View style={styles.centerCol}>
            {feed}
          </View>

          {/* Right sidebar */}
          <ScrollView style={styles.rightCol} showsVerticalScrollIndicator={false}>
            <RightSidebar />
          </ScrollView>
        </View>
      ) : (
        <View style={styles.mobileBody}>
          {feed}
        </View>
      )}
      {!isWide && <MobileMenu />}
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* ── Wide 3-col layout ── */
  wideBody: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  leftCol: {
    width: 220,
    flexShrink: 0,
    backgroundColor: Colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  centerCol: {
    width: 640,
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: Colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  rightCol: {
    width: 280,
    flexShrink: 0,
    backgroundColor: Colors.background,
  },

  /* ── Mobile layout ── */
  mobileBody: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  /* ── Feed header pieces ── */
  composeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
  },
  composeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  composeFakeInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  composePlaceholder: {
    fontSize: 13,
    color: Colors.textTertiary,
    lineHeight: 17,
  },
  composeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  mobileTabs: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  mobileTabsRow: {
    paddingHorizontal: 8,
    flexDirection: 'row',
  },
  mobileTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  mobileTabText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  listContent: { paddingBottom: 24 },
  feedState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
    gap: 10,
  },
  feedStateText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: Colors.primaryFaint,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
