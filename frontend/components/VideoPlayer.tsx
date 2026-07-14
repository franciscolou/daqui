import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Platform, StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

interface VideoPlayerProps {
  uri: string;
  style?: StyleProp<ViewStyle>;
  /** Some quando a bandeja de som some (ex.: já tem outros controles por perto). */
  hideMuteToggle?: boolean;
  /** 'cover' (padrão, miniaturas de feed) ou 'contain' (visualizador em tela cheia). */
  contentFit?: 'cover' | 'contain';
}

/** Player de vídeo de post/anúncio: toca sozinho (sem som) quando pelo menos
 * metade do vídeo entra na tela, pausa quando sai, e tem um botão no canto
 * inferior direito para ligar/desligar o som — mesma interação em qualquer
 * lugar que usar este componente (feed, anúncio, visualizador em tela cheia). */
export default function VideoPlayer({ uri, style, hideMuteToggle, contentFit = 'cover' }: VideoPlayerProps) {
  const containerRef = useRef<View>(null);
  // Nativo não tem IntersectionObserver: toca assim que monta (a virtualização
  // da lista já cuida de montar/desmontar fora da tela).
  const [isVisible, setIsVisible] = useState(Platform.OS !== 'web');
  const [muted, setMuted] = useState(true);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof IntersectionObserver === 'undefined') return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.intersectionRatio >= 0.5),
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible) player.play();
    else player.pause();
  }, [isVisible, player]);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      player.muted = next;
      return next;
    });
  };

  return (
    <View ref={containerRef} style={[styles.container, style]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit={contentFit}
        nativeControls={false}
        pointerEvents="none"
      />
      {!hideMuteToggle && (
        <View style={styles.muteBtnWrap}>
          <Pressable
            style={({ hovered }) => [styles.muteBtn, hovered && styles.muteBtnHover]}
            onPress={toggleMute}
            hitSlop={8}
          >
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  muteBtnWrap: {
    position: 'absolute',
    right: 10,
    bottom: 10,
  },
  muteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  muteBtnHover: { backgroundColor: 'rgba(0,0,0,0.75)' },
});
