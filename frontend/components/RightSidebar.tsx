import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';
import { USERS, CURRENT_USER } from '../data/mock';

export default function RightSidebar() {
  const nearbyUsers = USERS.slice(0, 4);

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
            <Text style={styles.mapBadgeText}>{CURRENT_USER.neighborhood}</Text>
          </View>
        </LinearGradient>

        <View style={styles.cardBody}>
          <Text style={styles.neighborhoodName}>{CURRENT_USER.neighborhood}</Text>
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

      {/* Profile quick links */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Image source={{ uri: CURRENT_USER.avatar }} style={styles.profileAvatar} />
          <View>
            <Text style={styles.profileGreeting}>Olá, {CURRENT_USER.name.split(' ')[0]}!</Text>
            <Text style={styles.profileSub}>Líder do bairro</Text>
          </View>
        </View>
        <View style={styles.divider} />
        {[
          { icon: 'person-outline', label: 'Seu perfil' },
          { icon: 'bookmark-outline', label: 'Salvos' },
          { icon: 'star-outline', label: 'Reputação' },
          { icon: 'hand-left-outline', label: 'Ajudas dadas' },
        ].map((item) => (
          <TouchableOpacity key={item.label} style={styles.profileLink} activeOpacity={0.7}>
            <Ionicons name={item.icon as any} size={15} color={Colors.primary} />
            <Text style={styles.profileLinkText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Active neighbors */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vizinhos ativos</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>Ver todos</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.neighborsList}>
          {nearbyUsers.map((u) => (
            <TouchableOpacity key={u.id} style={styles.neighborRow} activeOpacity={0.7}>
              <View style={styles.neighborAvatarWrapper}>
                <Image source={{ uri: u.avatar }} style={styles.neighborAvatar} />
                <View style={styles.onlineDot} />
              </View>
              <View style={styles.neighborInfo}>
                <Text style={styles.neighborName} numberOfLines={1}>{u.name.split(' ')[0]}{' '}{u.name.split(' ')[1]?.[0]}.</Text>
                <Text style={styles.neighborDist}>{u.neighborhood}</Text>
              </View>
              <TouchableOpacity style={styles.followBtn}>
                <Text style={styles.followBtnText}>Seguir</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Urgent alert */}
      <TouchableOpacity style={styles.alertCard} activeOpacity={0.9}>
        <View style={styles.alertTop}>
          <View style={styles.alertIconBox}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.error} />
          </View>
          <Text style={styles.alertTitle}>Alerta de segurança</Text>
        </View>
        <Text style={styles.alertBody}>
          Golpe do WhatsApp circulando no bairro. Não forneça dados bancários.
        </Text>
        <Text style={styles.alertLink}>Ver mais →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    paddingBottom: 10,
  },
  profileAvatar: { width: 40, height: 40, borderRadius: 12 },
  profileGreeting: { fontSize: 14, fontWeight: '700', color: Colors.text },
  profileSub: { fontSize: 11, color: Colors.primary, fontWeight: '600', marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginHorizontal: 14 },
  profileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  profileLinkText: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  sectionLink: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  neighborsList: { paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  neighborRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  neighborAvatarWrapper: { position: 'relative' },
  neighborAvatar: { width: 36, height: 36, borderRadius: 11 },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  neighborInfo: { flex: 1, minWidth: 0 },
  neighborName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  neighborDist: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  followBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.primaryFaint,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  followBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  alertCard: {
    backgroundColor: '#FFF1F0',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
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
  alertBody: { fontSize: 12, color: '#7F1D1D', lineHeight: 17, marginBottom: 6 },
  alertLink: { fontSize: 12, fontWeight: '700', color: Colors.error },
});
