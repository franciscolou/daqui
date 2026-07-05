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
import { api, ApiError, SharedPost } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme, useThemedStyles } from '../../lib/theme';
import WideLayout from '../../components/WideLayout';
import SharedPostPreview from '../../components/SharedPostPreview';

// Converte o Post completo na prévia compacta usada nas mensagens.
function toSharedPost(p: Post): SharedPost {
  return {
    id: p.id,
    category: p.category,
    title: p.title,
    content: p.content,
    image: p.images?.[0],
    createdAt: p.createdAt,
    author: p.author,
  };
}

export default function ForwardScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { loading: authLoading } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [post, setPost] = useState<Post | null>(null);
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Vizinhos já com o post enviado / com envio em andamento (permite enviar a vários).
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!postId) return;
    try {
      const [p, convs, neighbors] = await Promise.all([
        api.getPost(postId),
        api.getConversations().catch(() => []),
        api.getNeighbors().catch(() => []),
      ]);
      setPost(p);
      // Conversas recentes primeiro, depois demais vizinhos (sem repetir).
      const seen = new Set<string>();
      const merged: User[] = [];
      for (const c of convs) {
        if (!seen.has(c.user.id)) { seen.add(c.user.id); merged.push(c.user); }
      }
      for (const u of neighbors) {
        if (!seen.has(u.id)) { seen.add(u.id); merged.push(u); }
      }
      // Usuários do mesmo bairro do post primeiro; os de outros bairros (bloqueados) depois.
      const sameNeighborhood = merged.filter((u) => u.neighborhood === p.neighborhood);
      const otherNeighborhood = merged.filter((u) => u.neighborhood !== p.neighborhood);
      setPeople([...sameNeighborhood, ...otherNeighborhood]);
    } catch {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId]);

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
    if (!postId || sent.has(user.id) || pending.has(user.id)) return;
    setPending((p) => withId(p, user.id, true));
    setError(null);
    try {
      await api.sendMessage(user.id, '', postId);
      // Marca como enviado e permanece na tela para encaminhar a outros vizinhos.
      setSent((s) => withId(s, user.id, true));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível encaminhar o post.');
    } finally {
      setPending((p) => withId(p, user.id, false));
    }
  };

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
          ) : !post ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>Post não encontrado.</Text>
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
                    <SharedPostPreview post={toSharedPost(post)} static />
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
                const otherNeighborhood = item.neighborhood !== post.neighborhood;
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
