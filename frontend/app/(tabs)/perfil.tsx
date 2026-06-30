import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { CURRENT_USER, POSTS } from '../../data/mock';
import { router } from 'expo-router';

const MY_POSTS = POSTS.slice(0, 3);

const SETTINGS_GROUPS = [
  {
    title: 'Conta',
    items: [
      { icon: 'person-outline', label: 'Editar perfil', color: Colors.indigo },
      { icon: 'lock-closed-outline', label: 'Privacidade e segurança', color: Colors.primary },
      { icon: 'notifications-outline', label: 'Notificações', color: Colors.accent },
    ],
  },
  {
    title: 'Bairro',
    items: [
      { icon: 'location-outline', label: 'Meu endereço', color: Colors.error },
      { icon: 'people-outline', label: 'Vizinhos que sigo', color: Colors.indigo },
      { icon: 'business-outline', label: 'Comércios locais', color: Colors.warning },
    ],
  },
  {
    title: 'App',
    items: [
      { icon: 'star-outline', label: 'Avaliar o Daqui', color: Colors.warning },
      { icon: 'help-circle-outline', label: 'Ajuda e suporte', color: Colors.textSecondary },
      { icon: 'document-text-outline', label: 'Termos de uso', color: Colors.textSecondary },
    ],
  },
];

export default function PerfilScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero header */}
        <LinearGradient
          colors={['#0D2918', '#15803D', '#22C55E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <TouchableOpacity style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.profileCenter}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: CURRENT_USER.avatar }} style={styles.avatar} />
              <TouchableOpacity style={styles.editAvatarBtn}>
                <Ionicons name="camera" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.nameBadgeRow}>
              <Text style={styles.name}>{CURRENT_USER.name}</Text>
              {CURRENT_USER.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.neighborhoodRow}>
              <Ionicons name="location" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.neighborhood}>{CURRENT_USER.neighborhood}</Text>
            </View>
            {CURRENT_USER.badge && (
              <View style={styles.leaderBadge}>
                <Ionicons name="ribbon" size={13} color={Colors.warning} />
                <Text style={styles.leaderText}>
                  {CURRENT_USER.badge === 'lider' ? 'Líder do Bairro' : CURRENT_USER.badge === 'comerciante' ? 'Comerciante' : 'Morador'}
                </Text>
              </View>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{CURRENT_USER.postsCount}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{CURRENT_USER.helpCount}</Text>
              <Text style={styles.statLabel}>Ajudas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>238</Text>
              <Text style={styles.statLabel}>Vizinhos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>4.9</Text>
              <Text style={styles.statLabel}>Reputação</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Reputation card */}
        <View style={styles.reputationCard}>
          <View style={styles.reputationHeader}>
            <Text style={styles.reputationTitle}>Reputação no bairro</Text>
            <View style={styles.reputationScore}>
              <Ionicons name="star" size={14} color={Colors.warning} />
              <Text style={styles.reputationScoreText}>4.9</Text>
            </View>
          </View>
          <View style={styles.reputationBadges}>
            {[
              { icon: 'ribbon', label: 'Líder', color: Colors.warning },
              { icon: 'shield-checkmark', label: 'Verificado', color: Colors.primary },
              { icon: 'hand-left', label: '23 ajudas', color: Colors.indigo },
              { icon: 'star', label: 'Top 5%', color: Colors.accent },
            ].map((b) => (
              <View key={b.label} style={[styles.repBadge, { backgroundColor: b.color + '15' }]}>
                <Ionicons name={b.icon as any} size={14} color={b.color} />
                <Text style={[styles.repBadgeText, { color: b.color }]}>{b.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.memberSince}>Membro desde {CURRENT_USER.joinedAt}</Text>
        </View>

        {/* My posts */}
        <View style={styles.myPostsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Minhas publicações</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.myPostsList}>
            {MY_POSTS.map((post) => {
              const catColor = Colors.category[post.category];
              return (
                <TouchableOpacity key={post.id} style={styles.myPostCard} activeOpacity={0.9}>
                  {post.images?.[0] && (
                    <Image source={{ uri: post.images[0] }} style={styles.myPostImage} />
                  )}
                  {!post.images?.[0] && (
                    <View style={[styles.myPostImagePlaceholder, { backgroundColor: catColor + '15' }]}>
                      <Ionicons name="document-text-outline" size={24} color={catColor} />
                    </View>
                  )}
                  <View style={styles.myPostInfo}>
                    <Text style={styles.myPostTitle} numberOfLines={2}>
                      {post.title ?? post.content}
                    </Text>
                    <View style={styles.myPostMeta}>
                      <Ionicons name="heart" size={12} color={Colors.error} />
                      <Text style={styles.myPostMetaText}>{post.likesCount}</Text>
                      <Text style={styles.myPostMetaDot}>·</Text>
                      <Ionicons name="chatbubble" size={11} color={Colors.textTertiary} />
                      <Text style={styles.myPostMetaText}>{post.commentsCount}</Text>
                      <Text style={styles.myPostMetaDot}>·</Text>
                      <Text style={styles.myPostTime}>{post.createdAt}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Settings */}
        {SETTINGS_GROUPS.map((group) => (
          <View key={group.title} style={styles.settingsGroup}>
            <Text style={styles.settingsGroupTitle}>{group.title}</Text>
            <View style={styles.settingsCard}>
              {group.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.settingsItem,
                    idx < group.items.length - 1 && styles.settingsItemBorder,
                  ]}
                  activeOpacity={0.85}
                >
                  <View style={[styles.settingsIcon, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon as any} size={18} color={item.color} />
                  </View>
                  <Text style={styles.settingsLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => router.replace('/(auth)/welcome')}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Daqui v1.0.0</Text>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  settingsBtn: {
    alignSelf: 'flex-end',
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileCenter: { alignItems: 'center', marginBottom: 20 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  name: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neighborhoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  neighborhood: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  leaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  leaderText: { color: Colors.warning, fontSize: 12, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center' },
  reputationCard: {
    margin: 16,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Colors.shadow.sm,
  },
  reputationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reputationTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  reputationScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reputationScoreText: { fontSize: 14, fontWeight: '800', color: Colors.warning },
  reputationBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  repBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  repBadgeText: { fontSize: 12, fontWeight: '700' },
  memberSince: { fontSize: 12, color: Colors.textTertiary },
  myPostsSection: { paddingBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  sectionLink: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  myPostsList: { paddingHorizontal: 16, gap: 10 },
  myPostCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Colors.shadow.sm,
  },
  myPostImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  myPostImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPostInfo: { flex: 1 },
  myPostTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6, lineHeight: 19 },
  myPostMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  myPostMetaText: { fontSize: 12, color: Colors.textTertiary },
  myPostMetaDot: { fontSize: 12, color: Colors.textTertiary },
  myPostTime: { fontSize: 12, color: Colors.textTertiary },
  settingsGroup: { paddingHorizontal: 16, paddingTop: 20 },
  settingsGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  settingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    ...Colors.shadow.sm,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLabel: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '500' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 15,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: { fontSize: 15, color: Colors.error, fontWeight: '700' },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 14,
  },
});
