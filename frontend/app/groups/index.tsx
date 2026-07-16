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
import { useCallback, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { GROUP_PRIVACY_INFO } from '../../constants/groups';
import { api, Group } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { goBack } from '../../lib/navigation';
import { useTheme, useThemedStyles } from '../../lib/theme';
import FeedLayout from '../../components/FeedLayout';

export default function GroupsDiscoverScreen() {
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  // Ids marcados como "solicitação enviada" nesta sessão (grupos privacy="request").
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    // Grupos abertos (public ou request) do bairro que o usuário ainda não participa.
    api.discoverGroups('')
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const enter = async (g: Group) => {
    setJoining(g.id);
    try {
      await api.joinGroup(g.id);
      if (g.privacy === 'request') {
        // Fica pendente até um admin aprovar — permanece na lista, só trava o botão.
        setRequested((prev) => new Set(prev).add(g.id));
      } else {
        // Some da lista de "não explorados" e abre o chat (já vira conversa em Mensagens).
        setGroups((prev) => prev.filter((x) => x.id !== g.id));
        router.push(`/groups/${g.id}` as any);
      }
    } catch {
      // ignora
    } finally {
      setJoining(null);
    }
  };

  return (
    <FeedLayout showMobileMenu={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/')}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Grupos</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/groups/new' as any)}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.introTitle}>Descubra grupos em {user?.neighborhood ?? 'seu bairro'}</Text>
            <Text style={styles.introDesc}>
              Grupos abertos que você ainda não participa. Ao entrar, a conversa vai para a
              aba Mensagens.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const pending = item.myRequestPending || requested.has(item.id);
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarGroup]}>
                    <Ionicons name="people" size={26} color={Colors.primary} />
                  </View>
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.membersCount} {item.membersCount === 1 ? 'membro' : 'membros'}
                    {item.privacy === 'request' ? ` · ${GROUP_PRIVACY_INFO.request.shortLabel}` : ''}
                  </Text>
                </View>
              </View>
              {!!item.description && (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              )}
              <TouchableOpacity
                style={[styles.enterBtn, pending && styles.enterBtnPending]}
                activeOpacity={0.85}
                disabled={joining === item.id || pending}
                onPress={() => enter(item)}
              >
                {joining === item.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : pending ? (
                  <>
                    <Ionicons name="time-outline" size={17} color={Colors.primaryDark} />
                    <Text style={styles.enterBtnPendingText}>Solicitação enviada</Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name={item.privacy === 'request' ? 'paper-plane-outline' : 'enter-outline'}
                      size={17}
                      color="#fff"
                    />
                    <Text style={styles.enterBtnText}>
                      {item.privacy === 'request' ? 'Solicitar' : 'Entrar'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="compass-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>Você já explorou tudo!</Text>
              <Text style={styles.emptyDesc}>
                Não há grupos abertos novos no seu bairro. Que tal criar um?
              </Text>
              <TouchableOpacity
                style={styles.createBtn}
                activeOpacity={0.85}
                onPress={() => router.push('/groups/new' as any)}
              >
                <Ionicons name="people" size={16} color="#fff" />
                <Text style={styles.createBtnText}>Criar grupo</Text>
              </TouchableOpacity>
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
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 14,
    gap: 10,
    ...Colors.shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.border },
  avatarGroup: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  cardMeta: { fontSize: 13, color: Colors.textTertiary, marginTop: 2 },
  cardDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 19 },
  enterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 44,
    marginTop: 'auto',
  },
  enterBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  enterBtnPending: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primary },
  enterBtnPendingText: { color: Colors.primaryDark, fontSize: 14, fontWeight: '700' },
  loader: { marginTop: 60 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyDesc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', maxWidth: 260 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    height: 44,
    marginTop: 6,
  },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
