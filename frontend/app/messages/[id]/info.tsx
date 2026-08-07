import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../../../constants/Colors';
import { api } from '../../../lib/api';
import { User } from '../../../data/mock';
import { goBack } from '../../../lib/navigation';
import { useT } from '../../../lib/i18n';
import { useTheme, useThemedStyles } from '../../../lib/theme';
import FeedLayout from '../../../components/FeedLayout';
import ImageViewerModal from '../../../components/ImageViewerModal';
import NotificationMuteRow from '../../../components/NotificationMuteRow';
import VerifiedBadge from '../../../components/VerifiedBadge';

// Configurações da conversa (DM) — mesmo papel do "Informações do grupo"
// (app/groups/[id]/info.tsx), só que para uma conversa individual: aberta ao
// tocar no cabeçalho do chat (ver ChatView::openInfo) em vez de ir direto
// pro perfil do destinatário. O perfil continua a um toque de distância
// (linha "Ver perfil completo" abaixo).
export default function DmInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();

  const [other, setOther] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarVisible, setAvatarVisible] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setOther(await api.getUser(id));
    } catch {
      setOther(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <FeedLayout showMobileMenu={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBack(`/messages/${id}` as any)}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('conversationInfo.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : !other || !id ? (
        <View style={styles.center}>
          <Text style={styles.emptyDesc}>{t('conversationInfo.notFound')}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {/* Cartão do destinatário */}
          <View style={styles.hero}>
            <TouchableOpacity
              style={styles.heroAvatarTouchable}
              activeOpacity={0.85}
              onPress={() => setAvatarVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('conversationInfo.viewPhoto', { name: other.name })}
            >
              <Image source={{ uri: other.avatar }} style={styles.heroAvatar} />
            </TouchableOpacity>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName}>{other.name}</Text>
              {other.verified && <VerifiedBadge size={16} />}
            </View>
            <View style={styles.heroMetaRow}>
              <Text style={styles.heroUsername}>@{other.username}</Text>
              {!!other.neighborhood && (
                <>
                  <Text style={styles.heroDot}>·</Text>
                  <Text style={styles.heroNeighborhood}>{other.neighborhood}</Text>
                </>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => router.push(`/user/${other.id}` as any)}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="person-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.label}>{t('conversationInfo.viewProfile')}</Text>
            <View style={styles.flex} />
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, styles.rowSpacing]}
            activeOpacity={0.7}
            onPress={() => router.push(`/messages/${id}/media` as any)}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="images-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.label}>{t('mediaGallery.title')}</Text>
            <View style={styles.flex} />
            <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.gap} />

          <NotificationMuteRow kind="dm" id={other.id} />
        </ScrollView>
      )}

      {other && (
        <ImageViewerModal
          media={[{ url: other.avatar, type: 'image' }]}
          visible={avatarVisible}
          onClose={() => setAvatarVisible(false)}
        />
      )}
    </FeedLayout>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap: { height: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
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
  body: { padding: 16, paddingBottom: 48 },
  emptyDesc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center' },

  hero: { alignItems: 'center', gap: 6, paddingVertical: 12, marginBottom: 18 },
  heroAvatarTouchable: { borderRadius: 28 },
  heroAvatar: { width: 88, height: 88, borderRadius: 28, backgroundColor: Colors.border },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  heroName: { fontSize: 18, fontWeight: '800', color: Colors.text },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroUsername: { fontSize: 13, color: Colors.textTertiary },
  heroDot: { fontSize: 13, color: Colors.textTertiary },
  heroNeighborhood: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  rowSpacing: { marginTop: 10 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFaint,
  },
  label: { fontSize: 15, fontWeight: '600', color: Colors.text },
});
