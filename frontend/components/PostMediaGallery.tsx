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
              <Tile key={i} item={item} style={i === 0 ? styles.halfLeft : styles.halfRight} onPress={() => open(i)} />
            ))}
          </View>
        )}

        {media.length === 3 && (
          <View style={styles.row}>
            <Tile item={media[0]} style={styles.halfLeft} onPress={() => open(0)} />
            <View style={[styles.half, styles.stack]}>
              <Tile item={media[1]} style={styles.stackTopTile} onPress={() => open(1)} />
              <Tile item={media[2]} style={styles.stackBottomTile} onPress={() => open(2)} />
            </View>
          </View>
        )}

        {media.length >= 4 && (
          <View style={styles.grid}>
            {visible.map((item, i) => (
              <Tile
                key={i}
                item={item}
                style={QUARTER_STYLES[i]}
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
  // Cada tile do mosaico declara seu próprio borderRadius (mesmo raio do
  // `wrap` que os clipa) nos cantos que efetivamente ficam arredondados —
  // sem isso, o hover/press do TouchableOpacity (que segue o borderRadius do
  // próprio elemento, não do pai que clipa) sai com cantos retos.
  single: { width: '100%', height: GALLERY_HEIGHT, borderRadius: 14 },
  row: { flexDirection: 'row', gap: 3, height: GALLERY_HEIGHT },
  half: { flex: 1 },
  halfLeft: { flex: 1, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  halfRight: { flex: 1, borderTopRightRadius: 14, borderBottomRightRadius: 14 },
  stack: { gap: 3 },
  stackTopTile: { flex: 1, borderTopRightRadius: 14 },
  stackBottomTile: { flex: 1, borderBottomRightRadius: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, height: GALLERY_HEIGHT * 1.4 },
  quarterTopLeft: { width: '49.3%', height: '49.3%', borderTopLeftRadius: 14 },
  quarterTopRight: { width: '49.3%', height: '49.3%', borderTopRightRadius: 14 },
  quarterBottomLeft: { width: '49.3%', height: '49.3%', borderBottomLeftRadius: 14 },
  quarterBottomRight: { width: '49.3%', height: '49.3%', borderBottomRightRadius: 14 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#fff', fontSize: 20, fontWeight: '800' },
});

// Posição de cada tile no grid 2×2 (4+ mídias) → canto que deve ficar
// arredondado, na mesma ordem em que `visible` é mapeado.
const QUARTER_STYLES = [
  styles.quarterTopLeft,
  styles.quarterTopRight,
  styles.quarterBottomLeft,
  styles.quarterBottomRight,
];
