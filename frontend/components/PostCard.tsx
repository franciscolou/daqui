import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Palette } from '../constants/Colors';
import { Post, CATEGORY_ICONS } from '../data/mock';
import { api } from '../lib/api';
import { Ad, adsApi } from '../lib/adsApi';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useT } from '../lib/i18n';
import { activeLocale } from '../lib/time';
import ActionMenu from './ActionMenu';
import ConfirmModal from './ConfirmModal';
import HoverTime from './HoverTime';
import MentionText from './MentionText';
import PollBlock from './PollBlock';
import PostMediaGallery from './PostMediaGallery';
import ReportModal from './ReportModal';
import ResidentBadge from './ResidentBadge';
import SharedCommentPreview from './SharedCommentPreview';
import SharedPostPreview from './SharedPostPreview';
import SharedAdPreview from './SharedAdPreview';

interface PostCardProps {
  post: Post;
  onPress?: () => void;
  // Chamado após excluir o post com sucesso (menu de ações, só no próprio post)
  // — quem renderiza a lista remove o item localmente.
  onDeleted?: (postId: string) => void;
}

export default function PostCard({ post, onPress, onDeleted }: PostCardProps) {
  const { t } = useT();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.liked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [reposted, setReposted] = useState(!!post.reposted);
  const [sharesCount, setSharesCount] = useState(post.sharesCount);
  const [busy, setBusy] = useState(false);
  const [repostBusy, setRepostBusy] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [repostMenuVisible, setRepostMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const catColor = Colors.category[post.category] ?? Colors.primary;
  const isOwnPost = !!user && user.id === post.author.id;
  const [quotedAd, setQuotedAd] = useState<Ad | null>(null);

  useEffect(() => {
    if (post.quotedAdId == null) {
      setQuotedAd(null);
      return;
    }
    adsApi.getAdById(post.quotedAdId).then(setQuotedAd).catch(() => setQuotedAd(null));
  }, [post.quotedAdId]);

  const openPost = () => router.push(`/post/${post.id}` as any);

  const toggleLike = async () => {
    if (busy) return;
    // Atualização otimista, com rollback em caso de erro
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);
    setBusy(true);
    try {
      const updated = await api.toggleLike(post.id);
      setLiked(updated.liked);
      setLikesCount(updated.likesCount);
    } catch {
      setLiked(prevLiked);
      setLikesCount(prevCount);
    } finally {
      setBusy(false);
    }
  };

  const toggleRepost = async () => {
    if (repostBusy) return;
    const prevReposted = reposted;
    const prevCount = sharesCount;
    setReposted(!prevReposted);
    setSharesCount(prevReposted ? prevCount - 1 : prevCount + 1);
    setRepostBusy(true);
    try {
      const updated = await api.toggleRepost(post.id);
      setReposted(!!updated.reposted);
      setSharesCount(updated.sharesCount);
    } catch {
      setReposted(prevReposted);
      setSharesCount(prevCount);
    } finally {
      setRepostBusy(false);
    }
  };

  const quote = () => router.push(`/quote/${post.id}` as any);

  // Numa timeline com repost simples (banner "fulano repostou"), o cartão
  // inteiro — inclusive avatar/nome do autor original — leva ao detalhe do
  // post; só o nome de quem repostou (no banner) leva ao perfil dele.
  const goToAuthorOrPost = () => {
    if (post.repostedBy) {
      (onPress ?? openPost)();
    } else {
      router.push(`/user/${post.author.id}` as any);
    }
  };

  const doDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.deletePost(post.id);
      setConfirmDeleteVisible(false);
      onDeleted?.(post.id);
    } catch {
      // mantém o modal aberto para nova tentativa
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
    <TouchableOpacity style={styles.row} onPress={onPress ?? openPost} activeOpacity={0.92} focusable={false}>
      {/* Important bar on the left edge */}
      {post.important && <View style={styles.importantBar} />}

      {/* Banner "fulano repostou" (estilo Twitter) — só aparece na timeline
          do perfil, quando este item veio de um repost simples alheio. */}
      {!!post.repostedBy && (
        <TouchableOpacity
          style={styles.repostBanner}
          onPress={() => router.push(`/user/${post.repostedBy!.id}` as any)}
          activeOpacity={0.7}
          focusable={false}
        >
          <Ionicons name="repeat" size={13} color={Colors.textTertiary} />
          <Text style={styles.repostBannerText} numberOfLines={1}>
            {user && post.repostedBy.id === user.id
              ? t('post.repostedByYou')
              : t('post.repostedBy', { name: post.repostedBy.name })}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.contentRow}>
      {/* Left col: avatar */}
      <TouchableOpacity style={styles.leftCol} onPress={goToAuthorOrPost} activeOpacity={0.8} focusable={false}>
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
        </View>
      </TouchableOpacity>

      {/* Right col: everything else */}
      <View style={styles.rightCol}>
        {/* Author + meta row */}
        <View style={styles.topRow}>
          <View style={styles.authorMeta}>
            <TouchableOpacity onPress={goToAuthorOrPost} activeOpacity={0.7} focusable={false}>
              <Text style={styles.authorName} numberOfLines={1}>{post.author.name}</Text>
            </TouchableOpacity>
            {!!post.author.username && (
              <Text style={styles.authorUsername} numberOfLines={1}>@{post.author.username}</Text>
            )}
            {post.authorIsResident && <ResidentBadge />}
            <Text style={styles.dot}>·</Text>
            <HoverTime iso={post.createdAt} style={styles.time} />
            {!!post.distance && (
              <>
                <Text style={styles.dot}>·</Text>
                <Ionicons name="navigate-outline" size={11} color={Colors.textTertiary} />
                <Text style={styles.dist}>{post.distance}</Text>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => setMenuVisible(true)}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Category + pinned */}
        <View style={styles.tagRow}>
          <View style={[styles.catTag, { backgroundColor: catColor + '18' }]}>
            <Ionicons name={CATEGORY_ICONS[post.category] as any} size={10} color={catColor} />
            <Text style={[styles.catText, { color: catColor }]}>
              {t(`categories.${post.category}`)}
            </Text>
          </View>
          {post.important && (
            <View style={styles.importantTag}>
              <Ionicons name="alert-circle" size={10} color={Colors.error} />
              <Text style={styles.importantTagText}>{t('post.important')}</Text>
            </View>
          )}
          {post.pinned && (
            <View style={styles.pinnedTag}>
              <Ionicons name="pin" size={10} color={Colors.textTertiary} />
              <Text style={styles.pinnedTagText}>{t('post.pinned')}</Text>
            </View>
          )}
        </View>

        {/* Title */}
        {post.title && (
          <MentionText style={styles.title}>{post.title}</MentionText>
        )}

        {/* Body */}
        <MentionText style={styles.body} numberOfLines={4}>{post.content}</MentionText>

        {/* Enquete */}
        {post.poll && <PollBlock poll={post.poll} postId={post.id} />}

        {/* Campos específicos por categoria */}
        <PostDetails post={post} styles={styles} Colors={Colors} />

        {/* Fotos */}
        {!!post.media?.length && <PostMediaGallery media={post.media} />}

        {/* Citação (repost com comentário, estilo Twitter) */}
        {post.quotedComment ? (
          <SharedCommentPreview comment={post.quotedComment} />
        ) : post.quotedPost ? (
          <SharedPostPreview post={post.quotedPost} />
        ) : quotedAd ? (
          <SharedAdPreview ad={quotedAd} />
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={18}
              color={liked ? Colors.error : Colors.textTertiary}
            />
            <Text style={[styles.actionCount, liked && { color: Colors.error }]}>
              {likesCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={openPost}>
            <Ionicons name="chatbubble-outline" size={17} color={Colors.textTertiary} />
            <Text style={styles.actionCount}>{post.commentsCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => setRepostMenuVisible(true)}>
            <Ionicons
              name="repeat-outline"
              size={19}
              color={reposted ? Colors.primary : Colors.textTertiary}
            />
            <Text style={[styles.actionCount, reposted && { color: Colors.primary }]}>
              {sharesCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/forward/${post.id}` as any)}
          >
            <Ionicons name="arrow-redo-outline" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </TouchableOpacity>

    <ActionMenu
      visible={menuVisible}
      onClose={() => setMenuVisible(false)}
      options={
        isOwnPost
          ? [
              {
                key: 'delete',
                label: t('post.delete'),
                icon: 'trash-outline',
                destructive: true,
                onPress: () => setConfirmDeleteVisible(true),
              },
            ]
          : [
              {
                key: 'report',
                label: t('report.titles.post'),
                icon: 'flag-outline',
                destructive: true,
                onPress: () => setReportVisible(true),
              },
            ]
      }
    />
    <ActionMenu
      visible={repostMenuVisible}
      onClose={() => setRepostMenuVisible(false)}
      options={[
        {
          key: 'repost',
          label: reposted ? t('post.undoRepost') : t('post.repost'),
          icon: 'repeat-outline',
          onPress: toggleRepost,
        },
        {
          key: 'quote',
          label: t('post.quote'),
          icon: 'create-outline',
          onPress: quote,
        },
      ]}
    />
    <ReportModal
      visible={reportVisible}
      onClose={() => setReportVisible(false)}
      targetType="post"
      targetId={post.id}
    />
    <ConfirmModal
      visible={confirmDeleteVisible}
      title={t('post.deleteTitle')}
      message={t('post.deleteMessage')}
      confirmLabel={t('post.deleteConfirm')}
      destructive
      loading={deleting}
      onConfirm={doDelete}
      onClose={() => setConfirmDeleteVisible(false)}
    />
    </>
  );
}

function formatEventDates(dates: string[]): string {
  const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(activeLocale(), { day: '2-digit', month: '2-digit' });
  if (dates.length <= 2) return dates.map(fmt).join(', ');
  return `${dates.slice(0, 2).map(fmt).join(', ')} +${dates.length - 2}`;
}

function formatPrice(price: number): string {
  return price.toLocaleString(activeLocale(), { style: 'currency', currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function PostDetails({
  post,
  styles,
  Colors,
}: {
  post: Post;
  styles: ReturnType<typeof makeStyles>;
  Colors: Palette;
}) {
  const { t } = useT();
  const chips: ReactNode[] = [];

  if (post.category === 'evento' && post.eventDates?.length) {
    const label =
      formatEventDates(post.eventDates) +
      (post.allDay ? ` · ${t('post.allDay')}` : post.eventTime ? ` · ${post.eventTime}` : '');
    chips.push(
      <View key="date" style={styles.detailChip}>
        <Ionicons name="calendar-outline" size={12} color={Colors.primary} />
        <Text style={styles.detailChipText}>{label}</Text>
      </View>,
    );
  }

  if (post.category === 'venda') {
    const priceLabel = post.priceNegotiable
      ? t('publish.sale.negotiable')
      : typeof post.price === 'number'
      ? formatPrice(post.price)
      : null;
    if (priceLabel) {
      chips.push(
        <View key="price" style={styles.priceChip}>
          <Ionicons name="pricetag" size={12} color={Colors.primary} />
          <Text style={styles.priceChipText}>{priceLabel}</Text>
        </View>,
      );
    }
  }

  if (post.category === 'recomendacao' && post.placeName) {
    chips.push(
      <View key="place" style={styles.detailChip}>
        <Ionicons name="storefront-outline" size={12} color={Colors.primary} />
        <Text style={styles.detailChipText}>{post.placeName}</Text>
      </View>,
    );
  }

  if (post.location) {
    const hasCoords = post.latitude != null && post.longitude != null;
    chips.push(
      <TouchableOpacity
        key="loc"
        style={styles.detailChip}
        disabled={!hasCoords}
        activeOpacity={0.7}
        onPress={() =>
          router.push(
            `/(tabs)/map?focus=${post.id}&lat=${post.latitude}&lng=${post.longitude}` as any,
          )
        }
      >
        <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
        <Text style={styles.detailChipText}>{post.location}</Text>
      </TouchableOpacity>,
    );
  }

  if (chips.length === 0) return null;
  return <View style={styles.detailsRow}>{chips}</View>;
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  row: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  contentRow: { flexDirection: 'row' },
  repostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 60,
    marginBottom: 6,
  },
  repostBannerText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '700' },
  importantBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.error,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },

  /* Left column */
  leftCol: {
    width: 48,
    marginRight: 12,
    alignItems: 'center',
    // Sem isto, o item é esticado na vertical pelo contentRow e transforma
    // toda a faixa à esquerda do conteúdo em um link invisível para o perfil.
    alignSelf: 'flex-start',
  },
  avatarWrapper: { position: 'relative' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },

  /* Right column */
  rightCol: { flex: 1, minWidth: 0 },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  authorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
    flexWrap: 'nowrap',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flexShrink: 1,
  },
  authorUsername: { fontSize: 13, color: Colors.textTertiary, fontWeight: '500', flexShrink: 1 },
  dot: { fontSize: 13, color: Colors.textTertiary },
  time: { fontSize: 13, color: Colors.textTertiary },
  dist: { fontSize: 13, color: Colors.textTertiary },

  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  catTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catText: { fontSize: 11, fontWeight: '700' },
  importantTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.error + '15',
  },
  importantTagText: { fontSize: 11, fontWeight: '700', color: Colors.error },
  pinnedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
  },
  pinnedTagText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },

  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  body: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 10,
  },

  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.borderLight,
    maxWidth: '100%',
  },
  detailChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
  },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.primaryFaint,
  },
  priceChipText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '800',
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: -6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 4,
  },
  actionCount: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  iconBtn: {
    padding: 6,
    borderRadius: 14,
  },
});
