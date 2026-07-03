import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Palette } from '../constants/Colors';
import { Post, CATEGORY_LABELS, CATEGORY_ICONS } from '../data/mock';
import { api } from '../lib/api';
import { formatPostTime } from '../lib/time';
import { useState, type ReactNode } from 'react';
import { useTheme, useThemedStyles } from '../lib/theme';

interface PostCardProps {
  post: Post;
  onPress?: () => void;
}

export default function PostCard({ post, onPress }: PostCardProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [liked, setLiked] = useState(post.liked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [busy, setBusy] = useState(false);
  const catColor = Colors.category[post.category] ?? Colors.primary;

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

  return (
    <TouchableOpacity style={styles.row} onPress={onPress ?? openPost} activeOpacity={0.92}>
      {/* Important bar on the left edge */}
      {post.important && <View style={styles.importantBar} />}

      {/* Left col: avatar */}
      <TouchableOpacity style={styles.leftCol} onPress={() => router.push(`/user/${post.author.id}` as any)} activeOpacity={0.8}>
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
          {post.author.verified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark" size={7} color="#fff" />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Right col: everything else */}
      <View style={styles.rightCol}>
        {/* Author + meta row */}
        <View style={styles.topRow}>
          <View style={styles.authorMeta}>
            <TouchableOpacity onPress={() => router.push(`/user/${post.author.id}` as any)} activeOpacity={0.7}>
              <Text style={styles.authorName} numberOfLines={1}>{post.author.name}</Text>
            </TouchableOpacity>
            {!!post.author.username && (
              <Text style={styles.authorUsername} numberOfLines={1}>@{post.author.username}</Text>
            )}
            <Text style={styles.dot}>·</Text>
            <Text style={styles.time}>{formatPostTime(post.createdAt)}</Text>
            {!!post.distance && (
              <>
                <Text style={styles.dot}>·</Text>
                <Ionicons name="navigate-outline" size={11} color={Colors.textTertiary} />
                <Text style={styles.dist}>{post.distance}</Text>
              </>
            )}
          </View>
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Category + pinned */}
        <View style={styles.tagRow}>
          <View style={[styles.catTag, { backgroundColor: catColor + '18' }]}>
            <Ionicons name={CATEGORY_ICONS[post.category] as any} size={10} color={catColor} />
            <Text style={[styles.catText, { color: catColor }]}>
              {CATEGORY_LABELS[post.category]}
            </Text>
          </View>
          {post.important && (
            <View style={styles.importantTag}>
              <Ionicons name="alert-circle" size={10} color={Colors.error} />
              <Text style={styles.importantTagText}>Importante</Text>
            </View>
          )}
          {post.pinned && (
            <View style={styles.pinnedTag}>
              <Ionicons name="pin" size={10} color={Colors.textTertiary} />
              <Text style={styles.pinnedTagText}>Fixado</Text>
            </View>
          )}
        </View>

        {/* Title */}
        {post.title && (
          <Text style={styles.title}>{post.title}</Text>
        )}

        {/* Body */}
        <Text style={styles.body} numberOfLines={4}>{post.content}</Text>

        {/* Campos específicos por categoria */}
        <PostDetails post={post} styles={styles} Colors={Colors} />

        {/* Image */}
        {post.images?.[0] && (
          <Image
            source={{ uri: post.images[0] }}
            style={styles.image}
            resizeMode="cover"
          />
        )}

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

          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="repeat-outline" size={19} color={Colors.textTertiary} />
            <Text style={styles.actionCount}>{post.sharesCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/forward/${post.id}` as any)}
          >
            <Ionicons name="arrow-redo-outline" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="bookmark-outline" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function formatEventDates(dates: string[]): string {
  const fmt = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  };
  if (dates.length <= 2) return dates.map(fmt).join(', ');
  return `${dates.slice(0, 2).map(fmt).join(', ')} +${dates.length - 2}`;
}

function formatPrice(price: number): string {
  return `R$ ${price.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  const chips: ReactNode[] = [];

  if (post.category === 'evento' && post.eventDates?.length) {
    const label =
      formatEventDates(post.eventDates) +
      (post.allDay ? ' · Dia inteiro' : post.eventTime ? ` · ${post.eventTime}` : '');
    chips.push(
      <View key="date" style={styles.detailChip}>
        <Ionicons name="calendar-outline" size={12} color={Colors.primary} />
        <Text style={styles.detailChipText}>{label}</Text>
      </View>,
    );
  }

  if (post.category === 'venda') {
    const priceLabel = post.priceNegotiable
      ? 'Negociável'
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
    chips.push(
      <View key="loc" style={styles.detailChip}>
        <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
        <Text style={styles.detailChipText}>{post.location}</Text>
      </View>,
    );
  }

  if (chips.length === 0) return null;
  return <View style={styles.detailsRow}>{chips}</View>;
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
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
  },
  avatarWrapper: { position: 'relative' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.surface,
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
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  body: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 14,
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
});
