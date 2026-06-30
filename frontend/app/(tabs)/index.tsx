import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Colors } from '../../constants/Colors';
import { POSTS, USERS, CATEGORIES, CURRENT_USER, PostCategory } from '../../data/mock';
import PostCard from '../../components/PostCard';
import StoryAvatar from '../../components/StoryAvatar';
import LeftSidebar from '../../components/LeftSidebar';
import RightSidebar from '../../components/RightSidebar';

type FilterKey = 'todos' | PostCategory;

const WIDE = 900;

export default function FeedScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;

  const [activeCategory, setActiveCategory] = useState<FilterKey>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPosts = POSTS.filter((p) => {
    const matchesCategory = activeCategory === 'todos' || p.category === activeCategory;
    const matchesSearch =
      searchQuery === '' ||
      p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesCategory && matchesSearch;
  });

  const feedHeader = (
    <>
      {/* Compose box */}
      <View style={styles.composeBox}>
        <Image source={{ uri: CURRENT_USER.avatar }} style={styles.composeAvatar} />
        <TouchableOpacity style={styles.composeFakeInput} activeOpacity={0.7}>
          <Text style={styles.composePlaceholder}>
            Postar uma mensagem, evento, enquete ou aviso urgente
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.composeDivider} />

      {/* Category filter tabs */}
      {!isWide && (
        <View style={styles.mobileTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mobileTabsRow}>
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.key;
              const color = cat.key === 'todos' ? Colors.primary : (Colors.category[cat.key as PostCategory] ?? Colors.primary);
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.mobileTab, isActive && { borderBottomColor: color }]}
                  onPress={() => setActiveCategory(cat.key as FilterKey)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={cat.icon as any} size={12} color={isActive ? color : Colors.textTertiary} />
                  <Text style={[styles.mobileTabText, isActive && { color, fontWeight: '700' }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Stories — mobile only */}
      {!isWide && (
        <>
          <View style={styles.storiesSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
              <StoryAvatar isAdd />
              {USERS.map((u) => <StoryAvatar key={u.id} user={u} />)}
            </ScrollView>
          </View>
          <View style={styles.hairline} />
        </>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={15} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar no bairro..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={15} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.hairline} />
    </>
  );

  const feed = (
    <FlatList
      data={filteredPosts}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={feedHeader}
      renderItem={({ item }) => <PostCard post={item} />}
      contentContainerStyle={styles.listContent}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ─── Top header bar (always visible) ─── */}
      <LinearGradient
        colors={['#0D2918', '#15803D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topBar}
      >
        {/* Logo (wide only) */}
        {isWide && (
          <View style={styles.topBarLogo}>
            <Ionicons name="location" size={18} color={Colors.primary} />
            <Text style={styles.topBarLogoText}>daqui</Text>
          </View>
        )}

        {/* Avatar (mobile) */}
        {!isWide && (
          <Image source={{ uri: CURRENT_USER.avatar }} style={styles.topBarAvatar} />
        )}

        {/* Search (wide) */}
        {isWide ? (
          <View style={styles.topBarSearch}>
            <Ionicons name="search-outline" size={15} color={Colors.textTertiary} />
            <TextInput
              style={styles.topBarSearchInput}
              placeholder="Buscar em Vila Madalena..."
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        ) : (
          <TouchableOpacity style={styles.neighborhoodBtn}>
            <Ionicons name="location" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={styles.neighborhoodBtnText}>{CURRENT_USER.neighborhood}</Text>
            <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={styles.topBarActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="chatbubbles-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtnNotif}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            <View style={styles.notifDot} />
          </TouchableOpacity>
          {isWide && (
            <TouchableOpacity style={styles.avatarBtn}>
              <Image source={{ uri: CURRENT_USER.avatar }} style={styles.topBarAvatarWide} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ─── Body: 3-column on wide, 1-column on mobile ─── */}
      {isWide ? (
        <View style={styles.wideBody}>
          {/* Left sidebar — scrollable */}
          <ScrollView style={styles.leftCol} showsVerticalScrollIndicator={false}>
            <LeftSidebar
              activeCategory={activeCategory}
              onCategoryChange={(k) => setActiveCategory(k as FilterKey)}
            />
          </ScrollView>

          {/* Center feed — main scroll */}
          <View style={styles.centerCol}>
            {feed}
          </View>

          {/* Right sidebar — scrollable */}
          <ScrollView style={styles.rightCol} showsVerticalScrollIndicator={false}>
            <RightSidebar />
          </ScrollView>
        </View>
      ) : (
        <View style={styles.mobileBody}>
          {feed}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* ── Top bar ── */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  topBarLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 110,
  },
  topBarLogoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.8,
  },
  topBarAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    marginRight: 4,
  },
  topBarSearch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  topBarSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    outlineStyle: 'none',
  } as any,
  neighborhoodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  neighborhoodBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnNotif: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.primaryDark,
  },
  avatarBtn: { marginLeft: 4 },
  topBarAvatarWide: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },

  /* ── Wide 3-col layout ── */
  wideBody: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  leftCol: {
    width: 220,
    flexShrink: 0,
    backgroundColor: Colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  centerCol: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
    maxWidth: 640,
  },
  rightCol: {
    width: 280,
    flexShrink: 0,
    backgroundColor: Colors.background,
  },

  /* ── Mobile layout ── */
  mobileBody: {
    flex: 1,
    backgroundColor: Colors.surface,
  },

  /* ── Feed header pieces ── */
  composeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
  },
  composeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  composeFakeInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  composePlaceholder: {
    fontSize: 13,
    color: Colors.textTertiary,
    lineHeight: 17,
  },
  composeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  mobileTabs: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  mobileTabsRow: {
    paddingHorizontal: 8,
    flexDirection: 'row',
  },
  mobileTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  mobileTabText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  storiesSection: {
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  storiesRow: {
    paddingHorizontal: 14,
    gap: 10,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  searchContainer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 36,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    outlineStyle: 'none',
  } as any,

  listContent: { paddingBottom: 24 },
});
