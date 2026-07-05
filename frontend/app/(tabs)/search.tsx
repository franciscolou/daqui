import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { Post, User } from '../../data/mock';
import { api, SearchType } from '../../lib/api';
import { useRegisterScrollToTop } from '../../lib/scrollToTop';
import { useTheme, useThemedStyles } from '../../lib/theme';
import PostCard from '../../components/PostCard';
import LeftSidebar from '../../components/LeftSidebar';
import RightSidebar from '../../components/RightSidebar';

const WIDE = 900;

const FILTERS: { key: SearchType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Tudo', icon: 'apps-outline' },
  { key: 'posts', label: 'Posts', icon: 'document-text-outline' },
  { key: 'users', label: 'Pessoas', icon: 'people-outline' },
];

export default function SearchScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [query, setQuery] = useState('');
  const [type, setType] = useState<SearchType>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  useRegisterScrollToTop('search', () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  });

  const runSearch = (q: string, t: SearchType) => {
    const term = q.trim();
    if (!term) {
      setPosts([]);
      setUsers([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    api
      .search(term, t)
      .then((r) => {
        if (id !== seq.current) return;
        setPosts(r.posts);
        setUsers(r.users);
        setSearched(true);
      })
      .catch(() => {
        if (id !== seq.current) return;
        setPosts([]);
        setUsers([]);
        setSearched(true);
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
  };

  const onChangeQuery = (v: string) => {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(v, type), 300);
  };

  const onChangeType = (t: SearchType) => {
    setType(t);
    runSearch(query, t);
  };

  const clear = () => {
    setQuery('');
    setPosts([]);
    setUsers([]);
    setSearched(false);
  };

  const showUsers = type !== 'posts';
  const showPosts = type !== 'users';
  const hasResults = (showUsers && users.length > 0) || (showPosts && posts.length > 0);

  const content = (
    <>
      {/* Search bar */}
      <View style={styles.searchHeader}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar posts e pessoas..."
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={onChangeQuery}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query, type)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clear} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = type === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => onChangeType(f.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={f.icon} size={14} color={active ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.hairline} />

      {/* Results */}
      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : !query.trim() ? (
        <View style={styles.state}>
          <Ionicons name="search-outline" size={34} color={Colors.textTertiary} />
          <Text style={styles.stateText}>Busque por posts e vizinhos.</Text>
        </View>
      ) : searched && !hasResults ? (
        <View style={styles.state}>
          <Ionicons name="sad-outline" size={34} color={Colors.textTertiary} />
          <Text style={styles.stateText}>Nada encontrado para “{query.trim()}”.</Text>
        </View>
      ) : (
        <>
          {/* Users */}
          {showUsers && users.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pessoas</Text>
              {users.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.userRow}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/user/${u.id}` as any)}
                >
                  <Image source={{ uri: u.avatar }} style={styles.userAvatar} />
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName} numberOfLines={1}>{u.name}</Text>
                      {!!u.username && (
                        <Text style={styles.userUsername} numberOfLines={1}>@{u.username}</Text>
                      )}
                    </View>
                    <View style={styles.userMeta}>
                      <Ionicons name="location-outline" size={12} color={Colors.primary} />
                      <Text style={styles.userNeighborhood} numberOfLines={1}>{u.neighborhood}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Posts */}
          {showPosts && posts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Posts</Text>
              {posts.map((p) => <PostCard key={p.id} post={p} />)}
            </View>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isWide ? (
        <View style={[styles.wideBody, { paddingHorizontal: Math.max(0, (width - 1140) / 2) }]}>
          <ScrollView style={styles.leftCol} showsVerticalScrollIndicator={false}>
            <LeftSidebar />
          </ScrollView>
          <ScrollView ref={scrollRef} style={styles.centerCol} showsVerticalScrollIndicator={false}>
            {content}
          </ScrollView>
          <ScrollView style={styles.rightCol} showsVerticalScrollIndicator={false}>
            <RightSidebar />
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.mobileBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  wideBody: { flex: 1, flexDirection: 'row', backgroundColor: Colors.background },
  leftCol: {
    width: 220,
    flexShrink: 0,
    backgroundColor: Colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  centerCol: {
    width: 640,
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: Colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  rightCol: { width: 280, flexShrink: 0, backgroundColor: Colors.background },
  mobileBody: { flex: 1, backgroundColor: Colors.surface },

  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: '#fff' },

  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },

  state: { alignItems: 'center', gap: 10, paddingVertical: 56, paddingHorizontal: 24 },
  stateText: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center' },

  section: { paddingTop: 14 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userAvatar: { width: 46, height: 46, borderRadius: 14 },
  userInfo: { flex: 1, minWidth: 0 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  userName: { fontSize: 15, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  userUsername: { fontSize: 13, color: Colors.textTertiary, fontWeight: '500', flexShrink: 1 },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  userNeighborhood: { fontSize: 12, color: Colors.primary, fontWeight: '500', flexShrink: 1 },
});
