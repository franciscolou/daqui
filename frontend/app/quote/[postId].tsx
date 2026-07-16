import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { Post } from '../../data/mock';
import { api, ApiError, Comment, SharedComment, SharedPost } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme, useThemedStyles } from '../../lib/theme';
import WideLayout from '../../components/WideLayout';
import SharedPostPreview from '../../components/SharedPostPreview';
import SharedCommentPreview from '../../components/SharedCommentPreview';

// Converte o Post/Comment completo na prévia compacta usada no card citado
// (mesmos conversores de app/forward/[postId].tsx).
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

export default function QuoteScreen() {
  // Cita um post (rota /quote/{postId}) ou um comentário
  // (/quote/{postId}?commentId=...) — mesma convenção de /forward/[postId].
  const { postId, commentId } = useLocalSearchParams<{ postId: string; commentId?: string }>();
  const { user, loading: authLoading } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const quotingComment = !!commentId;

  const [post, setPost] = useState<Post | null>(null);
  const [comment, setComment] = useState<Comment | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!postId) return;
    try {
      if (commentId) {
        setComment(await api.getComment(commentId));
      } else {
        setPost(await api.getPost(postId));
      }
    } catch {
      setPost(null);
      setComment(null);
    } finally {
      setLoading(false);
    }
  }, [postId, commentId]);

  useEffect(() => {
    if (!authLoading) load();
  }, [load, authLoading]);

  const notFound = quotingComment ? !comment : !post;

  const publish = async () => {
    if (posting || notFound) return;
    setError(null);
    setPosting(true);
    try {
      const created = await api.createPost({
        category: 'geral',
        content: text.trim(),
        quotedPostId: quotingComment ? undefined : postId,
        quotedCommentId: quotingComment ? commentId : undefined,
      });
      router.replace(`/post/${created.id}` as any);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível publicar a citação.');
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WideLayout showMobileMenu={false}>
        <KeyboardAvoidingView
          style={styles.column}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.topBarIconBtn} onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Citar</Text>
            <TouchableOpacity
              style={[styles.postBtn, (posting || notFound) && styles.postBtnDisabled]}
              onPress={publish}
              disabled={posting || notFound}
              activeOpacity={0.85}
            >
              {posting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.postBtnText}>Postar</Text>
              )}
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : notFound ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>
                {quotingComment ? 'Comentário não encontrado.' : 'Post não encontrado.'}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.flex} keyboardShouldPersistTaps="handled">
              {!!error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <View style={styles.composeRow}>
                <Image source={{ uri: user?.avatar }} style={styles.avatar} />
                <TextInput
                  style={styles.input}
                  placeholder="Acrescente sua ideia..."
                  placeholderTextColor={Colors.textTertiary}
                  value={text}
                  onChangeText={setText}
                  multiline
                  autoFocus
                  maxLength={2000}
                />
              </View>
              <View style={styles.previewWrap}>
                {quotingComment && comment ? (
                  <SharedCommentPreview comment={toSharedComment(comment)} static />
                ) : post ? (
                  <SharedPostPreview post={toSharedPost(post)} static />
                ) : null}
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </WideLayout>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  column: { flex: 1, backgroundColor: Colors.surface },
  flex: { flex: 1 },
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
  postBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: Colors.error + '12',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.error, fontWeight: '500' },

  composeRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    outlineStyle: 'none',
  } as any,
  previewWrap: { paddingHorizontal: 16, paddingBottom: 24 },
});
