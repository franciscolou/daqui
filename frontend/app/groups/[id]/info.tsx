import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Palette } from '../../../constants/Colors';
import { GROUP_PRIVACY_INFO } from '../../../constants/groups';
import { api, GroupDetail, GroupMember, GroupPrivacy, MuteStatus } from '../../../lib/api';
import { User } from '../../../data/mock';
import { useAuth } from '../../../lib/auth';
import { goBack } from '../../../lib/navigation';
import { useTheme, useThemedStyles } from '../../../lib/theme';
import FeedLayout from '../../../components/FeedLayout';
import NotificationMuteRow from '../../../components/NotificationMuteRow';

const PRIVACY_OPTIONS: GroupPrivacy[] = ['public', 'request', 'closed'];

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [neighbors, setNeighbors] = useState<User[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<GroupPrivacy>('closed');
  const [saving, setSaving] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null); // membro em ação
  const [adding, setAdding] = useState(false); // painel de adicionar aberto
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<GroupMember | null>(null); // membro a confirmar remoção

  const apply = useCallback((g: GroupDetail) => {
    setGroup(g);
    setName(g.name);
    setDescription(g.description);
    setPrivacy(g.privacy);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [g] = await Promise.all([api.getGroup(id)]);
      apply(g);
      api.getNeighbors().then(setNeighbors).catch(() => {});
    } catch {
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [id, apply]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = group?.myRole === 'owner' || group?.myRole === 'admin';
  const isOwner = group?.myRole === 'owner';
  const isMember = group?.myRole != null;

  // Referência estável (só muda quando o silenciamento de verdade muda) —
  // sem isso, `NotificationMuteRow` refaria o fetch a cada digitação no nome/
  // descrição (que também vive neste componente e re-renderiza a tela toda).
  const muteInitialStatus = useMemo<MuteStatus | undefined>(
    () => (group ? { isMuted: group.isMuted, mutedUntil: group.mutedUntil } : undefined),
    [group?.isMuted, group?.mutedUntil],
  );

  const dirty =
    !!group &&
    (name.trim() !== group.name ||
      description.trim() !== group.description ||
      privacy !== group.privacy);

  const save = async () => {
    if (!group || !dirty || !name.trim()) return;
    setSaving(true);
    try {
      apply(await api.updateGroup(group.id, { name: name.trim(), description: description.trim(), privacy }));
    } catch {
      // mantém edição
    } finally {
      setSaving(false);
    }
  };

  const pickGroupAvatar = async () => {
    if (!group) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      const asset = res.assets?.[0];
      if (res.canceled || !asset?.base64) return;
      setAvatarBusy(true);
      apply(await api.updateGroupAvatar(group.id, `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`));
    } catch {
      // ignora
    } finally {
      setAvatarBusy(false);
    }
  };

  const memberIds = useMemo(
    () => new Set((group?.members ?? []).map((m) => m.user.id)),
    [group],
  );
  const addable = neighbors.filter((u) => !memberIds.has(u.id));

  const addMember = async (userId: string) => {
    if (!group) return;
    setBusyId(userId);
    try {
      apply(await api.addGroupMember(group.id, userId));
    } catch {
      // ignora
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (userId: string) => {
    if (!group) return;
    setBusyId(userId);
    try {
      apply(await api.removeGroupMember(group.id, userId));
      setPendingRemove(null);
    } catch {
      // ignora
    } finally {
      setBusyId(null);
    }
  };

  const toggleAdmin = async (m: GroupMember) => {
    if (!group) return;
    setBusyId(m.user.id);
    try {
      apply(await api.setGroupAdmin(group.id, m.user.id, m.role !== 'admin'));
    } catch {
      // ignora
    } finally {
      setBusyId(null);
    }
  };

  const join = async () => {
    if (!group) return;
    setSaving(true);
    try {
      apply(await api.joinGroup(group.id));
    } catch {
      setSaving(false);
    } finally {
      setSaving(false);
    }
  };

  const cancelRequest = async () => {
    if (!group) return;
    setSaving(true);
    try {
      await api.cancelJoinRequest(group.id);
      setGroup({ ...group, myRequestPending: false });
    } catch {
      // mantém pendente
    } finally {
      setSaving(false);
    }
  };

  const approveRequest = async (userId: string) => {
    if (!group) return;
    setBusyId(userId);
    try {
      apply(await api.approveGroupJoinRequest(group.id, userId));
    } catch {
      // ignora
    } finally {
      setBusyId(null);
    }
  };

  const rejectRequest = async (userId: string) => {
    if (!group) return;
    setBusyId(userId);
    try {
      apply(await api.rejectGroupJoinRequest(group.id, userId));
    } catch {
      // ignora
    } finally {
      setBusyId(null);
    }
  };

  const leave = async () => {
    if (!group) return;
    try {
      await api.leaveGroup(group.id);
      router.dismissAll?.();
      router.replace('/(tabs)/messages' as any);
    } catch {
      setConfirmLeave(false);
    }
  };

  const remove = async () => {
    if (!group) return;
    try {
      await api.deleteGroup(group.id);
      router.dismissAll?.();
      router.replace('/(tabs)/messages' as any);
    } catch {
      setConfirmDelete(false);
    }
  };

  return (
    <FeedLayout showMobileMenu={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBack(`/groups/${id}` as any)}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informações do grupo</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : !group ? (
        <View style={styles.center}>
          <Text style={styles.emptyDesc}>Grupo não encontrado ou indisponível.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {/* Cartão do grupo */}
          <View style={styles.hero}>
            <View style={styles.heroAvatarWrap}>
              {group.avatar ? (
                <Image source={{ uri: group.avatar }} style={styles.heroAvatar} />
              ) : (
                <View style={[styles.heroAvatar, styles.heroAvatarGroup]}>
                  <Ionicons name="people" size={40} color={Colors.primary} />
                </View>
              )}
              {canManage && (
                <TouchableOpacity
                  style={styles.editAvatarBtn}
                  activeOpacity={0.85}
                  onPress={pickGroupAvatar}
                  disabled={avatarBusy}
                >
                  {avatarBusy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="camera" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.privacyPill}>
              <Ionicons
                name={GROUP_PRIVACY_INFO[group.privacy].icon as any}
                size={13}
                color={group.privacy !== 'closed' ? Colors.primaryDark : Colors.textSecondary}
              />
              <Text
                style={[styles.privacyPillText, group.privacy !== 'closed' && styles.privacyPillTextOpen]}
              >
                {GROUP_PRIVACY_INFO[group.privacy].shortLabel}
              </Text>
            </View>
            <Text style={styles.membersCount}>
              {group.membersCount} {group.membersCount === 1 ? 'membro' : 'membros'}
              {group.neighborhood ? ` · ${group.neighborhood}` : ''}
            </Text>
          </View>

          <NotificationMuteRow
            kind="group"
            id={group.id}
            initialStatus={muteInitialStatus}
            onChange={(s) => setGroup((g) => (g ? { ...g, isMuted: s.isMuted, mutedUntil: s.mutedUntil } : g))}
          />

          {/* Nome/descrição — editável para administradores */}
          {canManage ? (
            <View style={styles.section}>
              <Text style={styles.label}>Nome</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={120} />
              <Text style={styles.label}>Descrição</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Sobre o que é este grupo?"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />
              <Text style={styles.label}>Privacidade</Text>
              <View style={styles.privacyGroup}>
                {PRIVACY_OPTIONS.map((option) => {
                  const info = GROUP_PRIVACY_INFO[option];
                  const optSelected = privacy === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.privacyOption, optSelected && styles.privacyOptionSelected]}
                      activeOpacity={0.8}
                      onPress={() => setPrivacy(option)}
                    >
                      <Ionicons
                        name={info.icon as any}
                        size={18}
                        color={optSelected ? Colors.primary : Colors.textTertiary}
                      />
                      <View style={styles.flex}>
                        <Text style={styles.privacyTitle}>{info.label}</Text>
                        <Text style={styles.privacyDesc}>{info.description}</Text>
                      </View>
                      <Ionicons
                        name={optSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={optSelected ? Colors.primary : Colors.border}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              {dirty && (
                <TouchableOpacity
                  style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
                  onPress={save}
                  disabled={saving || !name.trim()}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Salvar alterações</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.groupName}>{group.name}</Text>
              {!!group.description && <Text style={styles.groupDesc}>{group.description}</Text>}
            </View>
          )}

          {/* Solicitações de entrada pendentes (grupo "request") */}
          {canManage && group.joinRequests.length > 0 && (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>
                  Solicitações pendentes ({group.joinRequests.length})
                </Text>
              </View>
              <View style={styles.addPanel}>
                {group.joinRequests.map((r) => (
                  <View key={r.user.id} style={styles.memberRow}>
                    <Image source={{ uri: r.user.avatar }} style={styles.memberAvatar} />
                    <View style={styles.flex}>
                      <Text style={styles.memberName} numberOfLines={1}>{r.user.name}</Text>
                      <Text style={styles.memberSub} numberOfLines={1}>@{r.user.username}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => rejectRequest(r.user.id)}
                      disabled={busyId === r.user.id}
                      accessibilityLabel={`Recusar ${r.user.name}`}
                    >
                      <Ionicons name="close-circle-outline" size={22} color={Colors.error} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => approveRequest(r.user.id)}
                      disabled={busyId === r.user.id}
                      activeOpacity={0.85}
                      accessibilityLabel={`Aprovar ${r.user.name}`}
                    >
                      {busyId === r.user.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Membros */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Membros</Text>
            {canManage && addable.length > 0 && (
              <TouchableOpacity style={styles.addToggle} onPress={() => setAdding((a) => !a)}>
                <Ionicons name={adding ? 'close' : 'person-add'} size={16} color={Colors.primary} />
                <Text style={styles.addToggleText}>{adding ? 'Fechar' : 'Adicionar'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Painel de adicionar membros (vizinhos ainda não no grupo) */}
          {canManage && adding && (
            <View style={styles.addPanel}>
              {addable.length === 0 ? (
                <Text style={styles.emptyDesc}>Todos os seus vizinhos já estão no grupo.</Text>
              ) : (
                addable.map((u) => (
                  <View key={u.id} style={styles.memberRow}>
                    <Image source={{ uri: u.avatar }} style={styles.memberAvatar} />
                    <View style={styles.flex}>
                      <Text style={styles.memberName} numberOfLines={1}>{u.name}</Text>
                      <Text style={styles.memberSub} numberOfLines={1}>@{u.username}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => addMember(u.id)}
                      disabled={busyId === u.id}
                      activeOpacity={0.85}
                    >
                      {busyId === u.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Ionicons name="add" size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}

          {group.members.map((m) => {
            const mine = m.user.id === me?.id;
            const isOwnerRow = m.role === 'owner';
            const isAdminRow = m.role === 'admin';
            // Quem posso remover: dono remove todos (menos ele); admin remove só membros comuns.
            const canRemove =
              canManage && !isOwnerRow && !mine && (isOwner || m.role === 'member');
            return (
              <TouchableOpacity
                key={m.user.id}
                style={styles.memberRow}
                activeOpacity={0.8}
                onPress={() => router.push(`/user/${m.user.id}` as any)}
              >
                <Image source={{ uri: m.user.avatar }} style={styles.memberAvatar} />
                <View style={styles.flex}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.user.name}{mine ? ' (você)' : ''}
                  </Text>
                  <Text style={styles.memberSub} numberOfLines={1}>@{m.user.username}</Text>
                </View>
                {(isOwnerRow || isAdminRow) && (
                  <View style={[styles.roleBadge, isOwnerRow && styles.roleBadgeOwner]}>
                    <Text style={[styles.roleBadgeText, isOwnerRow && styles.roleBadgeTextOwner]}>
                      {isOwnerRow ? 'Dono' : 'Admin'}
                    </Text>
                  </View>
                )}
                {/* Dono nomeia/remove admins */}
                {isOwner && !isOwnerRow && (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => toggleAdmin(m)}
                    disabled={busyId === m.user.id}
                  >
                    <Ionicons
                      name={isAdminRow ? 'shield' : 'shield-outline'}
                      size={20}
                      color={isAdminRow ? Colors.primary : Colors.textTertiary}
                    />
                  </TouchableOpacity>
                )}
                {canRemove && (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => setPendingRemove(m)}
                    disabled={busyId === m.user.id}
                    accessibilityLabel={`Remover ${m.user.name}`}
                  >
                    {busyId === m.user.id ? (
                      <ActivityIndicator color={Colors.error} size="small" />
                    ) : (
                      <Ionicons name="person-remove-outline" size={20} color={Colors.error} />
                    )}
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Ações finais */}
          <View style={styles.footer}>
            {!isMember && group.privacy === 'public' && (
              <TouchableOpacity style={styles.primaryAction} onPress={join} disabled={saving} activeOpacity={0.85}>
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="enter-outline" size={18} color="#fff" />
                    <Text style={styles.primaryActionText}>Entrar no grupo</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {!isMember && group.privacy === 'request' && !group.myRequestPending && (
              <TouchableOpacity style={styles.primaryAction} onPress={join} disabled={saving} activeOpacity={0.85}>
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                    <Text style={styles.primaryActionText}>Solicitar entrada</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {!isMember && group.privacy === 'request' && group.myRequestPending && (
              <TouchableOpacity
                style={styles.pendingAction}
                onPress={cancelRequest}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.primaryDark} size="small" />
                ) : (
                  <>
                    <Ionicons name="time-outline" size={18} color={Colors.primaryDark} />
                    <Text style={styles.pendingActionText}>Solicitação enviada · toque para cancelar</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {isMember && !isOwner && (
              <TouchableOpacity
                style={styles.dangerAction}
                onPress={() => (confirmLeave ? leave() : setConfirmLeave(true))}
                activeOpacity={0.85}
              >
                <Ionicons name="exit-outline" size={18} color={Colors.error} />
                <Text style={styles.dangerActionText}>
                  {confirmLeave ? 'Toque de novo para sair' : 'Sair do grupo'}
                </Text>
              </TouchableOpacity>
            )}

            {isOwner && (
              <TouchableOpacity
                style={styles.dangerAction}
                onPress={() => (confirmDelete ? remove() : setConfirmDelete(true))}
                activeOpacity={0.85}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
                <Text style={styles.dangerActionText}>
                  {confirmDelete ? 'Toque de novo para excluir' : 'Excluir grupo'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* Modal de confirmação para remover um membro */}
      <Modal
        visible={!!pendingRemove}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingRemove(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPendingRemove(null)} tabIndex={-1}>
          <Pressable style={styles.modalCard} onPress={() => {}} tabIndex={-1}>
            <View style={styles.modalIcon}>
              <Ionicons name="person-remove" size={26} color={Colors.error} />
            </View>
            <Text style={styles.modalTitle}>Remover membro</Text>
            <Text style={styles.modalMessage}>
              Tem certeza que deseja remover{' '}
              <Text style={styles.modalName}>{pendingRemove?.user.name}</Text> do grupo?
              Essa pessoa perderá o acesso à conversa.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setPendingRemove(null)}
                activeOpacity={0.85}
                disabled={!!busyId}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnRemove]}
                onPress={() => pendingRemove && removeMember(pendingRemove.user.id)}
                activeOpacity={0.85}
                disabled={!!busyId}
              >
                {busyId ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalBtnRemoveText}>Remover</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </FeedLayout>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
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
  backBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: Colors.text },
  body: { padding: 16, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  heroAvatarWrap: { position: 'relative' },
  editAvatarBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  heroAvatar: { width: 88, height: 88, borderRadius: 28, backgroundColor: Colors.border },
  heroAvatarGroup: {
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  privacyPillText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  privacyPillTextOpen: { color: Colors.primaryDark },
  membersCount: { fontSize: 13, color: Colors.textTertiary },
  section: {
    marginTop: 18,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 6,
  },
  groupName: { fontSize: 18, fontWeight: '800', color: Colors.text },
  groupDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginTop: 8 },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
    outlineStyle: 'none',
  } as any,
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  privacyGroup: { gap: 8, marginTop: 6 },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  privacyOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  privacyTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  privacyDesc: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  saveBtn: {
    marginTop: 14,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.textTertiary, opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addToggle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addToggleText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  addPanel: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 8,
    marginBottom: 8,
  },
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
  roleBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleBadgeOwner: { backgroundColor: Colors.accentLight },
  roleBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.primaryDark },
  roleBadgeTextOwner: { color: Colors.accent },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  footer: { marginTop: 28, gap: 12 },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 48,
  },
  primaryActionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pendingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    height: 48,
  },
  pendingActionText: { color: Colors.primaryDark, fontSize: 15, fontWeight: '700' },
  dangerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dangerSurface,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    borderRadius: 12,
    height: 48,
  },
  dangerActionText: { color: Colors.error, fontSize: 15, fontWeight: '700' },
  emptyDesc: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center' },

  // Modal de confirmação
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    gap: 10,
    ...Colors.shadow.lg,
  },
  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.dangerSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  modalMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalName: { fontWeight: '700', color: Colors.text },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12, alignSelf: 'stretch' },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  modalBtnCancelText: { fontSize: 15, fontWeight: '700', color: Colors.text },
  modalBtnRemove: { backgroundColor: Colors.error },
  modalBtnRemoveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
