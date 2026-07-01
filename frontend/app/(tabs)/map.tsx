import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../../constants/Colors';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { POSTS, CATEGORY_LABELS, CATEGORY_ICONS, PostCategory } from '../../data/mock';
import MobileMenu from '../../components/MobileMenu';

const { width } = Dimensions.get('window');

const MAP_PINS = [
  { id: '1', x: 0.32, y: 0.28, category: 'aviso' as PostCategory, label: 'Obra na Harmonia' },
  { id: '2', x: 0.55, y: 0.42, category: 'evento' as PostCategory, label: 'Festa Junina' },
  { id: '3', x: 0.72, y: 0.35, category: 'seguranca' as PostCategory, label: 'Golpe do WhatsApp', important: true },
  { id: '4', x: 0.45, y: 0.62, category: 'recomendacao' as PostCategory, label: 'Padaria Levain' },
  { id: '5', x: 0.20, y: 0.55, category: 'pets' as PostCategory, label: 'Thor desaparecido', important: true },
  { id: '6', x: 0.65, y: 0.7, category: 'venda' as PostCategory, label: 'Sofá R$800' },
];

const MAP_HEIGHT = width * 0.9;

export default function MapScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const nearbyPosts = POSTS.slice(0, 3);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {!isWide && <MobileMenu />}
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#0D2918', '#15803D']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Mapa do Bairro</Text>
          <View style={styles.headerSub}>
            <Ionicons name="location" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.headerSubText}>Vila Madalena, São Paulo</Text>
          </View>
        </LinearGradient>

        {/* Map area */}
        <View style={styles.mapWrapper}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800' }}
            style={styles.mapBg}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.15)']}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Pins */}
          {MAP_PINS.map((pin) => {
            const color = Colors.category[pin.category];
            return (
              <TouchableOpacity
                key={pin.id}
                style={[
                  styles.mapPin,
                  {
                    left: pin.x * (width - 32),
                    top: pin.y * MAP_HEIGHT,
                    backgroundColor: pin.important ? Colors.error : color,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={CATEGORY_ICONS[pin.category] as any}
                  size={14}
                  color="#fff"
                />
                {pin.important && <View style={styles.importantDot} />}
              </TouchableOpacity>
            );
          })}

          {/* My location */}
          <View style={[styles.myLocation, { left: '50%', top: '50%' }]}>
            <View style={styles.myLocationPulse} />
            <View style={styles.myLocationDot} />
          </View>

          {/* Map controls */}
          <View style={styles.mapControls}>
            <TouchableOpacity style={styles.mapControlBtn}>
              <Ionicons name="add" size={20} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.mapControlDiv} />
            <TouchableOpacity style={styles.mapControlBtn}>
              <Ionicons name="remove" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.myLocationBtn}>
            <Ionicons name="navigate" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendRow}>
            {(Object.entries(Colors.category) as [PostCategory, string][]).map(([key, color]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{CATEGORY_LABELS[key]}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Nearby section */}
        <View style={styles.nearbySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Perto de você</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.nearbyList}>
            {nearbyPosts.map((post) => {
              const catColor = Colors.category[post.category];
              return (
                <TouchableOpacity key={post.id} style={styles.nearbyCard} activeOpacity={0.9}>
                  <View style={[styles.nearbyIconBox, { backgroundColor: catColor + '15' }]}>
                    <Ionicons name={CATEGORY_ICONS[post.category] as any} size={20} color={catColor} />
                  </View>
                  <View style={styles.nearbyInfo}>
                    <Text style={styles.nearbyTitle} numberOfLines={1}>
                      {post.title ?? post.content}
                    </Text>
                    <View style={styles.nearbyMeta}>
                      <Ionicons name="navigate-outline" size={11} color={Colors.textTertiary} />
                      <Text style={styles.nearbyMetaText}>{post.distance}</Text>
                      <Text style={styles.nearbyMetaDot}>·</Text>
                      <Text style={styles.nearbyMetaText}>{post.createdAt}</Text>
                    </View>
                  </View>
                  <View style={[styles.nearbyCategory, { backgroundColor: catColor + '15' }]}>
                    <Text style={[styles.nearbyCategoryText, { color: catColor }]}>
                      {CATEGORY_LABELS[post.category]}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Heat map card */}
        <View style={styles.heatCard}>
          <LinearGradient colors={Colors.gradient.primary} style={styles.heatGradient}>
            <View style={styles.heatContent}>
              <View>
                <Text style={styles.heatTitle}>Atividade do bairro</Text>
                <Text style={styles.heatDesc}>47 posts nas últimas 24h</Text>
              </View>
              <View style={styles.heatBars}>
                {[40, 70, 55, 90, 65, 80, 45].map((h, i) => (
                  <View key={i} style={[styles.heatBar, { height: h * 0.6 }]} />
                ))}
              </View>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  headerSubText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  mapWrapper: {
    margin: 16,
    height: MAP_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    ...Colors.shadow.md,
  },
  mapBg: {
    width: '100%',
    height: '100%',
  },
  mapPin: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...Colors.shadow.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  importantDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: Colors.error,
  },
  myLocation: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -14 }, { translateY: -14 }],
  },
  myLocationPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  myLocationDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.indigo,
    borderWidth: 3,
    borderColor: '#fff',
    ...Colors.shadow.md,
  },
  mapControls: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    ...Colors.shadow.md,
  },
  mapControlBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapControlDiv: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  myLocationBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Colors.shadow.md,
  },
  legend: { paddingVertical: 4 },
  legendRow: { paddingHorizontal: 16, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  nearbySection: { paddingTop: 16, paddingBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  sectionLink: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  nearbyList: { paddingHorizontal: 16, gap: 10 },
  nearbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Colors.shadow.sm,
  },
  nearbyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyInfo: { flex: 1 },
  nearbyTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  nearbyMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  nearbyMetaText: { fontSize: 11, color: Colors.textTertiary },
  nearbyMetaDot: { fontSize: 11, color: Colors.textTertiary },
  nearbyCategory: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  nearbyCategoryText: { fontSize: 11, fontWeight: '700' },
  heatCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    ...Colors.shadow.md,
  },
  heatGradient: { borderRadius: 16 },
  heatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  heatTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  heatDesc: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  heatBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 54,
  },
  heatBar: {
    width: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 4,
  },
});
