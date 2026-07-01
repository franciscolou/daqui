import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Palette } from '../constants/Colors';
import { Post, User } from '../data/mock';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTheme, useThemedStyles } from '../lib/theme';

export default function RightSidebar() {
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [popularUsers, setPopularUsers] = useState<User[]>([]);
  const [urgentPost, setUrgentPost] = useState<Post | null>(null);
  const [alertHovered, setAlertHovered] = useState(false);

  useEffect(() => {
    api.getPopular().then((n) => setPopularUsers(n.slice(0, 4))).catch(() => {});
    api.getTopUrgent().then(setUrgentPost).catch(() => {});
  }, []);

  return (
    <View style={styles.sidebar}>
      {/* Neighborhood card */}
      <View style={styles.card}>
        <LinearGradient
          colors={['#0D2918', '#16A34A']}
          style={styles.mapPlaceholder}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.mapOverlay}>
            <Ionicons name="map" size={28} color="rgba(255,255,255,0.3)" />
          </View>
          <View style={styles.mapBadge}>
            <Ionicons name="location" size={12} color={Colors.primary} />
            <Text style={styles.mapBadgeText}>{user?.neighborhood}</Text>
          </View>
        </LinearGradient>

        <View style={styles.cardBody}>
          <Text style={styles.neighborhoodName}>{user?.neighborhood}</Text>
          <Text style={styles.cityName}>São Paulo, SP</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>238</Text>
              <Text style={styles.statLabel}>vizinhos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>80%</Text>
              <Text style={styles.statLabel}>cadastrados</Text>
            </View>
          </View>

          <View style={styles.statSubRow}>
            <Ionicons name="people-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.statSubText}>
              1.421 vizinhos em 12 bairros próximos
            </Text>
          </View>
        </View>
      </View>

      {/* Popular neighbors — sugeridos por engajamento */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="trending-up" size={15} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Vizinhos em destaque</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/mapa' as any)}>
            <Text style={styles.sectionLink}>Ver todos</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.neighborsList}>
          {popularUsers.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={styles.neighborRow}
              activeOpacity={0.7}
              onPress={() => router.push(`/usuario/${u.id}` as any)}
            >
              <Image source={{ uri: u.avatar }} style={styles.neighborAvatar} />
              <View style={styles.neighborInfo}>
                <Text style={styles.neighborName} numberOfLines={1}>{u.name.split(' ')[0]}{' '}{u.name.split(' ')[1]?.[0] ? `${u.name.split(' ')[1][0]}.` : ''}</Text>
                <Text style={styles.neighborDist} numberOfLines={1}>
                  {u.postsCount} posts · {u.helpCount} ajudas
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Urgent alert — post urgente com mais interações */}
      {urgentPost && (
        <Pressable
          style={[styles.alertCard, alertHovered && styles.alertCardHovered]}
          onHoverIn={() => setAlertHovered(true)}
          onHoverOut={() => setAlertHovered(false)}
          onPress={() => router.push(`/post/${urgentPost.id}` as any)}
        >
          <View style={styles.alertBadge}>
            <Ionicons name="alert-circle" size={12} color="#fff" />
            <Text style={styles.alertBadgeText}>Urgente</Text>
          </View>
          <View style={styles.alertTop}>
            <View style={styles.alertIconBox}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.error} />
            </View>
            <Text style={styles.alertTitle}>{urgentPost.title || 'Alerta de segurança'}</Text>
          </View>
          <Text style={styles.alertBody} numberOfLines={3}>
            {urgentPost.content}
          </Text>
          <View style={styles.alertAuthor}>
            <Image source={{ uri: urgentPost.author.avatar }} style={styles.alertAuthorAvatar} />
            <Text style={styles.alertAuthorName} numberOfLines={1}>
              {urgentPost.author.name}
            </Text>
            <Text style={styles.alertAuthorTime}>· {urgentPost.createdAt}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  sidebar: {
    width: 268,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow.sm,
  },
  mapPlaceholder: {
    height: 90,
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 10,
  },
  mapOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  mapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  mapBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  cardBody: { padding: 14 },
  neighborhoodName: { fontSize: 16, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  cityName: { fontSize: 12, color: Colors.textTertiary, marginBottom: 10 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  statLabel: { fontSize: 10, color: Colors.textTertiary, marginTop: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: Colors.border },
  statSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statSubText: { fontSize: 12, color: Colors.textTertiary, flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 8,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  sectionLink: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  neighborsList: { paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  neighborRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  neighborAvatar: { width: 36, height: 36, borderRadius: 11 },
  neighborInfo: { flex: 1, minWidth: 0 },
  neighborName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  neighborDist: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  alertCard: {
    backgroundColor: '#FFF1F0',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    transitionDuration: '150ms',
  } as any,
  alertCardHovered: {
    backgroundColor: '#FFE4E1',
    borderColor: '#FCA5A5',
    ...Colors.shadow.md,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    backgroundColor: Colors.error,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 8,
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alertTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  alertIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontSize: 13, fontWeight: '700', color: '#B91C1C' },
  alertBody: { fontSize: 12, color: '#7F1D1D', lineHeight: 17, marginBottom: 10 },
  alertAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertAuthorAvatar: { width: 22, height: 22, borderRadius: 7 },
  alertAuthorName: { fontSize: 12, fontWeight: '700', color: '#7F1D1D', flexShrink: 1 },
  alertAuthorTime: { fontSize: 11, color: '#B91C1C' },
});
