import { View, Text, StyleSheet, TouchableOpacity, Pressable, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { Ad, adsApi } from '../lib/adsApi';
import { api } from '../lib/api';
import { User } from '../data/mock';
import VideoPlayer from './VideoPlayer';
import VerifiedBadge from './VerifiedBadge';
import ActionMenu from './ActionMenu';
import { useT } from '../lib/i18n';

// Card de anúncio no feed — mesmo formato visual de um PostCard, mas com
// dados de uma campanha (não um Post real). "Twitter-like": tocar no corpo
// do card abre o detalhe do anúncio (comentários/curtidas/reposts/encaminhar,
// ver app/ad/[id].tsx); só tocar na mídia abre o link externo do anunciante.
// Quando o criativo está vinculado a uma conta do Daqui (`ad.linkedUserId`),
// ganha um cabeçalho de post de verdade (avatar/nome/selo de verificado) +
// aviso "Patrocinado", em vez da tag genérica "Anúncio".
export default function AdPostCard({
  ad,
  viewerId,
  viewerUserId,
}: {
  ad: Ad;
  viewerId?: string;
  // Id real do usuário logado no Daqui (distinto do `viewerId` anônimo acima,
  // usado só pra impressão/clique) — necessário pra curtir/comentar/repostar.
  viewerUserId?: string;
}) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const [linkedUser, setLinkedUser] = useState<User | null>(null);
  const [liked, setLiked] = useState(ad.liked);
  const [likesCount, setLikesCount] = useState(ad.likesCount);
  const [reposted, setReposted] = useState(ad.reposted);
  const [repostsCount, setRepostsCount] = useState(ad.repostsCount);
  const [repostMenuVisible, setRepostMenuVisible] = useState(false);

  useEffect(() => {
    if (!ad.linkedUserId) {
      setLinkedUser(null);
      return;
    }
    api.getUser(String(ad.linkedUserId)).then(setLinkedUser).catch(() => setLinkedUser(null));
  }, [ad.linkedUserId]);

  const openDetail = () => {
    router.push(`/ad/${ad.id}?creativeId=${ad.creativeId}` as any);
  };

  const openMedia = () => {
    adsApi.trackAdClick(ad.id, { viewerId, creativeId: ad.creativeId, format: 'post' });
    Linking.openURL(ad.targetUrl);
  };

  const toggleLike = () => {
    if (!viewerUserId) return;
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);
    adsApi
      .toggleAdLike(ad.id, { userId: Number(viewerUserId), creativeId: ad.creativeId })
      .then((updated) => {
        setLiked(updated.liked);
        setLikesCount(updated.likesCount);
      })
      .catch(() => {
        setLiked(prevLiked);
        setLikesCount(prevCount);
      });
  };

  const toggleRepost = () => {
    if (!viewerUserId) return;
    const prevReposted = reposted;
    const prevCount = repostsCount;
    setReposted(!prevReposted);
    setRepostsCount(prevReposted ? prevCount - 1 : prevCount + 1);
    adsApi
      .toggleAdRepost(ad.id, { userId: Number(viewerUserId), creativeId: ad.creativeId })
      .then((updated) => {
        setReposted(updated.reposted);
        setRepostsCount(updated.repostsCount);
      })
      .catch(() => {
        setReposted(prevReposted);
        setRepostsCount(prevCount);
      });
  };

  const mediaUrl = ad.videoUrl || ad.imageUrl;
  const mediaType: 'image' | 'video' = ad.videoUrl ? 'video' : 'image';

  return (
    // `tabIndex={-1}` (via cast — RNW aceita a prop, mas o tipo do RN não
    // declara) tira este Pressable da regra de hover global (ver
    // lib/globalStyles.web.ts). Toques em filhos com seu próprio
    // Touchable/Pressable (mídia, botões da barra de ações) são capturados
    // por eles, não chegam a disparar este onPress.
    <Pressable
      onPress={openDetail}
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
            <Text style={styles.sponsoredText}>{t('ads.sponsored')}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.tagRow}>
          <View style={styles.adTag}>
            <Ionicons name="megaphone-outline" size={11} color={Colors.accent} />
            <Text style={styles.adTagText}>{t('ads.ad')}</Text>
          </View>
        </View>
      )}
      <Text style={styles.title}>{ad.title}</Text>
      <Text style={styles.body} numberOfLines={4}>{ad.content}</Text>

      {!!mediaUrl && (
        <TouchableOpacity activeOpacity={0.9} onPress={openMedia}>
          {mediaType === 'video' ? (
            <VideoPlayer uri={mediaUrl} style={styles.image} />
          ) : (
            <Image source={{ uri: mediaUrl }} style={styles.image} />
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.ctaRow} onPress={openMedia}>
        <Text style={styles.ctaText}>{ad.ctaLabel || t('ads.learnMore')}</Text>
        <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={18}
            color={liked ? Colors.error : Colors.textTertiary}
          />
          <Text style={[styles.actionCount, liked && { color: Colors.error }]}>{likesCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={openDetail}>
          <Ionicons name="chatbubble-outline" size={17} color={Colors.textTertiary} />
          <Text style={styles.actionCount}>{ad.commentsCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => setRepostMenuVisible(true)}>
          <Ionicons
            name="repeat-outline"
            size={19}
            color={reposted ? Colors.primary : Colors.textTertiary}
          />
          <Text style={[styles.actionCount, reposted && { color: Colors.primary }]}>
            {repostsCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push(`/forward/${ad.id}?kind=ad` as any)}
        >
          <Ionicons name="arrow-redo-outline" size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <ActionMenu
        visible={repostMenuVisible}
        onClose={() => setRepostMenuVisible(false)}
        options={[
          {
            key: 'repost',
            label: reposted ? 'Desfazer repost' : 'Repostar',
            icon: 'repeat-outline',
            onPress: toggleRepost,
          },
          {
            key: 'quote',
            label: 'Citar',
            icon: 'create-outline',
            onPress: () => router.push(`/quote/${ad.id}?kind=ad` as any),
          },
        ]}
      />
    </Pressable>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  row: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
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
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ctaText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 4,
  },
  actionCount: { fontSize: 13, color: Colors.textTertiary, fontWeight: '600' },
});
