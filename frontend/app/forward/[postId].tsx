import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { Post, User } from '../../data/mock';
import { api, ApiError, Comment, SharedComment, SharedPost } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme, useThemedStyles } from '../../lib/theme';
import WideLayout from '../../components/WideLayout';
import SharedPostPreview from '../../components/SharedPostPreview';
import SharedCommentPreview from '../../components/SharedCommentPreview';

// Converte o Post completo na prévia compacta usada nas mensagens.
function toSharedPost(p: Post): SharedPost {
  return {
    id: p.id,
    category: p.category,
    title: p.title,
    content: p.content,
    image: p.media?.find((m) => m.type === 'image')?.url,
    createdAt: p.createdAt,
    author: p.author,
  };
}

function toSharedComment(c: Comment): SharedComment {
  return {
    id: c.id,
    postId: c.postId,
    content: c.content,
    createdAt: c.createdAt,
    author: c.author,
  };
}

export default function ForwardScreen() {
  // Encaminha um post (rota /forward/{postId}) ou um comentário
  // (/forward/{postId}?commentId=...). Comentário não tem restrição de bairro.
  const { postId, commentId } = useLocalSearchParams<{ postId: string; commentId?: string }>();
  const { loading: authLoading } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const forwardingComment = !!commentId;

  const [post, setPost] = useState<Post | null>(null);
  const [comment, setComment] = useState<Comment | null>(null);
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Vizinhos já com o item enviado / com envio em andamento (permite enviar a vários).
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!postId) return;
    try {
      const [convs, neighbors] = await Promise.all([
        api.getConversations().catch(() => []),
        api.getNeighbors().catch(() => []),
      ]);
      let restrictNeighborhood: string | null = null;
      if (commentId) {
        setComment(await api.getComment(commentId));
        // Comentário pode ser encaminhado a qualquer vizinho (isolamento relaxado).
      } else {
        const p = await api.getPost(postId);
        setPost(p);
        restrictNeighborhood = p.neighborhood;
      }
      // Conversas recentes primeiro, depois demais vizinhos (sem repetir).
      const seen = new Set<string>();
      const merged: User[] = [];
      for (const c of convs) {
        if (!seen.has(c.user.id)) { seen.add(c.user.id); merged.push(c.user); }
      }
      for (const u of neighbors) {
        if (!seen.has(u.id)) { seen.add(u.id); merged.push(u); }
      }
      if (restrictNeighborhood) {
        // Post: usuários do mesmo bairro primeiro; os de outros bairros (bloqueados) depois.
        const same = merged.filter((u) => u.neighborhood === restrictNeighborhood);
        const other = merged.filter((u) => u.neighborhood !== restrictNeighborhood);
        setPeople([...same, ...other]);
      } else {
        setPeople(merged);
      }
    } catch {
      setPost(null);
      setComment(null);
    } finally {
      setLoading(false);
    }
  }, [postId, commentId]);

  useEffect(() => {
    // Espera o token carregar (deep-link/refresh direto) antes de buscar.
    if (!authLoading) load();
  }, [load, authLoading]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q),
    );
  }, [people, search]);

  const withId = (s: Set<string>, id: string, add: boolean) => {
    const next = new Set(s);
    if (add) next.add(id);
    else next.delete(id);
    return next;
  };

  const forward = async (user: User) => {
    if (sent.has(user.id) || pending.has(user.id)) return;
    setPending((p) => withId(p, user.id, true));
    setError(null);
    try {
      if (forwardingComment) {
        await api.sendMessage(user.id, '', undefined, undefined, commentId);
      } else {
        await api.sendMessage(user.id, '', postId);
      }
      // Marca como enviado e permanece na tela para encaminhar a outros vizinhos.
      setSent((s) => withId(s, user.id, true));
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : `Não foi possível encaminhar o ${forwardingComment ? 'comentário' : 'post'}.`,
      );
    } finally {
      setPending((p) => withId(p, user.id, false));
    }
  };

  const notFound = forwardingComment ? !comment : !post;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WideLayout>
        <View style={styles.column}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.topBarIconBtn} onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Encaminhar</Text>
            <View style={styles.topBarIconBtn} />
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : notFound ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>
                {forwardingComment ? 'Comentário não encontrado.' : 'Post não encontrado.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(u) => u.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View>
                  <View style={styles.previewWrap}>
                    {forwardingComment && comment ? (
                      <SharedCommentPreview comment={toSharedComment(comment)} static />
                    ) : post ? (
                      <SharedPostPreview post={toSharedPost(post)} static />
                    ) : null}
                  </View>
                  {!!error && <Text style={styles.error}>{error}</Text>}
                  <View style={styles.searchBar}>
                    <Ionicons name="search-outline" size={17} color={Colors.textTertiary} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Buscar vizinho..."
                      placeholderTextColor={Colors.textTertiary}
                      value={search}
                      onChangeText={setSearch}
                    />
                  </View>
                  <Text style={styles.sectionTitle}>Enviar para</Text>
                </View>
              }
              ListEmptyComponent={
                <Text style={styles.noResults}>Nenhum vizinho encontrado.</Text>
              }
              renderItem={({ item }) => {
                // Comentário: sem restrição de bairro. Post: bloqueia outro bairro.
                const otherNeighborhood =
                  !forwardingComment && !!post && item.neighborhood !== post.neighborhood;
                return (
                  <TouchableOpacity
                    style={styles.row}
                    activeOpacity={0.85}
                    disabled={otherNeighborhood || sent.has(item.id) || pending.has(item.id)}
                    onPress={() => forward(item)}
                  >
                    <Image source={{ uri: item.avatar }} style={styles.avatar} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        @{item.username}
                        {!!item.neighborhood && ` · ${item.neighborhood}`}
                      </Text>
                    </View>
                    {otherNeighborhood ? (
                      <Text style={styles.otherNeighborhoodText}>Usuário de outro bairro</Text>
                    ) : pending.has(item.id) ? (
                      <ActivityIndicator color={Colors.primary} size="small" />
                    ) : sent.has(item.id) ? (
                      <View style={styles.sentBtn}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </View>
                    ) : (
                      <View style={styles.sendBtn}>
                        <Ionicons name="send" size={16} color={Colors.primary} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </WideLayout>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  column: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  topBarIconBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  previewWrap: { padding: 16 },
  error: { color: Colors.error, fontSize: 13, paddingHorizontal: 16, marginBottom: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginHorizontal: 16,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, outlineStyle: 'none' } as any,
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  noResults: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: Colors.border },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  rowSub: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  otherNeighborhoodText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    maxWidth: 90,
    textAlign: 'right',
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFaint,
  },
  sentBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
});
