import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ImageViewerModalProps {
  images: string[];
  /** Índice inicial a exibir. */
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

const SWIPE_THRESHOLD = 50;

/** Visualizador de foto em tela cheia. Troca de foto por transposição
 * simples (crossfade), não por slide — via botões, teclado ou swipe. */
export default function ImageViewerModal({ images, initialIndex = 0, visible, onClose }: ImageViewerModalProps) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      opacity.setValue(1);
    }
  }, [visible, initialIndex, opacity]);

  const goTo = useCallback(
    (newIndex: number) => {
      const clamped = Math.max(0, Math.min(images.length - 1, newIndex));
      if (clamped === index) return;
      setIndex(clamped);
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    },
    [images.length, index, opacity],
  );

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(index + 1);
      else if (e.key === 'ArrowLeft') goTo(index - 1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, index, goTo, onClose]);

  // Fase de captura: assim que o gesto vira um arrasto horizontal, o pai
  // "rouba" o responder do Pressable filho (que trataria isso como clique).
  // Mesmo assim, no mouse o navegador dispara um "click" nativo no
  // mouseup independente da distância arrastada — por isso a flag abaixo
  // suprime o onPress do Pressable logo depois de um arrasto real.
  const suppressNextPressRef = useRef(false);

  const handleMoveShouldSetCapture = (_: unknown, gesture: { dx: number; dy: number }) =>
    Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy);

  const handleSwipeRelease = (_: unknown, gesture: { dx: number }) => {
    if (gesture.dx <= -SWIPE_THRESHOLD) {
      suppressNextPressRef.current = true;
      goTo(index + 1);
    } else if (gesture.dx >= SWIPE_THRESHOLD) {
      suppressNextPressRef.current = true;
      goTo(index - 1);
    }
  };

  // Recriado a cada render (barato, só um objeto com handlers).
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponderCapture: handleMoveShouldSetCapture,
    onPanResponderRelease: handleSwipeRelease,
  });

  const handlePageTap = () => {
    if (suppressNextPressRef.current) {
      suppressNextPressRef.current = false;
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} tabIndex={-1} />

        <View style={styles.header} pointerEvents="box-none">
          {images.length > 1 && (
            <Text style={styles.counter}>{index + 1} / {images.length}</Text>
          )}
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>

        <View style={{ width, height }} {...panResponder.panHandlers}>
          <Pressable style={[styles.page, StyleSheet.absoluteFill]} onPress={handlePageTap} tabIndex={-1}>
            <Animated.Image
              source={{ uri: images[index] }}
              style={[styles.image, { opacity }]}
              resizeMode="contain"
            />
          </Pressable>
        </View>

        {images.length > 1 && index > 0 && (
          <View style={[styles.navBtn, styles.navBtnLeft]} pointerEvents="box-none">
            <Pressable style={styles.navCircle} onPress={() => goTo(index - 1)} hitSlop={12}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>
          </View>
        )}
        {images.length > 1 && index < images.length - 1 && (
          <View style={[styles.navBtn, styles.navBtnRight]} pointerEvents="box-none">
            <Pressable style={styles.navCircle} onPress={() => goTo(index + 1)} hitSlop={12}>
              <Ionicons name="chevron-forward" size={26} color="#fff" />
            </Pressable>
          </View>
        )}

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
  navBtn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 2,
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnLeft: {
    left: 0,
  },
  navBtnRight: {
    right: 0,
  },
  navCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
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
