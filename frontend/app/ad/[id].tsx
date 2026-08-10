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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { User } from '../../data/mock';
import { api } from '../../lib/api';
import { Ad, AdComment, adsApi } from '../../lib/adsApi';
import { useAuth } from '../../lib/auth';
import { goBack } from '../../lib/navigation';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { submitOnEnter } from '../../lib/keyboard';
import { useT } from '../../lib/i18n';
import WideLayout from '../../components/WideLayout';
import HoverTime from '../../components/HoverTime';
import ActionMenu from '../../components/ActionMenu';
import ConfirmModal from '../../components/ConfirmModal';
import ReportModal from '../../components/ReportModal';
import VerifiedBadge from '../../components/VerifiedBadge';
import VideoPlayer from '../../components/VideoPlayer';

export default function AdDetailScreen() {
  const { t } = useT();
  const { id, creativeId } = useLocalSearchParams<{ id: string; creativeId?: string }>();
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const viewerUserId = user ? Number(user.id) : undefined;

  const [ad, setAd] = useState<Ad | null>(null);
  const [linkedUser, setLinkedUser] = useState<User | null>(null);
  const [comments, setComments] = useState<AdComment[]>([]);
  const [authors, setAuthors] = useState<Record<number, User>>({});
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(0);
  const [confirmDeleteComment, setConfirmDeleteComment] = useState<AdComment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [repostMenuVisible, setRepostMenuVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const campaignId = id ? Number(id) : undefined;
  const parsedCreativeId = creativeId ? Number(creativeId) : undefined;

  const load = useCallback(async () => {
    if (!campaignId) return;
    try {
      const [a, c] = await Promise.all([
        adsApi.getAdById(campaignId, { creativeId: parsedCreativeId, userId: viewerUserId }),
        adsApi.listAdComments(campaignId),
      ]);
      setAd(a);
      setLiked(a.liked);
      setLikesCount(a.likesCount);
      setReposted(a.reposted);
      setRepostsCount(a.repostsCount);
      setComments(c);
      if (a.linkedUserId) {
        api.getUser(String(a.linkedUserId)).then(setLinkedUser).catch(() => setLinkedUser(null));
      } else {
        setLinkedUser(null);
      }
      const uniqueIds = [...new Set(c.map((item) => item.userId))];
      const resolved = await Promise.all(
        uniqueIds.map((uid) => api.getUser(String(uid)).catch(() => null)),
      );
      setAuthors((prev) => {
        const next = { ...prev };
        uniqueIds.forEach((uid, i) => {
          const resolvedUser = resolved[i];
          if (resolvedUser) next[uid] = resolvedUser;
        });
        return next;
      });
    } catch {
      setAd(null);
    } finally {
      setLoading(false);
    }
  }, [campaignId, parsedCreativeId, viewerUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleLike = async () => {
    if (!ad || !campaignId || viewerUserId == null) return;
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);
    try {
      const updated = await adsApi.toggleAdLike(campaignId, {
        userId: viewerUserId,
        creativeId: ad.creativeId,
      });
      setLiked(updated.liked);
      setLikesCount(updated.likesCount);
    } catch {
      setLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  const toggleRepost = async () => {
    if (!ad || !campaignId || viewerUserId == null) return;
    const prevReposted = reposted;
    const prevCount = repostsCount;
    setReposted(!prevReposted);
    setRepostsCount(prevReposted ? prevCount - 1 : prevCount + 1);
    try {
      const updated = await adsApi.toggleAdRepost(campaignId, {
        userId: viewerUserId,
        creativeId: ad.creativeId,
      });
      setReposted(updated.reposted);
      setRepostsCount(updated.repostsCount);
    } catch {
      setReposted(prevReposted);
      setRepostsCount(prevCount);
    }
  };

  const openMedia = () => {
    if (!ad) return;
    adsApi.trackAdClick(ad.id, { viewerId: undefined, creativeId: ad.creativeId, format: 'post' });
    Linking.openURL(ad.targetUrl);
  };

  const submit = async () => {
    const content = text.trim();
    if (!content || sending || !campaignId || viewerUserId == null) return;
    setSending(true);
    try {
      const created = await adsApi.addAdComment(campaignId, { userId: viewerUserId, content });
      setText('');
      setComments((prev) => [created, ...prev]);
      setAd((prev) => (prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : prev));
      if (user && !authors[created.userId]) {
        setAuthors((prev) => ({ ...prev, [created.userId]: user }));
      }
    } catch {
      // mantém o texto para nova tentativa
    } finally {
      setSending(false);
    }
  };

  const doDeleteComment = async () => {
    const comment = confirmDeleteComment;
    if (!comment || deleting || !campaignId || viewerUserId == null) return;
    setDeleting(true);
    try {
      await adsApi.deleteAdComment(campaignId, comment.id, viewerUserId);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      setAd((prev) => (prev ? { ...prev, commentsCount: Math.max(0, prev.commentsCount - 1) } : prev));
      setConfirmDeleteComment(null);
    } catch {
      // mantém o modal aberto para nova tentativa
    } finally {
      setDeleting(false);
    }
  };

  const mediaUrl = ad?.videoUrl || ad?.imageUrl;
  const mediaType: 'image' | 'video' = ad?.videoUrl ? 'video' : 'image';

  const renderComment = ({ item }: { item: AdComment }) => {
    const author = authors[item.userId];
    const isOwn = viewerUserId === item.userId;
    return (
      <View style={styles.comment}>
        <TouchableOpacity
          style={styles.commentAvatarBtn}
          onPress={() => author && router.push(`/user/${author.username}` as any)}
        >
          {author ? (
            <Image source={{ uri: author.avatar }} style={styles.commentAvatar} />
          ) : (
            <View style={[styles.commentAvatar, styles.commentAvatarFallback]} />
          )}
        </TouchableOpacity>
        <View style={styles.commentMain}>
          <View style={styles.commentBubble}>
            <View style={styles.commentHead}>
              <TouchableOpacity
                onPress={() => author && router.push(`/user/${author.username}` as any)}
                activeOpacity={0.7}
                focusable={false}
              >
                <Text style={styles.commentAuthor} numberOfLines={1}>
                  {author?.name ?? 'Usuário'}
                </Text>
              </TouchableOpacity>
              {!!author?.username && (
                <Text style={styles.commentUsername} numberOfLines={1}>@{author.username}</Text>
              )}
              <HoverTime iso={item.createdAt} style={styles.commentTime} />
              {isOwn && (
                <TouchableOpacity
                  style={[styles.iconBtn, styles.commentMenuBtn]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => setConfirmDeleteComment(item)}
                >
                  <Ionicons name="trash-outline" size={14} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.commentText}>{item.content}</Text>
          </View>
        </View>
      </View>
    );
  };

  const header = ad && (
    <View>
      <View style={styles.adBlock}>
        {linkedUser ? (
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.headerRowLeft}
              onPress={() => router.push(`/user/${linkedUser.username}` as any)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: linkedUser.avatar }} style={styles.avatar} />
              <View style={styles.headerMeta}>
                <Text style={styles.authorName} numberOfLines={1}>{linkedUser.name}</Text>
                {!!linkedUser.username && (
                  <Text style={styles.authorUsername} numberOfLines={1}>@{linkedUser.username}</Text>
                )}
                {linkedUser.verified && <VerifiedBadge size={13} />}
                <Text style={styles.dot}>·</Text>
                <Text style={styles.sponsoredText}>{t('ads.sponsored')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.tagRow}>
            <View style={styles.adTag}>
              <Ionicons name="megaphone-outline" size={11} color={Colors.accent} />
              <Text style={styles.adTagText}>{t('ads.ad')}</Text>
            </View>
          </View>
        )}

        <Text style={styles.title}>{ad.title}</Text>
        <Text style={styles.body}>{ad.content}</Text>

        {!!mediaUrl && (
          <TouchableOpacity activeOpacity={0.9} onPress={openMedia}>
            {mediaType === 'video' ? (
              <VideoPlayer uri={mediaUrl} style={styles.image} />
            ) : (
              <Image source={{ uri: mediaUrl }} style={styles.image} />
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.ctaRow} onPress={openMedia}>
          <Text style={styles.ctaText}>{ad.ctaLabel || t('ads.learnMore')}</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleLike} hitSlop={8}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={20}
              color={liked ? Colors.error : Colors.textTertiary}
            />
            <Text style={[styles.actionCount, liked && { color: Colors.error }]}>{likesCount}</Text>
          </TouchableOpacity>
          <View style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={18} color={Colors.textTertiary} />
            <Text style={styles.actionCount}>{ad.commentsCount}</Text>
          </View>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setRepostMenuVisible(true)}>
            <Ionicons
              name="repeat-outline"
              size={19}
              color={reposted ? Colors.primary : Colors.textTertiary}
            />
            <Text style={[styles.actionCount, reposted && { color: Colors.primary }]}>
              {repostsCount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/forward/${ad.id}?kind=ad` as any)}
          >
            <Ionicons name="arrow-redo-outline" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.commentsTitle}>Comentários</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WideLayout showMobileMenu={false}>
        <View style={styles.column}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.topBarIconBtn} onPress={() => goBack('/')} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>{t('ads.ad')}</Text>
            <TouchableOpacity
              style={styles.topBarIconBtn}
              onPress={() => setMenuVisible(true)}
              hitSlop={10}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : !ad ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>Anúncio não encontrado.</Text>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <FlatList
                data={comments}
                keyExtractor={(item) => String(item.id)}
                ListHeaderComponent={header}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
                ListEmptyComponent={
                  <Text style={styles.noComments}>Nenhum comentário ainda.</Text>
                }
                renderItem={renderComment}
              />

              <View style={styles.composer}>
                <Image source={{ uri: user?.avatar }} style={styles.composerAvatar} />
                <TextInput
                  ref={inputRef}
                  style={styles.composerInput}
                  placeholder="Comente..."
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
        visible={repostMenuVisible}
        onClose={() => setRepostMenuVisible(false)}
        options={[
          {
            key: 'repost',
            label: reposted ? 'Desfazer repost' : 'Repostar',
            icon: 'repeat-outline',
            onPress: toggleRepost,
          },
          {
            key: 'quote',
            label: 'Citar',
            icon: 'create-outline',
            onPress: () => ad && router.push(`/quote/${ad.id}?kind=ad` as any),
          },
        ]}
      />

      <ActionMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        options={[
          {
            key: 'report',
            label: t('report.titles.ad'),
            icon: 'flag-outline',
            destructive: true,
            onPress: () => setReportVisible(true),
          },
        ]}
      />
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        targetType="ad"
        targetId={campaignId ? String(campaignId) : ''}
      />

      <ConfirmModal
        visible={!!confirmDeleteComment}
        title="Apagar comentário"
        message="Tem certeza que deseja apagar este comentário?"
        confirmLabel="Apagar"
        destructive
        loading={deleting}
        onConfirm={doDeleteComment}
        onClose={() => setConfirmDeleteComment(null)}
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

  adBlock: { paddingHorizontal: 16, paddingTop: 14 },
  tagRow: { flexDirection: 'row', marginBottom: 10 },
  adTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.accentLight,
  },
  adTagText: { fontSize: 11, fontWeight: '700', color: Colors.accent },

  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, flexWrap: 'wrap' },
  authorName: { fontSize: 15, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  authorUsername: { fontSize: 13, color: Colors.textTertiary, fontWeight: '500', flexShrink: 1 },
  dot: { fontSize: 13, color: Colors.textTertiary },
  sponsoredText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '600' },

  title: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 6, letterSpacing: -0.2 },
  body: { fontSize: 15, color: Colors.text, lineHeight: 22, marginBottom: 12 },
  image: { width: '100%', height: 240, borderRadius: 12, marginBottom: 12, backgroundColor: Colors.borderLight },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, alignSelf: 'flex-start' },
  ctaText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

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
  iconBtn: { padding: 6, borderRadius: 14 },

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
  commentAvatarBtn: { borderRadius: 17, alignSelf: 'flex-start' },
  commentAvatar: { width: 34, height: 34, borderRadius: 17 },
  commentAvatarFallback: { backgroundColor: Colors.borderLight },
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
  commentMenuBtn: { marginLeft: 'auto' },

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
