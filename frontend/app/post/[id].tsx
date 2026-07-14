import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { CATEGORY_ICONS, CATEGORY_LABELS, Post } from '../../data/mock';
import { api, Comment } from '../../lib/api';
import { formatExactDateTime, formatPostTime } from '../../lib/time';
import { useAuth } from '../../lib/auth';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { submitOnEnter } from '../../lib/keyboard';

const MAX_INDENT_DEPTH = 4; // além disso, não indenta mais (evita "escada" infinita)
import WideLayout from '../../components/WideLayout';
import PollBlock from '../../components/PollBlock';
import ActionMenu from '../../components/ActionMenu';
import ReportModal from '../../components/ReportModal';
import ConfirmModal from '../../components/ConfirmModal';
import PostMediaGallery from '../../components/PostMediaGallery';
import ResidentBadge from '../../components/ResidentBadge';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentMenu, setCommentMenu] = useState<Comment | null>(null);
  const [reportComment, setReportComment] = useState<Comment | null>(null);
  const [postMenuVisible, setPostMenuVisible] = useState(false);
  const [reportPostVisible, setReportPostVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const inputRef = useRef<TextInput>(null);
  // Confirmação de exclusão (post ou comentário) + estado de envio.
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  const [confirmDeleteComment, setConfirmDeleteComment] = useState<Comment | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Total de comentários (topo + respostas) — reflete o contador denormalizado do post.
  const [commentCount, setCommentCount] = useState(0);
  // Respostas carregadas sob demanda por comentário + quais estão expandidas/carregando.
  const [repliesByParent, setRepliesByParent] = useState<Record<string, Comment[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, c] = await Promise.all([api.getPost(id), api.listComments(id)]);
      setPost(p);
      setLiked(p.liked);
      setLikesCount(p.likesCount);
      setComments(c); // apenas comentários de topo; respostas vêm sob demanda
      setCommentCount(p.commentsCount);
      // Recarga completa da tela zera o estado das respostas expandidas.
      setRepliesByParent({});
      setExpanded(new Set());
    } catch {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleLike = async () => {
    if (!post) return;
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);
    try {
      const updated = await api.toggleLike(post.id);
      setLiked(updated.liked);
      setLikesCount(updated.likesCount);
    } catch {
      setLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  // Atualiza um comentário onde quer que ele esteja (topo ou dentro das respostas).
  const updateComment = (commentId: string, updater: (c: Comment) => Comment) => {
    setComments((prev) => prev.map((c) => (c.id === commentId ? updater(c) : c)));
    setRepliesByParent((prev) => {
      let changed = false;
      const next: Record<string, Comment[]> = {};
      for (const [key, arr] of Object.entries(prev)) {
        if (arr.some((c) => c.id === commentId)) {
          changed = true;
          next[key] = arr.map((c) => (c.id === commentId ? updater(c) : c));
        } else {
          next[key] = arr;
        }
      }
      return changed ? next : prev;
    });
  };

  const submit = async () => {
    const content = text.trim();
    if (!content || sending || !id) return;
    setSending(true);
    try {
      const created = await api.addComment(id, content, replyingTo?.id);
      setText('');
      setCommentCount((n) => n + 1);
      if (created.parentId) {
        const parentId = created.parentId;
        // Conta a nova resposta no botão do pai e mostra a thread com ela no topo.
        updateComment(parentId, (c) => ({ ...c, repliesCount: c.repliesCount + 1 }));
        const alreadyLoaded = !!repliesByParent[parentId];
        if (alreadyLoaded) {
          setRepliesByParent((prev) => ({ ...prev, [parentId]: [created, ...prev[parentId]] }));
        }
        setExpanded((prev) => new Set(prev).add(parentId));
        if (!alreadyLoaded) {
          // Carga direcionada só desse pai (não recarrega a página inteira).
          try {
            const replies = await api.getReplies(parentId);
            setRepliesByParent((prev) => ({ ...prev, [parentId]: replies }));
          } catch {
            // se falhar, o botão "Ver respostas" ainda permite recarregar
          }
        }
      } else {
        setComments((prev) => [created, ...prev]);
      }
      setReplyingTo(null);
    } catch {
      // mantém o texto para nova tentativa
    } finally {
      setSending(false);
    }
  };

  const startReply = (comment: Comment) => {
    setReplyingTo(comment);
    inputRef.current?.focus();
  };

  // Carrega/oculta as respostas de um comentário. Só busca do backend no
  // primeiro clique; recolher/reexpandir usa o que já está em memória.
  const expandReplies = async (comment: Comment) => {
    if (expanded.has(comment.id)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(comment.id);
        return next;
      });
      return;
    }
    if (repliesByParent[comment.id]) {
      setExpanded((prev) => new Set(prev).add(comment.id));
      return;
    }
    setLoadingReplies((prev) => new Set(prev).add(comment.id));
    try {
      const replies = await api.getReplies(comment.id);
      setRepliesByParent((prev) => ({ ...prev, [comment.id]: replies }));
      setExpanded((prev) => new Set(prev).add(comment.id));
    } catch {
      // silencioso — o botão continua disponível para nova tentativa
    } finally {
      setLoadingReplies((prev) => {
        const next = new Set(prev);
        next.delete(comment.id);
        return next;
      });
    }
  };

  const toggleCommentLike = async (comment: Comment) => {
    const nextLiked = !comment.liked;
    // Atualização otimista.
    updateComment(comment.id, (c) => ({
      ...c,
      liked: nextLiked,
      likesCount: c.likesCount + (nextLiked ? 1 : -1),
    }));
    try {
      const updated = await api.toggleCommentLike(comment.id);
      updateComment(comment.id, (c) => ({ ...c, liked: updated.liked, likesCount: updated.likesCount }));
    } catch {
      updateComment(comment.id, (c) => ({ ...c, liked: comment.liked, likesCount: comment.likesCount }));
    }
  };

  const isPostAuthor = !!post && post.author.id === user?.id;
  // Pode excluir um comentário: seu autor OU o autor do post (qualquer comentário).
  // Ser autor do comentário-pai não conta — só o autor do post remove respostas alheias.
  const canDeleteComment = (comment: Comment) =>
    comment.author.id === user?.id || isPostAuthor;

  // Ids da sub-árvore (comentário + respostas já carregadas) para remover do estado local.
  const collectSubtreeIds = (commentId: string): Set<string> => {
    const ids = new Set<string>([commentId]);
    for (const child of repliesByParent[commentId] ?? []) {
      for (const cid of collectSubtreeIds(child.id)) ids.add(cid);
    }
    return ids;
  };

  const doDeleteComment = async () => {
    const comment = confirmDeleteComment;
    if (!comment || deleting) return;
    setDeleting(true);
    try {
      await api.deleteComment(comment.id);
      const removed = collectSubtreeIds(comment.id);
      // Remove localmente (sem recarregar a tela toda).
      setComments((prev) => prev.filter((c) => !removed.has(c.id)));
      setRepliesByParent((prev) => {
        const next: Record<string, Comment[]> = {};
        for (const [key, arr] of Object.entries(prev)) {
          if (removed.has(key)) continue; // descarta o "balde" de respostas do nó removido
          next[key] = arr.filter((c) => !removed.has(c.id));
        }
        return next;
      });
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const rid of removed) next.delete(rid);
        return next;
      });
      if (comment.parentId) {
        updateComment(comment.parentId, (c) => ({
          ...c,
          repliesCount: Math.max(0, c.repliesCount - 1),
        }));
      }
      setCommentCount((n) => Math.max(0, n - removed.size));
      setConfirmDeleteComment(null);
      // Reconcilia o total com o backend (cobre respostas não carregadas removidas em cascata).
      if (id) api.getPost(id).then((p) => setCommentCount(p.commentsCount)).catch(() => {});
    } catch {
      // mantém o modal aberto para nova tentativa
    } finally {
      setDeleting(false);
    }
  };

  const doDeletePost = async () => {
    if (!post || deleting) return;
    setDeleting(true);
    try {
      await api.deletePost(post.id);
      setConfirmDeletePost(false);
      router.back();
    } catch {
      // mantém o modal aberto para nova tentativa
    } finally {
      setDeleting(false);
    }
  };

  // Renderiza um comentário e, se expandido, suas respostas (recursivo).
  const renderComment = (comment: Comment, depth: number) => {
    const indent = Math.min(depth, MAX_INDENT_DEPTH) * 22;
    const isExpanded = expanded.has(comment.id);
    const isLoading = loadingReplies.has(comment.id);
    const replies = repliesByParent[comment.id] ?? [];
    return (
      <View key={comment.id}>
        <View style={[styles.comment, { paddingLeft: 16 + indent }]}>
          {depth > 0 && <View style={styles.threadLine} />}
          <TouchableOpacity onPress={() => router.push(`/user/${comment.author.id}` as any)}>
            <Image source={{ uri: comment.author.avatar }} style={styles.commentAvatar} />
          </TouchableOpacity>
          <View style={styles.commentMain}>
            <View style={styles.commentBubble}>
              <View style={styles.commentHead}>
                <Text style={styles.commentAuthor} numberOfLines={1}>{comment.author.name}</Text>
                {!!comment.author.username && (
                  <Text style={styles.commentUsername} numberOfLines={1}>@{comment.author.username}</Text>
                )}
                {comment.authorIsResident && <ResidentBadge />}
                <Text style={styles.commentTime}>{formatPostTime(comment.createdAt)}</Text>
                <TouchableOpacity
                  style={[styles.iconBtn, styles.commentMenuBtn]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => setCommentMenu(comment)}
                >
                  <Ionicons name="ellipsis-horizontal" size={15} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.commentText}>{comment.content}</Text>
            </View>
            {/* Ações do comentário — como num post: curtir, responder, encaminhar */}
            <View style={styles.commentActions}>
              <TouchableOpacity
                style={styles.commentAction}
                onPress={() => toggleCommentLike(comment)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons
                  name={comment.liked ? 'heart' : 'heart-outline'}
                  size={15}
                  color={comment.liked ? Colors.error : Colors.textTertiary}
                />
                {comment.likesCount > 0 && (
                  <Text style={[styles.commentActionText, comment.liked && { color: Colors.error }]}>
                    {comment.likesCount}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.commentAction}
                onPress={() => startReply(comment)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="chatbubble-outline" size={14} color={Colors.textTertiary} />
                <Text style={styles.commentActionText}>Responder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.commentAction}
                onPress={() => router.push(`/forward/${comment.postId}?commentId=${comment.id}` as any)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="arrow-redo-outline" size={15} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
            {/* Respostas colapsadas: só carregam do backend ao clicar */}
            {comment.repliesCount > 0 && (
              <TouchableOpacity
                style={styles.repliesToggle}
                onPress={() => expandReplies(comment)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={Colors.primary}
                    />
                    <Text style={styles.repliesToggleText}>
                      {isExpanded
                        ? 'Ocultar respostas'
                        : `Ver ${comment.repliesCount} ${comment.repliesCount === 1 ? 'resposta' : 'respostas'}`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        {isExpanded && replies.map((r) => renderComment(r, depth + 1))}
      </View>
    );
  };

  const catColor = post ? Colors.category[post.category] ?? Colors.primary : Colors.primary;

  const header = post && (
    <View>
      <View style={styles.post}>
        <View style={styles.authorRow}>
          <TouchableOpacity
            style={styles.authorRowLeft}
            onPress={() => router.push(`/user/${post.author.id}` as any)}
            activeOpacity={0.8}
            focusable={false}
          >
            <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <View style={styles.authorNameRow}>
                <Text style={styles.authorName} numberOfLines={1}>{post.author.name}</Text>
                {!!post.author.username && (
                  <Text style={styles.authorUsername} numberOfLines={1}>@{post.author.username}</Text>
                )}
                {post.authorIsResident && <ResidentBadge />}
              </View>
              <Text style={styles.time}>{formatPostTime(post.createdAt)}</Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.catTag, { backgroundColor: catColor + '18' }]}>
            <Ionicons name={CATEGORY_ICONS[post.category] as any} size={10} color={catColor} />
            <Text style={[styles.catText, { color: catColor }]}>
              {CATEGORY_LABELS[post.category]}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => setPostMenuVisible(true)}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {post.title && <Text style={styles.title}>{post.title}</Text>}
        <Text style={styles.body}>{post.content}</Text>
        {post.poll && (
          <PollBlock
            poll={post.poll}
            postId={post.id}
            onChange={(poll) => setPost((p) => (p ? { ...p, poll } : p))}
          />
        )}
        {!!post.media?.length && <PostMediaGallery media={post.media} />}

        {(() => {
          const hasCoords = post.latitude != null && post.longitude != null;
          const label =
            [post.placeName, post.location].filter(Boolean).join(' · ') ||
            (hasCoords ? post.neighborhood : null);
          if (!label) return null;
          return (
            <TouchableOpacity
              style={styles.locationRow}
              activeOpacity={hasCoords ? 0.7 : 1}
              disabled={!hasCoords}
              onPress={() =>
                router.push(
                  `/(tabs)/map?focus=${post.id}&lat=${post.latitude}&lng=${post.longitude}` as any,
                )
              }
            >
              <Ionicons name="location" size={15} color={Colors.primary} />
              <Text style={styles.locationText} numberOfLines={2}>{label}</Text>
              {hasCoords && (
                <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
              )}
            </TouchableOpacity>
          );
        })()}

        <Text style={styles.exactTime}>{formatExactDateTime(post.createdAt)}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={20}
              color={liked ? Colors.error : Colors.textTertiary}
            />
            <Text style={[styles.actionCount, liked && { color: Colors.error }]}>{likesCount}</Text>
          </TouchableOpacity>
          <View style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={18} color={Colors.textTertiary} />
            <Text style={styles.actionCount}>{commentCount}</Text>
          </View>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/forward/${post.id}` as any)}
          >
            <Ionicons name="arrow-redo-outline" size={18} color={Colors.textTertiary} />
            <Text style={styles.actionCount}></Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.commentsTitle}>
        {commentCount} {commentCount === 1 ? 'comentário' : 'comentários'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WideLayout showMobileMenu={false}>
      <View style={styles.column}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarIconBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{post?.poll ? 'Enquete' : 'Post'}</Text>
        {post?.poll && post.author.id === user?.id ? (
          <TouchableOpacity style={styles.topBarIconBtn} onPress={() => router.push(`/poll/${post.id}` as any)} hitSlop={10}>
            <Ionicons name="create-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.topBarIconBtn} />
        )}
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={header}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListEmptyComponent={
              <Text style={styles.noComments}>Seja o primeiro a comentar 💬</Text>
            }
            renderItem={({ item }) => renderComment(item, 0)}
          />

          {!!replyingTo && (
            <View style={styles.replyBanner}>
              <Ionicons name="arrow-undo" size={14} color={Colors.primary} />
              <Text style={styles.replyBannerText} numberOfLines={1}>
                Respondendo a {replyingTo.author.name}
              </Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={10}>
                <Ionicons name="close" size={16} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.composer}>
            <Image source={{ uri: user?.avatar }} style={styles.composerAvatar} />
            <TextInput
              ref={inputRef}
              style={styles.composerInput}
              placeholder={replyingTo ? `Responder a ${replyingTo.author.name}...` : 'Escreva um comentário...'}
              placeholderTextColor={Colors.textTertiary}
              value={text}
              onChangeText={setText}
              multiline
              onKeyPress={submitOnEnter(submit)}
            />
            <TouchableOpacity
              onPress={submit}
              disabled={!text.trim() || sending}
              style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
      </View>
      </WideLayout>

      <ActionMenu
        visible={!!commentMenu}
        onClose={() => setCommentMenu(null)}
        options={[
          ...(commentMenu && canDeleteComment(commentMenu)
            ? [{
                key: 'delete',
                label: 'Excluir comentário',
                icon: 'trash-outline' as const,
                destructive: true,
                onPress: () => setConfirmDeleteComment(commentMenu),
              }]
            : []),
          ...(commentMenu && commentMenu.author.id !== user?.id
            ? [{
                key: 'report',
                label: 'Denunciar comentário',
                icon: 'flag-outline' as const,
                destructive: true,
                onPress: () => setReportComment(commentMenu),
              }]
            : []),
        ]}
      />
      <ReportModal
        visible={!!reportComment}
        onClose={() => setReportComment(null)}
        targetType="comment"
        targetId={reportComment?.id ?? ''}
      />
      <ConfirmModal
        visible={!!confirmDeleteComment}
        title="Excluir comentário?"
        message="Esta ação não pode ser desfeita. As respostas a ele também serão removidas."
        confirmLabel="Excluir"
        destructive
        loading={deleting}
        onConfirm={doDeleteComment}
        onClose={() => setConfirmDeleteComment(null)}
      />

      <ActionMenu
        visible={postMenuVisible}
        onClose={() => setPostMenuVisible(false)}
        options={
          isPostAuthor
            ? [{
                key: 'delete',
                label: 'Excluir post',
                icon: 'trash-outline' as const,
                destructive: true,
                onPress: () => setConfirmDeletePost(true),
              }]
            : [{
                key: 'report',
                label: 'Denunciar post',
                icon: 'flag-outline' as const,
                destructive: true,
                onPress: () => setReportPostVisible(true),
              }]
        }
      />
      <ReportModal
        visible={reportPostVisible}
        onClose={() => setReportPostVisible(false)}
        targetType="post"
        targetId={post?.id ?? ''}
      />
      <ConfirmModal
        visible={confirmDeletePost}
        title="Excluir publicação?"
        message="Esta ação não pode ser desfeita. O post e seus comentários serão removidos."
        confirmLabel="Excluir"
        destructive
        loading={deleting}
        onConfirm={doDeletePost}
        onClose={() => setConfirmDeletePost(false)}
      />
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

  post: { paddingHorizontal: 16, paddingTop: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  authorRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  authorName: { fontSize: 15, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  authorUsername: { fontSize: 13, color: Colors.textTertiary, fontWeight: '500', flexShrink: 1 },
  time: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  catTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  catText: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 6, letterSpacing: -0.2 },
  body: { fontSize: 15, color: Colors.text, lineHeight: 22, marginBottom: 12, fontWeight: "400" },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.primaryFaint,
    marginBottom: 12,
  },
  locationText: { fontSize: 13, color: Colors.primary, fontWeight: '600', flexShrink: 1 },
  exactTime: { fontSize: 12, color: Colors.textTertiary, marginBottom: 12 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
  },
  actionCount: { fontSize: 14, color: Colors.textTertiary, fontWeight: '600' },
  iconBtn: {
    padding: 6,
    borderRadius: 14,
  },

  commentsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  noComments: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 32,
  },

  comment: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 16,
    paddingVertical: 10,
    position: 'relative',
  },
  // Linha vertical à esquerda das respostas, reforçando a hierarquia da thread.
  threadLine: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.border,
    borderRadius: 1,
  },
  commentAvatar: { width: 34, height: 34, borderRadius: 17 },
  commentMain: { flex: 1, minWidth: 0 },
  commentBubble: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  commentUsername: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500', flexShrink: 1 },
  commentTime: { fontSize: 11, color: Colors.textTertiary },
  commentText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 19 },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingLeft: 4,
    paddingTop: 6,
  },
  // Empurra os "..." para o fim do espaço horizontal do comentário.
  commentMenuBtn: { marginLeft: 'auto' },
  commentAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  commentActionText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '600' },
  repliesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingLeft: 4,
    minHeight: 26,
  },
  repliesToggleText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primaryFaint,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  replyBannerText: { flex: 1, fontSize: 13, color: Colors.primary, fontWeight: '600' },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  composerAvatar: { width: 32, height: 32, borderRadius: 16 },
  composerInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: Colors.background,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: Colors.text,
    outlineStyle: 'none',
  } as any,
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.textTertiary, opacity: 0.5 },
});
