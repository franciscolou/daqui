import { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ImageViewerModal, { MediaItem } from './ImageViewerModal';
import VideoPlayer from './VideoPlayer';

const GALLERY_HEIGHT = 200;
const MAX_VISIBLE = 4;

/** Mosaico de fotos/vídeos do post (1 a 10), no estilo Twitter/Instagram —
 * toca em qualquer item para abrir o visualizador em tela cheia, já no item
 * tocado. Vídeos tocam sozinhos (sem som) quando visíveis, como no feed. */
export default function PostMediaGallery({ media }: { media: MediaItem[] }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (media.length === 0) return null;

  const open = (index: number) => setViewerIndex(index);
  const visible = media.slice(0, MAX_VISIBLE);
  const extraCount = media.length - MAX_VISIBLE;

  return (
    <>
      <View style={styles.wrap}>
        {media.length === 1 && (
          <Tile item={media[0]} style={styles.single} onPress={() => open(0)} />
        )}

        {media.length === 2 && (
          <View style={styles.row}>
            {visible.map((item, i) => (
              <Tile key={i} item={item} style={styles.half} onPress={() => open(i)} />
            ))}
          </View>
        )}

        {media.length === 3 && (
          <View style={styles.row}>
            <Tile item={media[0]} style={styles.half} onPress={() => open(0)} />
            <View style={[styles.half, styles.stack]}>
              <Tile item={media[1]} style={styles.stackTile} onPress={() => open(1)} />
              <Tile item={media[2]} style={styles.stackTile} onPress={() => open(2)} />
            </View>
          </View>
        )}

        {media.length >= 4 && (
          <View style={styles.grid}>
            {visible.map((item, i) => (
              <Tile
                key={i}
                item={item}
                style={styles.quarter}
                onPress={() => open(i)}
                overlayCount={i === MAX_VISIBLE - 1 && extraCount > 0 ? extraCount : undefined}
              />
            ))}
          </View>
        )}
      </View>

      <ImageViewerModal
        media={media}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
}

function Tile({
  item,
  style,
  onPress,
  overlayCount,
}: {
  item: MediaItem;
  style: any;
  onPress: () => void;
  overlayCount?: number;
}) {
  return (
    <TouchableOpacity style={style} activeOpacity={0.9} onPress={onPress}>
      {item.type === 'video' ? (
        <VideoPlayer uri={item.url} style={styles.image} />
      ) : (
        <Image source={{ uri: item.url }} style={styles.image} resizeMode="cover" />
      )}
      {!!overlayCount && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>+{overlayCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10, borderRadius: 14, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  single: { width: '100%', height: GALLERY_HEIGHT },
  row: { flexDirection: 'row', gap: 3, height: GALLERY_HEIGHT },
  half: { flex: 1 },
  stack: { gap: 3 },
  stackTile: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, height: GALLERY_HEIGHT * 1.4 },
  quarter: { width: '49.3%', height: '49.3%' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#fff', fontSize: 20, fontWeight: '800' },
});
