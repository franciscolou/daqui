import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../../constants/Colors';
import { DESKTOP_BREAKPOINT as WIDE } from '../../constants/config';
import { Post, postListKey } from '../../data/mock';
import { api } from '../../lib/api';
import { Ad, adsApi } from '../../lib/adsApi';
import { useAuth } from '../../lib/auth';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import FeedLayout from '../../components/FeedLayout';
import PostCard from '../../components/PostCard';
import AdPostCard from '../../components/AdPostCard';
import ProfileHeader from '../../components/ProfileHeader';
import MobileMenu from '../../components/MobileMenu';
import { useRegisterScrollToTop } from '../../lib/scrollToTop';
import { useT } from '../../lib/i18n';

const normalizeSearch = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export default function ProfileScreen() {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  // Posts de campanhas de anúncio expiradas vinculadas à própria conta —
  // deixam de ser impulsionadas e "assentam" na timeline como post normal.
  const [linkedAds, setLinkedAds] = useState<Ad[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useRegisterScrollToTop('profile', () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  });

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api.getUserPosts(user.id).then(setMyPosts).catch(() => setMyPosts([]));
      adsApi.getLinkedPosts(user.id, user.id).then(setLinkedAds).catch(() => setLinkedAds([]));
    }, [user]),
  );

  const handlePostDeleted = useCallback((postId: string) => {
    setMyPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const timelineItems = useMemo(() => {
    const items: { key: string; date: string; searchText: string; node: React.ReactNode }[] = [
      ...myPosts.map((post) => ({
        key: postListKey(post),
        date: post.createdAt,
        searchText: [post.title, post.content, post.location, post.category].filter(Boolean).join(' '),
        node: <PostCard key={postListKey(post)} post={post} onDeleted={handlePostDeleted} />,
      })),
      ...linkedAds.map((ad) => ({
        key: `ad-${ad.id}`,
        date: ad.createdAt ?? '',
        searchText: [ad.title, ad.content].filter(Boolean).join(' '),
        node: (
          <AdPostCard
            key={`ad-${ad.id}`}
            ad={ad}
            viewerId={user?.id}
            viewerUserId={user?.id}
            sponsored={false}
          />
        ),
      })),
    ];
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [myPosts, linkedAds, user?.id, handlePostDeleted]);

  const visibleTimelineItems = useMemo(() => {
    const query = normalizeSearch(searchQuery);
    if (!query) return timelineItems;
    return timelineItems.filter((item) => normalizeSearch(item.searchText).includes(query));
  }, [timelineItems, searchQuery]);

  if (!user) return null;

  const content = (
    <>
      <ProfileHeader
        user={user}
        isWide={isWide}
        onSearchChange={setSearchQuery}
        actions={
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/settings' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="settings-outline" size={16} color={Colors.text} />
            <Text style={styles.editBtnText}>{t('profile.edit')}</Text>
          </TouchableOpacity>
        }
      />

      {/* My posts — timeline */}
      <View style={styles.timelineSection}>
        <Text style={styles.timelineTitle}>{t('profile.myPosts')}</Text>
        {visibleTimelineItems.length === 0 ? (
          <View style={styles.noPosts}>
            <Ionicons
              name={searchQuery ? 'search-outline' : 'document-text-outline'}
              size={32}
              color={Colors.textTertiary}
            />
            <Text style={styles.noPostsText}>
              {searchQuery ? t('profile.noSearchResults') : t('profile.noOwnPosts')}
            </Text>
          </View>
        ) : (
          visibleTimelineItems.map((item) => item.node)
        )}
      </View>

      <Text style={styles.version}>Daqui v1.0.0</Text>
      <View style={{ height: 20 }} />
    </>
  );

  return (
    <FeedLayout showMobileMenu={false}>
      {!isWide && (
        <View style={styles.mobileHeader}>
          <TouchableOpacity
            style={styles.mobileHeaderButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <MobileMenu inline />
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    </FeedLayout>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  mobileHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  mobileHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow.sm,
  },
  editBtnText: { color: Colors.text, fontWeight: '700', fontSize: 15 },

  /* ── Posts timeline ── */
  timelineSection: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  timelineTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  noPosts: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  noPostsText: { fontSize: 14, color: Colors.textTertiary },

  /* ── Footer ── */
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 14,
  },
});
