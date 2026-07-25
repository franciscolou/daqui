import {
  View,
  Text,
  StyleSheet,
  Image,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Palette } from '../constants/Colors';
import { User } from '../data/mock';
import { api } from '../lib/api';
import { useTheme, useThemedStyles } from '../lib/theme';

/** Modal "Curtidas": lista quem curtiu um post, com busca por nome/@username.
 * Tocar num curtidor fecha o modal e vai pro perfil dele. */
export default function LikersModal({
  visible,
  postId,
  onClose,
}: {
  visible: boolean;
  postId: string;
  onClose: () => void;
}) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [likers, setLikers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setSearch('');
    api
      .getPostLikers(postId)
      .then(setLikers)
      .catch(() => setLikers([]))
      .finally(() => setLoading(false));
  }, [visible, postId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return likers;
    return likers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q),
    );
  }, [likers, search]);

  const goToProfile = (user: User) => {
    onClose();
    router.push(`/user/${user.id}` as any);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} tabIndex={-1}>
        <Pressable style={styles.card} onPress={() => {}} tabIndex={-1}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Curtidas</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar..."
              placeholderTextColor={Colors.textTertiary}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(u) => u.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {search ? 'Ninguém encontrado.' : 'Ninguém curtiu ainda.'}
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => goToProfile(item)}
                >
                  <Image source={{ uri: item.avatar }} style={styles.avatar} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>@{item.username}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    ...Colors.shadow.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  closeBtn: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, outlineStyle: 'none' } as any,
  loader: { marginVertical: 24 },
  list: { flexGrow: 0 },
  empty: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.border },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  rowSub: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
});
