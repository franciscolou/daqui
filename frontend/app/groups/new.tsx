import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { GROUP_PRIVACY_INFO } from '../../constants/groups';
import { api, GroupPrivacy } from '../../lib/api';
import { User } from '../../data/mock';
import { useTheme, useThemedStyles } from '../../lib/theme';
import FeedLayout from '../../components/FeedLayout';

const PRIVACY_OPTIONS: GroupPrivacy[] = ['public', 'request', 'closed'];

export default function NewGroupScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<GroupPrivacy>('closed');
  const [neighbors, setNeighbors] = useState<User[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.getNeighbors().then(setNeighbors).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canCreate = name.trim().length > 0 && !creating;

  const create = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const group = await api.createGroup({
        name: name.trim(),
        description: description.trim(),
        privacy,
        memberIds: [...selected],
      });
      router.replace(`/groups/${group.id}` as any);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível criar o grupo');
      setCreating(false);
    }
  };

  return (
    <FeedLayout showMobileMenu={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo grupo</Text>
        <TouchableOpacity
          style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
          onPress={create}
          disabled={!canCreate}
          activeOpacity={0.85}
        >
          {creating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.createBtnText}>Criar</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <Text style={styles.label}>Nome do grupo</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: Vizinhos da Rua das Flores"
          placeholderTextColor={Colors.textTertiary}
          value={name}
          onChangeText={setName}
          maxLength={120}
        />

        <Text style={styles.label}>Descrição (opcional)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Sobre o que é este grupo?"
          placeholderTextColor={Colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>Privacidade</Text>
        <View style={styles.privacyGroup}>
          {PRIVACY_OPTIONS.map((option) => {
            const info = GROUP_PRIVACY_INFO[option];
            const selected = privacy === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.privacyRow, selected && styles.privacyRowSelected]}
                activeOpacity={0.8}
                onPress={() => setPrivacy(option)}
              >
                <View style={[styles.privacyIcon, selected && styles.privacyIconSelected]}>
                  <Ionicons
                    name={info.icon as any}
                    size={20}
                    color={selected ? Colors.primary : Colors.textTertiary}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.privacyTitle}>{info.label}</Text>
                  <Text style={styles.privacyDesc}>{info.description}</Text>
                </View>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? Colors.primary : Colors.border}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>
          Adicionar membros {selected.size > 0 ? `(${selected.size})` : ''}
        </Text>
        {neighbors.length === 0 ? (
          <Text style={styles.emptyNeighbors}>Nenhum vizinho para adicionar por enquanto.</Text>
        ) : (
          neighbors.map((u) => {
            const on = selected.has(u.id);
            return (
              <TouchableOpacity
                key={u.id}
                style={styles.memberRow}
                activeOpacity={0.8}
                onPress={() => toggle(u.id)}
              >
                <Image source={{ uri: u.avatar }} style={styles.memberAvatar} />
                <View style={styles.flex}>
                  <Text style={styles.memberName} numberOfLines={1}>{u.name}</Text>
                  <Text style={styles.memberSub} numberOfLines={1}>@{u.username}</Text>
                </View>
                <View style={[styles.checkbox, on && styles.checkboxOn]}>
                  {on && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </FeedLayout>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
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
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: Colors.text },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 11,
    paddingHorizontal: 18,
    height: 38,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnDisabled: { backgroundColor: Colors.textTertiary, opacity: 0.5 },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  body: { padding: 16, gap: 8, paddingBottom: 40 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 2,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    outlineStyle: 'none',
  } as any,
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  privacyGroup: { gap: 10 },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
  },
  privacyRowSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  privacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyIconSelected: { backgroundColor: Colors.surface },
  privacyTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  privacyDesc: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  emptyNeighbors: { fontSize: 13, color: Colors.textTertiary, paddingVertical: 8 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  memberAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.border },
  memberName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  memberSub: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  error: { color: Colors.error, fontSize: 13, marginTop: 12 },
});
