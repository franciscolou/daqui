import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { DESKTOP_BREAKPOINT } from '../../constants/config';
import { Post, User, postListKey } from '../../data/mock';
import { api } from '../../lib/api';
import { Ad, adsApi } from '../../lib/adsApi';
import { useAuth } from '../../lib/auth';
import { goBack } from '../../lib/navigation';
import { useTheme, useThemedStyles } from '../../lib/theme';
import PostCard from '../../components/PostCard';
import AdPostCard from '../../components/AdPostCard';
import FeedLayout from '../../components/FeedLayout';
import ProfileHeader from '../../components/ProfileHeader';
import ActionMenu from '../../components/ActionMenu';
import ReportModal from '../../components/ReportModal';
import { useT } from '../../lib/i18n';

const normalizeSearch = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export default function UserScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= DESKTOP_BREAKPOINT;
  const { user: me } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [user, setUser] = useState<User | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  // Posts de campanhas de anúncio expiradas vinculadas a esta conta — depois
  // de expirar, deixam de ser impulsionadas e "assentam" na timeline como
  // post normal (ver AdPostCard `sponsored={false}` abaixo).
  const [linkedAds, setLinkedAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isMe = !!me && me.id === id;

  const handlePostDeleted = useCallback((postId: string) => {
    setUserPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const timelineItems = useMemo(() => {
    const items: { key: string; date: string; searchText: string; node: React.ReactNode }[] = [
      ...userPosts.map((post) => ({
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
            viewerId={me?.id}
            viewerUserId={me?.id}
            sponsored={false}
          />
        ),
      })),
    ];
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [userPosts, linkedAds, me?.id, handlePostDeleted]);

  const visibleTimelineItems = useMemo(() => {
    const query = normalizeSearch(searchQuery);
    if (!query) return timelineItems;
    return timelineItems.filter((item) => normalizeSearch(item.searchText).includes(query));
  }, [timelineItems, searchQuery]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [u, posts, ads] = await Promise.all([
        api.getUser(id),
        api.getUserPosts(id).catch(() => [] as Post[]),
        adsApi.getLinkedPosts(id, me?.id).catch(() => [] as Ad[]),
      ]);
      setUser(u);
      setUserPosts(posts);
      setLinkedAds(ads);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [id, me?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notFound}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notFound}>
          <Ionicons name="person-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.notFoundText}>{t('profile.userNotFound')}</Text>
          <TouchableOpacity onPress={() => goBack('/')} style={styles.backBtnCenter}>
            <Text style={styles.backBtnCenterText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const content = (
    <>
      <ProfileHeader
        user={user}
        isWide={isWide}
        onBack={() => goBack('/')}
        onMenu={!isMe ? () => setMenuVisible(true) : undefined}
        onSearchChange={!user.locked ? setSearchQuery : undefined}
        actions={
          !user.locked ? (
            isMe ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnEdit]}
                onPress={() => router.push('/settings' as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="settings-outline" size={16} color={Colors.text} />
                <Text style={styles.actionBtnEditText}>{t('profile.edit')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                activeOpacity={0.85}
                onPress={() => router.push(`/messages/${user.id}` as any)}
              >
                <Ionicons name="chatbubble-outline" size={16} color="#fff" />
                <Text style={styles.actionBtnPrimaryText}>{t('profile.sendMessage')}</Text>
              </TouchableOpacity>
            )
          ) : undefined
        }
      />

      {user.locked ? (
        /* Perfil bloqueado: de outro bairro. Só nome, @username, foto e nº de
           posts — mas ainda é possível iniciar uma conversa. */
        <View style={styles.lockedCard}>
          <View style={styles.lockedIcon}>
            <Ionicons name="lock-closed" size={24} color={Colors.textSecondary} />
          </View>
          <Text style={styles.lockedTitle}>{t('profile.lockedTitle')}</Text>
          <Text style={styles.lockedDesc}>
            {t('profile.lockedDesc')}
          </Text>
          <br/>
          {!isMe && (
            <TouchableOpacity
              style={styles.lockedMessageBtn}
              activeOpacity={0.85}
              onPress={() => router.push(`/messages/${user.id}` as any)}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#fff" />
              <Text style={styles.lockedMessageBtnText}>{t('profile.sendMessage')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {/* Posts — timeline */}
          <View style={styles.timelineSection}>
            <Text style={styles.timelineTitle}>
              {isMe ? t('profile.myPosts') : t('profile.posts')}
            </Text>
            {visibleTimelineItems.length === 0 ? (
              <View style={styles.noPosts}>
                <Ionicons
                  name={searchQuery ? 'search-outline' : 'document-text-outline'}
                  size={32}
                  color={Colors.textTertiary}
                />
                <Text style={styles.noPostsText}>
                  {searchQuery ? t('profile.noSearchResults') : t('profile.noPosts')}
                </Text>
              </View>
            ) : (
              visibleTimelineItems.map((item) => item.node)
            )}
          </View>
        </>
      )}

      <View style={{ height: 24 }} />
    </>
  );

  return (
    <>
      <FeedLayout showMobileMenu={isMe}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      </FeedLayout>

      <ActionMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        options={[
          {
            key: 'report',
            label: t('report.titles.user'),
            icon: 'flag-outline',
            destructive: true,
            onPress: () => setReportVisible(true),
          },
        ]}
      />
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        targetType="user"
        targetId={user.id}
      />
    </>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 16, color: Colors.textSecondary },
  backBtnCenter: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 10,
  },
  backBtnCenterText: { color: Colors.primary, fontWeight: '700' },

  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    ...Colors.shadow.sm,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  actionBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  actionBtnEdit: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnEditText: { color: Colors.text, fontWeight: '700', fontSize: 15 },


  timelineSection: {
    marginTop: 20,
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

  lockedCard: {
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Colors.shadow.sm,
  },
  lockedIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  lockedTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  lockedDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  lockedMessageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    alignSelf: 'stretch',
    margin: "auto",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    width: '35%'
  },
  lockedMessageBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
