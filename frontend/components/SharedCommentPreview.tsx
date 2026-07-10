import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Palette } from '../constants/Colors';
import { SharedComment } from '../lib/api';
import { formatPostTime } from '../lib/time';
import { useTheme, useThemedStyles } from '../lib/theme';

interface Props {
  comment: SharedComment;
  // Quando true, apenas exibe (sem navegar) — usado na tela de encaminhar.
  static?: boolean;
}

// Prévia de um comentário compartilhado numa conversa (leva ao post de origem).
export default function SharedCommentPreview({ comment, static: isStatic }: Props) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const body = (
    <>
      <View style={styles.tagRow}>
        <Ionicons name="chatbubble-ellipses-outline" size={12} color={Colors.textTertiary} />
        <Text style={styles.tagText}>Comentário</Text>
      </View>
      <View style={styles.authorRow}>
        <Image source={{ uri: comment.author.avatar }} style={styles.avatar} />
        <Text style={styles.authorName} numberOfLines={1}>{comment.author.name}</Text>
        {!!comment.author.username && (
          <Text style={styles.authorUsername} numberOfLines={1}>@{comment.author.username}</Text>
        )}
        <Text style={styles.dot}>·</Text>
        <Text style={styles.time}>{formatPostTime(comment.createdAt)}</Text>
      </View>

      {!!comment.content && <Text style={styles.body} numberOfLines={4}>{comment.content}</Text>}

      {!isStatic && (
        <View style={styles.footer}>
          <Ionicons name="open-outline" size={12} color={Colors.textTertiary} />
          <Text style={styles.footerText}>Ver no post</Text>
        </View>
      )}
    </>
  );

  if (isStatic) return <View style={styles.card}>{body}</View>;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/post/${comment.postId}` as any)}
    >
      {body}
    </TouchableOpacity>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 10,
    gap: 4,
    minWidth: 220,
  },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  avatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.border },
  authorName: { fontSize: 13, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  authorUsername: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500', flexShrink: 1 },
  dot: { fontSize: 12, color: Colors.textTertiary },
  time: { fontSize: 12, color: Colors.textTertiary },
  body: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  footerText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '600' },
});
