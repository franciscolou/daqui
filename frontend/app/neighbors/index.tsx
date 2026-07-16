import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { api } from '../../lib/api';
import { User } from '../../data/mock';
import { useAuth } from '../../lib/auth';
import { goBack } from '../../lib/navigation';
import { useTheme, useThemedStyles } from '../../lib/theme';
import FeedLayout from '../../components/FeedLayout';

export default function NeighborsScreen() {
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [neighbors, setNeighbors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.getNeighbors()
      .then(setNeighbors)
      .catch(() => setNeighbors([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  // Completa a última linha com espaçadores invisíveis (mantém cards a 1/3).
  const data = useMemo<(User | { id: string; placeholder: true })[]>(() => {
    const rem = neighbors.length % 3;
    if (neighbors.length === 0 || rem === 0) return neighbors;
    const pad = Array.from({ length: 3 - rem }, (_, i) => ({ id: `__ph${i}`, placeholder: true as const }));
    return [...neighbors, ...pad];
  }, [neighbors]);

  return (
    <FeedLayout showMobileMenu={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/')}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vizinhos</Text>
        <View style={styles.iconBtn} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(u) => u.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.introTitle}>Vizinhos em {user?.neighborhood ?? 'seu bairro'}</Text>
            <Text style={styles.introDesc}>
              Pessoas do seu bairro no Daqui. Toque para ver o perfil ou mande uma mensagem.
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          'placeholder' in item ? (
            <View style={styles.placeholder} />
          ) : (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push(`/user/${item.id}` as any)}
          >
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>@{item.username}</Text>
            <TouchableOpacity
              style={styles.msgBtn}
              activeOpacity={0.85}
              onPress={() => router.push(`/messages/${item.id}` as any)}
            >
              <Ionicons name="chatbubble-outline" size={15} color="#fff" />
              <Text style={styles.msgBtnText}>Mensagem</Text>
            </TouchableOpacity>
          </TouchableOpacity>
          )
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Nenhum vizinho por aqui</Text>
              <Text style={styles.emptyDesc}>Assim que outras pessoas do seu bairro entrarem, elas aparecem aqui.</Text>
            </View>
          )
        }
      />
    </FeedLayout>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
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
  iconBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: Colors.text },
  list: { padding: 14, gap: 12, flexGrow: 1 },
  row: { gap: 12 },
  intro: { paddingHorizontal: 2, paddingBottom: 4, gap: 4 },
  introTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  introDesc: { fontSize: 13, color: Colors.textTertiary, lineHeight: 18 },
  card: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 6,
    ...Colors.shadow.sm,
  },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.border, marginBottom: 2 },
  cardName: { fontSize: 14, fontWeight: '700', color: Colors.text, textAlign: 'center', maxWidth: '100%' },
  cardMeta: { fontSize: 12, color: Colors.textTertiary, textAlign: 'center', maxWidth: '100%' },
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: 11,
    height: 34,
    alignSelf: 'stretch',
    marginTop: 6,
  },
  msgBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  placeholder: { flex: 1, minWidth: 0 },
  loader: { marginTop: 60 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyDesc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', maxWidth: 280 },
});
