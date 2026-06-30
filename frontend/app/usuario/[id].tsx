import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Colors } from '../../constants/Colors';
import { Post, User } from '../../data/mock';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function UsuarioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const { user: me } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const isMe = !!me && me.id === id;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [u, posts] = await Promise.all([
        api.getUser(id),
        api.getUserPosts(id).catch(() => [] as Post[]),
      ]);
      setUser(u);
      setUserPosts(posts);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

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
          <Text style={styles.notFoundText}>Usuário não encontrado</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtnCenter}>
            <Text style={styles.backBtnCenterText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const badgeLabel =
    user.badge === 'lider'
      ? 'Líder do Bairro'
      : user.badge === 'comerciante'
      ? 'Comerciante'
      : 'Morador';

  const content = (
    <>
      {/* Hero */}
      <LinearGradient
        colors={['#0D2918', '#15803D', '#22C55E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, isWide && styles.heroWide]}
      >
        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.profileCenter}>
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
          <View style={styles.nameBadgeRow}>
            <Text style={styles.name}>{user.name}</Text>
            {user.verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={10} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.neighborhoodRow}>
            <Ionicons name="location" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.neighborhood}>{user.neighborhood}</Text>
          </View>
          {user.badge && (
            <View style={styles.leaderBadge}>
              <Ionicons name="ribbon" size={13} color={Colors.warning} />
              <Text style={styles.leaderText}>{badgeLabel}</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{user.postsCount}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{user.helpCount}</Text>
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

      {/* Action buttons */}
      <View style={styles.actionRow}>
        {isMe ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => router.push('/(tabs)/perfil')}
            activeOpacity={0.85}
          >
            <Ionicons name="settings-outline" size={16} color="#fff" />
            <Text style={styles.actionBtnPrimaryText}>Editar perfil</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} activeOpacity={0.85}>
              <Ionicons name="person-add-outline" size={16} color="#fff" />
              <Text style={styles.actionBtnPrimaryText}>Seguir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} activeOpacity={0.85}>
              <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
              <Text style={styles.actionBtnSecondaryText}>Mensagem</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Info card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={15} color={Colors.textTertiary} />
          <Text style={styles.infoText}>Membro desde {user.joinedAt}</Text>
        </View>
        {user.verified && (
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={15} color={Colors.primary} />
            <Text style={[styles.infoText, { color: Colors.primary }]}>Perfil verificado</Text>
          </View>
        )}
      </View>

      {/* Posts */}
      <View style={styles.postsSection}>
        <Text style={styles.sectionTitle}>
          {isMe ? 'Minhas publicações' : 'Publicações'}
        </Text>
        {userPosts.length === 0 ? (
          <View style={styles.emptyPosts}>
            <Ionicons name="document-text-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>Nenhuma publicação ainda</Text>
          </View>
        ) : (
          <View style={styles.postsList}>
            {userPosts.map((post) => {
              const catColor = Colors.category[post.category] ?? Colors.primary;
              return (
                <TouchableOpacity
                  key={post.id}
                  style={styles.postCard}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/post/${post.id}` as any)}
                >
                  {post.images?.[0] ? (
                    <Image source={{ uri: post.images[0] }} style={styles.postImage} />
                  ) : (
                    <View style={[styles.postImagePlaceholder, { backgroundColor: catColor + '15' }]}>
                      <Ionicons name="document-text-outline" size={24} color={catColor} />
                    </View>
                  )}
                  <View style={styles.postInfo}>
                    <Text style={styles.postTitle} numberOfLines={2}>
                      {post.title ?? post.content}
                    </Text>
                    <View style={styles.postMeta}>
                      <Ionicons name="heart" size={12} color={Colors.error} />
                      <Text style={styles.postMetaText}>{post.likesCount}</Text>
                      <Text style={styles.postMetaDot}>·</Text>
                      <Ionicons name="chatbubble" size={11} color={Colors.textTertiary} />
                      <Text style={styles.postMetaText}>{post.commentsCount}</Text>
                      <Text style={styles.postMetaDot}>·</Text>
                      <Text style={styles.postTime}>{post.createdAt}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View style={{ height: 24 }} />
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isWide ? (
        <View style={styles.wideBody}>
          <View style={styles.centerArea}>
            <ScrollView
              style={styles.contentScroll}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {content}
            </ScrollView>
          </View>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  wideBody: { flex: 1, flexDirection: 'row', backgroundColor: Colors.background },
  centerArea: { flex: 1, alignItems: 'center', backgroundColor: Colors.background },
  contentScroll: { flex: 1, maxWidth: 680, width: '100%' },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 16, color: Colors.textSecondary },
  backBtnCenter: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 10,
  },
  backBtnCenterText: { color: Colors.primary, fontWeight: '700' },

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
  backBtn: {
    alignSelf: 'flex-start',
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileCenter: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  name: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neighborhoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  neighborhood: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  leaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  leaderText: { color: Colors.warning, fontSize: 12, fontWeight: '700' },
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

  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  actionBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  actionBtnSecondary: {
    backgroundColor: Colors.primaryFaint,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  actionBtnSecondaryText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },

  infoCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Colors.shadow.sm,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  postsSection: { paddingTop: 20 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  emptyPosts: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  emptyText: { fontSize: 14, color: Colors.textTertiary },
  postsList: { paddingHorizontal: 16, gap: 10 },
  postCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Colors.shadow.sm,
  },
  postImage: { width: 60, height: 60, borderRadius: 10 },
  postImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postInfo: { flex: 1 },
  postTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6, lineHeight: 19 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postMetaText: { fontSize: 12, color: Colors.textTertiary },
  postMetaDot: { fontSize: 12, color: Colors.textTertiary },
  postTime: { fontSize: 12, color: Colors.textTertiary },
});
