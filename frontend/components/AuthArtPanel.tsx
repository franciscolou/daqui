import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const AVATARS = ['47', '52', '44', '57', '25'];

const POSTS = [
  { icon: 'alert-circle', color: '#EF4444', label: 'Aviso', text: 'Obra na Rua Aspicuelta fecha…' },
  { icon: 'star',         color: '#F59E0B', label: 'Dica',  text: 'Padaria nova na Harmonia 🥐' },
  { icon: 'paw',          color: '#EC4899', label: 'Pets',  text: 'Gatinha encontrada perto do…' },
];

export default function AuthArtPanel() {
  return (
    <View style={styles.panel}>
      <LinearGradient
        colors={['#052E16', '#14532D', '#166534', '#15803D']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.blob, { width: 520, height: 520, top: -140, right: -140, opacity: 0.12 }]} />
      <View style={[styles.blob, { width: 320, height: 320, bottom: -80, left: -80,  opacity: 0.10 }]} />
      <View style={[styles.blob, { width: 200, height: 200, top: '40%', left: '20%', opacity: 0.07 }]} />

      <View style={styles.ringOuter}>
        <View style={styles.ringInner}>
          <Ionicons name="location" size={52} color={Colors.primary} />
        </View>
      </View>

      <View style={styles.artCenter}>
        <Text style={styles.artWord}>Vizinhança</Text>
        <Text style={styles.artWord2}>de verdade.</Text>
      </View>

      <View style={styles.avatarCluster}>
        {AVATARS.map((img, i) => (
          <Image
            key={i}
            source={{ uri: `https://i.pravatar.cc/80?img=${img}` }}
            style={[styles.clusterAvatar, { marginLeft: i > 0 ? -14 : 0, zIndex: 10 - i }]}
          />
        ))}
        <View style={styles.clusterBadge}>
          <Text style={styles.clusterBadgeText}>+238 vizinhos</Text>
        </View>
      </View>

      {POSTS.map((p, i) => (
        <View
          key={i}
          style={[
            styles.floatCard,
            i === 0 && { bottom: 200, left: 32 },
            i === 1 && { top: 140,   right: 40 },
            i === 2 && { bottom: 120, right: 28 },
          ]}
        >
          <View style={[styles.floatCardDot, { backgroundColor: p.color }]} />
          <View>
            <Text style={styles.floatCardLabel}>{p.label}</Text>
            <Text style={styles.floatCardText} numberOfLines={1}>{p.text}</Text>
          </View>
        </View>
      ))}

      <View style={styles.dotGrid}>
        {Array.from({ length: 48 }).map((_, i) => (
          <View key={i} style={styles.dot} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: '#fff',
  },
  ringOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ringInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artCenter: {
    alignItems: 'center',
    marginBottom: 36,
  },
  artWord: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1.5,
    opacity: 0.95,
  },
  artWord2: {
    fontSize: 42,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1.5,
  },
  avatarCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clusterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#14532D',
  },
  clusterBadge: {
    marginLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  clusterBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  floatCard: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: 220,
  },
  floatCardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  floatCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  floatCardText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  dotGrid: {
    position: 'absolute',
    top: 24,
    left: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 8 * 12,
    gap: 6,
    opacity: 0.2,
  },
  dot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
});
