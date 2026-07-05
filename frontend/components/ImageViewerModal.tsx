import { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ImageViewerModalProps {
  images: string[];
  /** Índice inicial a exibir. */
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

/** Visualizador de foto em tela cheia, com swipe entre múltiplas fotos. */
export default function ImageViewerModal({ images, initialIndex = 0, visible, onClose }: ImageViewerModalProps) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<string>>(null);

  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(newIndex);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.header} pointerEvents="box-none">
          {images.length > 1 && (
            <Text style={styles.counter}>{index + 1} / {images.length}</Text>
          )}
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={images}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onMomentumScrollEnd}
          renderItem={({ item }) => (
            <Pressable style={[styles.page, { width, height }]} onPress={onClose}>
              <Image source={{ uri: item }} style={styles.image} resizeMode="contain" />
            </Pressable>
          )}
        />

        {images.length > 1 && (
          <View style={styles.dots} pointerEvents="none">
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingHorizontal: 20,
  },
  counter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    marginLeft: 'auto',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '80%',
  },
  dots: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 18,
  },
});
