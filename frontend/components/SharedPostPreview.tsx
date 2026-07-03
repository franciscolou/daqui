import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Palette } from '../constants/Colors';
import { SharedPost } from '../lib/api';
import { formatPostTime } from '../lib/time';
import { useTheme, useThemedStyles } from '../lib/theme';

interface Props {
  post: SharedPost;
  // Quando true, apenas exibe (sem navegar) — usado na tela de encaminhar.
  static?: boolean;
}

// Prévia de um post compartilhado numa conversa (estilo "quote tweet").
export default function SharedPostPreview({ post, static: isStatic }: Props) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const body = (
    <>
      <View style={styles.authorRow}>
        <Image source={{ uri: post.author.avatar }} style={styles.avatar} />
        <Text style={styles.authorName} numberOfLines={1}>{post.author.name}</Text>
        {!!post.author.username && (
          <Text style={styles.authorUsername} numberOfLines={1}>@{post.author.username}</Text>
        )}
        <Text style={styles.dot}>·</Text>
        <Text style={styles.time}>{formatPostTime(post.createdAt)}</Text>
      </View>

      {!!post.title && <Text style={styles.title} numberOfLines={2}>{post.title}</Text>}
      {!!post.content && <Text style={styles.body} numberOfLines={3}>{post.content}</Text>}

      {!!post.image && (
        <Image source={{ uri: post.image }} style={styles.image} resizeMode="cover" />
      )}

      {!isStatic && (
        <View style={styles.footer}>
          <Ionicons name="open-outline" size={12} color={Colors.textTertiary} />
          <Text style={styles.footerText}>Ver post</Text>
        </View>
      )}
    </>
  );

  if (isStatic) return <View style={styles.card}>{body}</View>;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/post/${post.id}` as any)}
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
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  avatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.border },
  authorName: { fontSize: 13, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  authorUsername: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500', flexShrink: 1 },
  dot: { fontSize: 12, color: Colors.textTertiary },
  time: { fontSize: 12, color: Colors.textTertiary },
  title: { fontSize: 14, fontWeight: '800', color: Colors.text, letterSpacing: -0.2, marginTop: 2 },
  body: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  image: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: Colors.border,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  footerText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '600' },
});
