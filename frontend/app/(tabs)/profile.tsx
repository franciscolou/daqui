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
import { Post, postListKey } from '../../data/mock';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import FeedLayout from '../../components/FeedLayout';
import PostCard from '../../components/PostCard';
import ProfileHeader from '../../components/ProfileHeader';
import { useRegisterScrollToTop } from '../../lib/scrollToTop';
import { useT } from '../../lib/i18n';

const WIDE = 900;

export default function ProfileScreen() {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useRegisterScrollToTop('profile', () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  });

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api.getUserPosts(user.id).then(setMyPosts).catch(() => setMyPosts([]));
    }, [user]),
  );

  const handlePostDeleted = useCallback((postId: string) => {
    setMyPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  if (!user) return null;

  const content = (
    <>
      <ProfileHeader
        user={user}
        isWide={isWide}
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
        {myPosts.length === 0 ? (
          <View style={styles.noPosts}>
            <Ionicons name="document-text-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.noPostsText}>{t('profile.noOwnPosts')}</Text>
          </View>
        ) : (
          myPosts.map((post) => <PostCard key={postListKey(post)} post={post} onDeleted={handlePostDeleted} />)
        )}
      </View>

      <Text style={styles.version}>Daqui v1.0.0</Text>
      <View style={{ height: 20 }} />
    </>
  );

  return (
    <FeedLayout>
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
