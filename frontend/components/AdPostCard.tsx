import { View, Text, StyleSheet, Pressable, Image, Linking, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { Ad, adsApi } from '../lib/adsApi';
import { api } from '../lib/api';
import { User } from '../data/mock';
import VideoPlayer from './VideoPlayer';
import VerifiedBadge from './VerifiedBadge';
import ImageViewerModal from './ImageViewerModal';

// Card de anúncio no feed — mesmo formato visual de um PostCard, mas com
// dados de uma campanha (não um Post real) e link externo em vez de rota
// interna. Quando o criativo está vinculado a uma conta do Daqui
// (`ad.linkedUserId`), ganha um cabeçalho de post de verdade (avatar/nome/
// selo de verificado) + aviso "Patrocinado", em vez da tag genérica "Anúncio".
export default function AdPostCard({ ad, viewerId }: { ad: Ad; viewerId?: string }) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [linkedUser, setLinkedUser] = useState<User | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [mediaRange, setMediaRange] = useState<{ top: number; bottom: number } | null>(null);

  useEffect(() => {
    if (!ad.linkedUserId) {
      setLinkedUser(null);
      return;
    }
    api.getUser(String(ad.linkedUserId)).then(setLinkedUser).catch(() => setLinkedUser(null));
  }, [ad.linkedUserId]);

  const open = () => {
    adsApi.trackAdClick(ad.id, { viewerId, creativeId: ad.creativeId, format: 'post' });
    Linking.openURL(ad.targetUrl);
  };

  const mediaUrl = ad.videoUrl || ad.imageUrl;
  const mediaType: 'image' | 'video' = ad.videoUrl ? 'video' : 'image';

  // Roteia o toque dentro de um único Pressable (o card inteiro) em vez de
  // aninhar um segundo Pressable só pra mídia: o RNW trata cada Pressable
  // como uma área de hover isolada (aninhar quebra o "hover de um filho
  // conta como hover do pai" que a gente esperaria de CSS puro — testado),
  // então dois Pressables aqui deixariam a mídia sem highlight nenhum. Com
  // um só, o hover cobre o bloco inteiro de graça; o toque na mídia (faixa
  // vertical medida via onLayout) abre o visualizador em vez do link.
  const handlePress = (e: GestureResponderEvent) => {
    const y = e.nativeEvent.locationY;
    if (mediaUrl && mediaRange && y >= mediaRange.top && y <= mediaRange.bottom) {
      setViewerOpen(true);
    } else {
      open();
    }
  };

  return (
    // `tabIndex={-1}` (via cast — RNW aceita a prop, mas o tipo do RN não
    // declara) tira este Pressable da regra de hover global (ver
    // lib/globalStyles.web.ts: por-elemento, com transição suave, boa pra
    // botões pequenos mas fragmentada/lenta demais num card grande). O
    // hover vira 100% local: `styles.rowHovered`, sem `transition`, aplica
    // de uma vez só no bloco inteiro.
    <Pressable
      onPress={handlePress}
      style={({ hovered }) => [styles.row, hovered && styles.rowHovered]}
      {...({ tabIndex: -1 } as any)}
    >
      {linkedUser ? (
        <View style={styles.headerRow}>
          <Image source={{ uri: linkedUser.avatar }} style={styles.avatar} />
          <View style={styles.headerMeta}>
            <Text style={styles.authorName} numberOfLines={1}>{linkedUser.name}</Text>
            {!!linkedUser.username && (
              <Text style={styles.authorUsername} numberOfLines={1}>@{linkedUser.username}</Text>
            )}
            {linkedUser.verified && <VerifiedBadge size={13} />}
            <Text style={styles.dot}>·</Text>
            <Text style={styles.sponsoredText}>Patrocinado</Text>
          </View>
        </View>
      ) : (
        <View style={styles.tagRow}>
          <View style={styles.adTag}>
            <Ionicons name="megaphone-outline" size={11} color={Colors.accent} />
            <Text style={styles.adTagText}>Anúncio</Text>
          </View>
        </View>
      )}
      <Text style={styles.title}>{ad.title}</Text>
      <Text style={styles.body} numberOfLines={4}>{ad.content}</Text>

      {!!mediaUrl && (
        <View onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          setMediaRange({ top: y, bottom: y + height });
        }}>
          {mediaType === 'video' ? (
            <VideoPlayer uri={mediaUrl} style={styles.image} />
          ) : (
            <Image source={{ uri: mediaUrl }} style={styles.image} />
          )}
        </View>
      )}

      <View style={styles.ctaRow}>
        <Text style={styles.ctaText}>{ad.ctaLabel || 'Saiba mais'}</Text>
        <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
      </View>

      {!!mediaUrl && (
        <ImageViewerModal
          media={[{ url: mediaUrl, type: mediaType }]}
          visible={viewerOpen}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </Pressable>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  row: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  // Sem `transition` de propósito — troca de cor de uma vez só ao passar o
  // mouse, não suave (ver comentário acima do Pressable).
  rowHovered: { backgroundColor: Colors.borderLight },
  tagRow: { flexDirection: 'row', marginBottom: 8 },
  adTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.accentLight,
  },
  adTagText: { fontSize: 11, fontWeight: '700', color: Colors.accent },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, flexWrap: 'wrap' },
  authorName: { fontSize: 14, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  authorUsername: { fontSize: 13, color: Colors.textTertiary, fontWeight: '500', flexShrink: 1 },
  dot: { fontSize: 13, color: Colors.textTertiary },
  sponsoredText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '600' },

  title: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 4, letterSpacing: -0.2 },
  body: { fontSize: 14, color: Colors.text, lineHeight: 20, marginBottom: 10 },
  image: { width: '100%', height: 180, borderRadius: 12, marginBottom: 10, backgroundColor: Colors.borderLight },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctaText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
