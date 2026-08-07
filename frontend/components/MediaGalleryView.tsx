import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { api, GalleryMediaItem } from '../lib/api';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useT } from '../lib/i18n';
import ImageViewerModal from './ImageViewerModal';
import type { ChatTarget } from './ChatView';

const NUM_COLUMNS = 3;
const GAP = 3;

/** Galeria de fotos/vídeos já trocados numa conversa (DM) ou grupo — grade
 * estilo WhatsApp/Instagram, tocar abre o visualizador em tela cheia já no
 * item tocado (mesmo componente usado pelo mosaico de mídia dos posts). */
export default function MediaGalleryView({
  target,
  onBack,
}: {
  target: ChatTarget;
  onBack?: () => void;
}) {
  const { kind, id } = target;
  const { t } = useT();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [media, setMedia] = useState<GalleryMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const items = kind === 'dm' ? await api.getDmMedia(id) : await api.getGroupMedia(id);
      setMedia(items);
    } catch {
      setMedia([]);
    } finally {
      setLoading(false);
    }
  }, [kind, id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{t('mediaGallery.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : media.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="images-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyText}>{t('mediaGallery.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={media}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.85}
              onPress={() => setViewerIndex(index)}
            >
              {item.type === 'video' ? (
                <View style={[styles.tileImage, styles.videoTile]}>
                  <Ionicons name="play-circle" size={26} color="#fff" />
                </View>
              ) : (
                <Image source={{ uri: item.url }} style={styles.tileImage} resizeMode="cover" />
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <ImageViewerModal
        media={media}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  emptyText: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', maxWidth: 240 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: Colors.text },
  grid: { padding: GAP },
  row: { gap: GAP },
  tile: { flex: 1 / NUM_COLUMNS, aspectRatio: 1, marginBottom: GAP },
  tileImage: { width: '100%', height: '100%', backgroundColor: Colors.border },
  videoTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E293B' },
});
