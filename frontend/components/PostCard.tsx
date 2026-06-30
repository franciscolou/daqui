import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Post, CATEGORY_LABELS, CATEGORY_ICONS } from '../data/mock';
import { useState } from 'react';

interface PostCardProps {
  post: Post;
  onPress?: () => void;
}

export default function PostCard({ post, onPress }: PostCardProps) {
  const [liked, setLiked] = useState(post.liked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const catColor = Colors.category[post.category] ?? Colors.primary;

  const toggleLike = () => {
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);
  };

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.92}>
      {/* Urgent bar on the left edge */}
      {post.urgent && <View style={styles.urgentBar} />}

      {/* Left col: avatar */}
      <View style={styles.leftCol}>
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
          {post.author.verified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark" size={7} color="#fff" />
            </View>
          )}
        </View>
      </View>

      {/* Right col: everything else */}
      <View style={styles.rightCol}>
        {/* Author + meta row */}
        <View style={styles.topRow}>
          <View style={styles.authorMeta}>
            <Text style={styles.authorName} numberOfLines={1}>{post.author.name}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.time}>{post.createdAt}</Text>
            <Text style={styles.dot}>·</Text>
            <Ionicons name="navigate-outline" size={11} color={Colors.textTertiary} />
            <Text style={styles.dist}>{post.distance}</Text>
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
          {post.urgent && (
            <View style={styles.urgentTag}>
              <Ionicons name="alert-circle" size={10} color={Colors.error} />
              <Text style={styles.urgentTagText}>Urgente</Text>
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

          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={17} color={Colors.textTertiary} />
            <Text style={styles.actionCount}>{post.commentsCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="repeat-outline" size={19} color={Colors.textTertiary} />
            <Text style={styles.actionCount}>{post.sharesCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="share-outline" size={18} color={Colors.textTertiary} />
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

const styles = StyleSheet.create({
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
  urgentBar: {
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
  urgentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.error + '15',
  },
  urgentTagText: { fontSize: 11, fontWeight: '700', color: Colors.error },
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
