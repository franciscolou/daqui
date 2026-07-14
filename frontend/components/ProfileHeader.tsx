import { ReactNode, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { User } from '../data/mock';
import { useTheme, useThemedStyles } from '../lib/theme';
import ImageViewerModal from './ImageViewerModal';

interface ProfileHeaderProps {
  user: User;
  isWide: boolean;
  onBack?: () => void;
  onMenu?: () => void;
  actions?: ReactNode;
}

const AVATAR_SIZE = 84;

/** Cabeçalho de perfil (próprio ou de outro usuário), no esquema de capa +
 * avatar recuado à esquerda do Twitter/Instagram: a foto fica sobre a capa,
 * alinhada à esquerda, e as informações seguem abaixo dela em ordem de
 * importância (nome, @usuário, bio, localização, estatísticas). Compartilhado
 * entre a aba "Perfil" e a tela de perfil de outro usuário. */
export default function ProfileHeader({ user, isWide, onBack, onMenu, actions }: ProfileHeaderProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [avatarVisible, setAvatarVisible] = useState(false);

  const location = user.locked
    ? 'Vizinho de outro bairro'
    : [user.neighborhood, [user.city, user.state].filter(Boolean).join(' - ')]
        .filter(Boolean)
        .join(', ');

  return (
    <View style={[styles.container, isWide && styles.containerWide]}>
      <View style={styles.coverWrap}>
        {user.cover ? (
          <Image source={{ uri: user.cover }} style={styles.coverImage} />
        ) : (
          <LinearGradient
            colors={[Colors.primaryLight, Colors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {(onBack || onMenu) && (
          <View style={styles.topRow} pointerEvents="box-none">
            {onBack ? (
              <TouchableOpacity style={styles.iconBtn} onPress={onBack} hitSlop={6}>
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.iconBtn} />
            )}
            {onMenu ? (
              <TouchableOpacity style={styles.iconBtn} onPress={onMenu} hitSlop={6}>
                <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.iconBtn} />
            )}
          </View>
        )}

        <View style={styles.avatarWrap}>
          <TouchableOpacity
            style={styles.avatarTouchable}
            activeOpacity={0.85}
            onPress={() => setAvatarVisible(true)}
          >
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          </TouchableOpacity>
        </View>
      </View>

      {!!actions && <View style={styles.actionsRow}>{actions}</View>}

      <View style={[styles.info, !actions && styles.infoNoActions]}>
        <Text style={styles.name}>{user.name}</Text>
        {!!user.username && <Text style={styles.username}>@{user.username}</Text>}

        {!user.locked && !!user.bio && <Text style={styles.bio}>{user.bio}</Text>}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name={user.locked ? 'lock-closed' : 'location'}
              size={13}
              color={Colors.textSecondary}
            />
            <Text style={styles.metaText}>{location}</Text>
          </View>
          {!user.locked && !!user.joinedAt && (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.metaText}>Desde {user.joinedAt}</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <Text style={styles.statText}>
            <Text style={styles.statNum}>{user.postsCount}</Text> Posts
          </Text>
          {!user.locked && (
            <Text style={styles.statText}>
              <Text style={styles.statNum}>{user.interactionsCount}</Text> Interações
            </Text>
          )}
        </View>
      </View>

      <ImageViewerModal
        media={[{ url: user.avatar, type: 'image' }]}
        visible={avatarVisible}
        onClose={() => setAvatarVisible(false)}
      />
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  containerWide: {
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderBottomWidth: 0,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },

  coverWrap: {
    width: '100%',
    aspectRatio: 3,
    backgroundColor: Colors.border,
  },
  coverImage: { width: '100%', height: '100%' },

  topRow: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  avatarWrap: {
    position: 'absolute',
    left: 16,
    bottom: -AVATAR_SIZE / 2,
  },
  avatarTouchable: {
    borderRadius: AVATAR_SIZE / 2 + 4,
    overflow: 'hidden',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2 + 4,
    borderWidth: 4,
    borderColor: Colors.background,
    ...Colors.shadow.sm,
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 10,
    paddingHorizontal: 16,
    minHeight: AVATAR_SIZE / 2 + 10,
  },

  info: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 6,
  },
  infoNoActions: { paddingTop: AVATAR_SIZE / 2 + 12 },

  name: { fontSize: 20, fontWeight: '800', color: Colors.text, letterSpacing: -0.4 },
  username: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500', marginTop: -4 },

  bio: { fontSize: 14, color: Colors.text, lineHeight: 20, marginTop: 2 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  statsRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  statText: { fontSize: 13, color: Colors.textSecondary },
  statNum: { fontWeight: '800', color: Colors.text },
});
