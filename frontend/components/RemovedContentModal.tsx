import { View, Text, StyleSheet, Image, Modal, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { CATEGORY_ICONS, CATEGORY_LABELS, PostCategory } from '../data/mock';
import { AppNotification } from '../lib/api';
import { useTheme, useThemedStyles } from '../lib/theme';

function formatFullDate(iso: string): string {
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  const date = new Date(hasTz ? iso : `${iso}Z`);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Mostra o que era um post/comentário removido pela moderação (não existe mais no app). */
export default function RemovedContentModal({
  notification,
  onClose,
}: {
  notification: AppNotification | null;
  onClose: () => void;
}) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const snapshot = notification?.snapshot;
  const isPost = notification?.type === 'post_removed';
  const catColor = snapshot?.category ? Colors.category[snapshot.category as PostCategory] : undefined;

  return (
    <Modal visible={!!notification} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} tabIndex={-1}>
        <Pressable style={styles.card} onPress={() => {}} tabIndex={-1}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isPost ? 'Post removido' : 'Comentário removido'}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {snapshot && (
            <View style={styles.body}>
              <View style={styles.metaRow}>
                {!!snapshot.category && (
                  <View style={[styles.catTag, { backgroundColor: (catColor ?? Colors.primary) + '18' }]}>
                    <Ionicons
                      name={(CATEGORY_ICONS[snapshot.category as PostCategory] ?? 'chatbubbles') as any}
                      size={11}
                      color={catColor ?? Colors.primary}
                    />
                    <Text style={[styles.catText, { color: catColor ?? Colors.primary }]}>
                      {CATEGORY_LABELS[snapshot.category as PostCategory] ?? snapshot.category}
                    </Text>
                  </View>
                )}
                <Text style={styles.date}>{formatFullDate(snapshot.createdAt)}</Text>
              </View>

              {!!snapshot.title && <Text style={styles.title}>{snapshot.title}</Text>}
              <Text style={styles.content}>{snapshot.content}</Text>

              {!!snapshot.imageUrl && (
                <Image source={{ uri: snapshot.imageUrl }} style={styles.image} resizeMode="cover" />
              )}

              {!!snapshot.location && (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={13} color={Colors.textTertiary} />
                  <Text style={styles.locationText}>{snapshot.location}</Text>
                </View>
              )}

              <View style={styles.noticeBox}>
                <Ionicons name="information-circle-outline" size={15} color={Colors.textTertiary} />
                <Text style={styles.noticeText}>
                  Este conteúdo foi removido pela moderação e não está mais disponível no app.
                </Text>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '85%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    ...Colors.shadow.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  closeBtn: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  catTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  catText: { fontSize: 11, fontWeight: '700' },
  date: { fontSize: 12, color: Colors.textTertiary },
  title: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  content: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: Colors.border,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  locationText: { fontSize: 12, color: Colors.textTertiary },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  noticeText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
});
