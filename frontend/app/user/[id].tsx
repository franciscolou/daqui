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
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { Post, User } from '../../data/mock';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme, useThemedStyles } from '../../lib/theme';
import PostCard from '../../components/PostCard';
import FeedLayout from '../../components/FeedLayout';
import ProfileHeader from '../../components/ProfileHeader';
import ActionMenu from '../../components/ActionMenu';
import ReportModal from '../../components/ReportModal';

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const { user: me } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [user, setUser] = useState<User | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

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

  const content = (
    <>
      <ProfileHeader
        user={user}
        isWide={isWide}
        onBack={() => router.back()}
        onMenu={!isMe ? () => setMenuVisible(true) : undefined}
        actions={
          !user.locked ? (
            isMe ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={() => router.push('/(tabs)/profile')}
                activeOpacity={0.85}
              >
                <Ionicons name="settings-outline" size={16} color="#fff" />
                <Text style={styles.actionBtnPrimaryText}>Editar perfil</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                activeOpacity={0.85}
                onPress={() => router.push(`/messages/${user.id}` as any)}
              >
                <Ionicons name="chatbubble-outline" size={16} color="#fff" />
                <Text style={styles.actionBtnPrimaryText}>Enviar mensagem</Text>
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
          <Text style={styles.lockedTitle}>Perfil de outro bairro</Text>
          <Text style={styles.lockedDesc}>
            No Daqui você se conecta com o seu bairro. O perfil completo e os posts deste
            vizinho só ficam visíveis para a comunidade dele, mas você ainda pode enviar
            uma mensagem.
          </Text>
          <br/>
          {!isMe && (
            <TouchableOpacity
              style={styles.lockedMessageBtn}
              activeOpacity={0.85}
              onPress={() => router.push(`/messages/${user.id}` as any)}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#fff" />
              <Text style={styles.lockedMessageBtnText}>Enviar mensagem</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {/* Posts — timeline */}
          <View style={styles.timelineSection}>
            <Text style={styles.timelineTitle}>
              {isMe ? 'Meus posts' : 'Posts'}
            </Text>
            {userPosts.length === 0 ? (
              <View style={styles.noPosts}>
                <Ionicons name="document-text-outline" size={32} color={Colors.textTertiary} />
                <Text style={styles.noPostsText}>Nenhum post ainda</Text>
              </View>
            ) : (
              userPosts.map((post) => <PostCard key={post.id} post={post} />)
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
            label: 'Denunciar perfil',
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
