import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Palette } from '../constants/Colors';
import { Post, User } from '../data/mock';
import { api, NeighborhoodStats } from '../lib/api';
import { formatPostTime } from '../lib/time';
import { useAuth } from '../lib/auth';
import { useTheme, useThemedStyles } from '../lib/theme';
import LeafletMap from './LeafletMap';

export default function RightSidebar() {
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [popularUsers, setPopularUsers] = useState<User[]>([]);
  const [importantPost, setImportantPost] = useState<Post | null>(null);
  const [stats, setStats] = useState<NeighborhoodStats | null>(null);
  const [alertHovered, setAlertHovered] = useState(false);

  useEffect(() => {
    api.getPopular().then((n) => setPopularUsers(n.slice(0, 4))).catch(() => {});
    api.getTopImportant().then(setImportantPost).catch(() => {});
    api.getNeighborhoodStats().then(setStats).catch(() => {});
  }, []);

  return (
    <View style={styles.sidebar}>
      {/* Neighborhood card */}
      <View style={styles.card}>
        <Pressable
          style={styles.mapPlaceholder}
          onPress={() => router.push('/(tabs)/map' as any)}
        >
          {user?.latitude != null && user?.longitude != null ? (
            // Miniatura não-interativa: o toque leva ao mapa (pointerEvents none no mapa).
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <LeafletMap
                interactive={false}
                center={{ latitude: user.latitude, longitude: user.longitude }}
                zoom={15}
                style={StyleSheet.absoluteFill}
              />
            </View>
          ) : (
            <LinearGradient
              colors={['#0D2918', '#16A34A']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.mapOverlay}>
                <Ionicons name="map" size={28} color="rgba(255,255,255,0.3)" />
              </View>
            </LinearGradient>
          )}
          <View style={styles.mapBadge}>
            <Ionicons name="location" size={12} color={Colors.primary} />
            <Text style={styles.mapBadgeText}>{user?.neighborhood}</Text>
          </View>
          <View style={styles.mapExpand}>
            <Ionicons name="expand" size={13} color="#fff" />
          </View>
        </Pressable>

        <View style={styles.cardBody}>
          <Text style={styles.neighborhoodName}>{user?.neighborhood}</Text>
          <Text style={styles.cityName}>
            {user?.city ?? 'São Paulo'}{user?.state ? `, ${user.state}` : ''}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats?.neighbors ?? '—'}</Text>
              <Text style={styles.statLabel}>vizinhos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats?.posts ?? '—'}</Text>
              <Text style={styles.statLabel}>posts</Text>
            </View>
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
        </View>
        <View style={styles.neighborsList}>
          {popularUsers.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={styles.neighborRow}
              activeOpacity={0.7}
              onPress={() => router.push(`/user/${u.id}` as any)}
            >
              <Image source={{ uri: u.avatar }} style={styles.neighborAvatar} />
              <View style={styles.neighborInfo}>
                <Text style={styles.neighborName} numberOfLines={1}>{u.name.split(' ')[0]}{' '}{u.name.split(' ')[1]?.[0] ? `${u.name.split(' ')[1][0]}.` : ''}</Text>
                <Text style={styles.neighborDist} numberOfLines={1}>
                  {u.postsCount} posts · {u.interactionsCount} interações
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Important alert — post importante com mais interações */}
      {importantPost && (
        <Pressable
          style={[styles.alertCard, alertHovered && styles.alertCardHovered]}
          onHoverIn={() => setAlertHovered(true)}
          onHoverOut={() => setAlertHovered(false)}
          onPress={() => router.push(`/post/${importantPost.id}` as any)}
        >
          <View style={styles.alertBadge}>
            <Ionicons name="alert-circle" size={12} color="#fff" />
            <Text style={styles.alertBadgeText}>Importante</Text>
          </View>
          <View style={styles.alertTop}>
            <View style={styles.alertIconBox}>
              <Ionicons name="shield-checkmark" size={18} color={Colors.error} />
            </View>
            <Text style={styles.alertTitle}>{importantPost.title || 'Alerta de segurança'}</Text>
          </View>
          <Text style={styles.alertBody} numberOfLines={3}>
            {importantPost.content}
          </Text>
          <View style={styles.alertAuthor}>
            <Image source={{ uri: importantPost.author.avatar }} style={styles.alertAuthorAvatar} />
            <Text style={styles.alertAuthorName} numberOfLines={1}>
              {importantPost.author.name}
            </Text>
            <Text style={styles.alertAuthorTime}>· {formatPostTime(importantPost.createdAt)}</Text>
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
    overflow: 'hidden',
  },
  mapOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  } as any,
  mapBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mapBadgeText: { fontSize: 11, fontWeight: '700', color: '#0F172A' },
  mapExpand: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 8,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
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
    backgroundColor: Colors.dangerSurface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    transitionDuration: '150ms',
  } as any,
  alertCardHovered: {
    backgroundColor: Colors.dangerSurfaceStrong,
    borderColor: Colors.dangerBorderStrong,
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
    backgroundColor: Colors.dangerIconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontSize: 13, fontWeight: '700', color: Colors.dangerTitle },
  alertBody: { fontSize: 12, color: Colors.dangerBody, lineHeight: 17, marginBottom: 10 },
  alertAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertAuthorAvatar: { width: 22, height: 22, borderRadius: 7 },
  alertAuthorName: { fontSize: 12, fontWeight: '700', color: Colors.dangerBody, flexShrink: 1 },
  alertAuthorTime: { fontSize: 11, color: Colors.dangerTitle },
});
