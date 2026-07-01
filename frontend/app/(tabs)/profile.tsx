import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../../constants/Colors';
import { Post } from '../../data/mock';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import FeedLayout from '../../components/FeedLayout';
import PostCard from '../../components/PostCard';

const WIDE = 900;

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const { user, logout } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [myPosts, setMyPosts] = useState<Post[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api.getUserPosts(user.id).then(setMyPosts).catch(() => setMyPosts([]));
    }, [user]),
  );

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/welcome');
  };

  const content = (
    <>
      {/* Hero header */}
      <LinearGradient
        colors={['#0D2918', '#15803D', '#22C55E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, isWide && styles.heroWide]}
      >
        <View style={styles.profileCenter}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: user?.avatar }} style={styles.avatar} />
            <TouchableOpacity style={styles.editAvatarBtn}>
              <Ionicons name="camera" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.nameBadgeRow}>
            <Text style={styles.name}>{user?.name}</Text>
          </View>
          {user?.username && <Text style={styles.username}>@{user.username}</Text>}
          <View style={styles.neighborhoodRow}>
            <Ionicons name="location" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.neighborhood}>{user?.neighborhood}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{user?.postsCount ?? 0}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{user?.helpCount ?? 0}</Text>
            <Text style={styles.statLabel}>Ajudas</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>238</Text>
            <Text style={styles.statLabel}>Vizinhos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>4.9</Text>
            <Text style={styles.statLabel}>Reputação</Text>
          </View>
        </View>
      </LinearGradient>

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

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.85}
      >
        <Ionicons name="log-out-outline" size={18} color={Colors.error} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Daqui v1.0.0</Text>
      <View style={{ height: 20 }} />
    </>
  );

  return (
    <FeedLayout>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    </FeedLayout>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  /* ── Hero ── */
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  heroWide: {
    borderRadius: 20,
    marginTop: 20,
    marginHorizontal: 20,
  },
  profileCenter: { alignItems: 'center', marginBottom: 20 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  name: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  username: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginTop: 2 },
  neighborhoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  neighborhood: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center' },

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
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 15,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: { fontSize: 15, color: Colors.error, fontWeight: '700' },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 14,
  },
});
