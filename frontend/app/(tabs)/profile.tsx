import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../../constants/Colors';
import { Post } from '../../data/mock';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import FeedLayout from '../../components/FeedLayout';
import PostCard from '../../components/PostCard';
import ProfileHeader from '../../components/ProfileHeader';
import { useRegisterScrollToTop } from '../../lib/scrollToTop';

const WIDE = 900;

export default function ProfileScreen() {
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

  if (!user) return null;

  const content = (
    <>
      <ProfileHeader user={user} isWide={isWide} />

      {/* My posts — timeline */}
      <View style={styles.timelineSection}>
        <Text style={styles.timelineTitle}>Meus posts</Text>
        {myPosts.length === 0 ? (
          <View style={styles.noPosts}>
            <Ionicons name="document-text-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.noPostsText}>Você ainda não publicou nada.</Text>
          </View>
        ) : (
          myPosts.map((post) => <PostCard key={post.id} post={post} />)
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
