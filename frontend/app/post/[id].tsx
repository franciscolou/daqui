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
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { CATEGORY_ICONS, CATEGORY_LABELS, Post } from '../../data/mock';
import { api, Comment } from '../../lib/api';
import { formatExactDateTime, formatPostTime } from '../../lib/time';
import { useAuth } from '../../lib/auth';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { submitOnEnter } from '../../lib/keyboard';
import WideLayout from '../../components/WideLayout';
import PollBlock from '../../components/PollBlock';
import ActionMenu from '../../components/ActionMenu';
import ReportModal from '../../components/ReportModal';
import PostImageGallery from '../../components/PostImageGallery';

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

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, c] = await Promise.all([api.getPost(id), api.listComments(id)]);
      setPost(p);
      setLiked(p.liked);
      setLikesCount(p.likesCount);
      setComments(c);
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

  const submit = async () => {
    const content = text.trim();
    if (!content || sending || !id) return;
    setSending(true);
    try {
      const created = await api.addComment(id, content);
      setComments((prev) => [created, ...prev]);
      setText('');
    } catch {
      // mantém o texto para nova tentativa
    } finally {
      setSending(false);
    }
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
          {post.author.id !== user?.id && (
            <TouchableOpacity
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => setPostMenuVisible(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
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
        {!!post.images?.length && <PostImageGallery images={post.images} />}

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
            <Text style={styles.actionCount}>{comments.length}</Text>
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
        {comments.length} {comments.length === 1 ? 'comentário' : 'comentários'}
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
            keyExtractor={(c) => c.id}
            ListHeaderComponent={header}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListEmptyComponent={
              <Text style={styles.noComments}>Seja o primeiro a comentar 💬</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.comment}>
                <TouchableOpacity onPress={() => router.push(`/user/${item.author.id}` as any)}>
                  <Image source={{ uri: item.author.avatar }} style={styles.commentAvatar} />
                </TouchableOpacity>
                <View style={styles.commentBubble}>
                  <View style={styles.commentHead}>
                    <Text style={styles.commentAuthor} numberOfLines={1}>{item.author.name}</Text>
                    {!!item.author.username && (
                      <Text style={styles.commentUsername} numberOfLines={1}>@{item.author.username}</Text>
                    )}
                    <Text style={styles.commentTime}>{formatPostTime(item.createdAt)}</Text>
                    {item.author.id !== user?.id && (
                      <TouchableOpacity
                        style={styles.iconBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => setCommentMenu(item)}
                      >
                        <Ionicons name="ellipsis-horizontal" size={15} color={Colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.commentText}>{item.content}</Text>
                </View>
              </View>
            )}
          />

          <View style={styles.composer}>
            <Image source={{ uri: user?.avatar }} style={styles.composerAvatar} />
            <TextInput
              style={styles.composerInput}
              placeholder="Escreva um comentário..."
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
          {
            key: 'report',
            label: 'Denunciar comentário',
            icon: 'flag-outline',
            destructive: true,
            onPress: () => setReportComment(commentMenu),
          },
        ]}
      />
      <ReportModal
        visible={!!reportComment}
        onClose={() => setReportComment(null)}
        targetType="comment"
        targetId={reportComment?.id ?? ''}
      />

      <ActionMenu
        visible={postMenuVisible}
        onClose={() => setPostMenuVisible(false)}
        options={[
          {
            key: 'report',
            label: 'Denunciar publicação',
            icon: 'flag-outline',
            destructive: true,
            onPress: () => setReportPostVisible(true),
          },
        ]}
      />
      <ReportModal
        visible={reportPostVisible}
        onClose={() => setReportPostVisible(false)}
        targetType="post"
        targetId={post?.id ?? ''}
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  commentAvatar: { width: 34, height: 34, borderRadius: 17 },
  commentBubble: {
    flex: 1,
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
