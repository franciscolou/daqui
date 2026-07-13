import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { Palette } from '../constants/Colors';
import { api, ApiError, UserSession } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTheme, useThemedStyles, useThemeMode } from '../lib/theme';
import { formatExactDateTime } from '../lib/time';
import LeftSidebar from '../components/LeftSidebar';
import MobileMenu from '../components/MobileMenu';
import { CONTENT_MAX_W } from '../components/WideLayout';

const WIDE = 900;
// Larguras fixas das colunas (mesmo modelo do FeedLayout, centralizado).
const LEFT_W = 220;
const MIDDLE_W = 300;
const DETAIL_W = 640;

type TopicKey = 'edit-profile' | 'privacy' | 'notifications' | 'address' | 'appearance';

interface Topic {
  key: TopicKey;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TOPICS: Topic[] = [
  { key: 'edit-profile', label: 'Editar perfil',           desc: 'Nome, usuário e bio',            icon: 'person-outline' },
  { key: 'privacy',   label: 'Privacidade e segurança', desc: 'Quem vê seu perfil e sua senha', icon: 'lock-closed-outline' },
  { key: 'notifications',  label: 'Notificações',            desc: 'O que chega até você',           icon: 'notifications-outline' },
  { key: 'address',      label: 'Meu endereço',            desc: 'Bairro e localização',           icon: 'location-outline' },
  { key: 'appearance',     label: 'Aparência',               desc: 'Tema claro ou escuro',           icon: 'color-palette-outline' },
];

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const [selected, setSelected] = useState<TopicKey>('edit-profile');
  // Em telas estreitas usamos master-detail: a lista abre o painel do tópico.
  const [detailOpen, setDetailOpen] = useState(false);

  const current = TOPICS.find((t) => t.key === selected)!;

  const openTopic = (key: TopicKey) => {
    setSelected(key);
    setDetailOpen(true);
  };

  const topicItems = TOPICS.map((t) => {
    const active = isWide && t.key === selected;
    return (
      <TouchableOpacity
        key={t.key}
        style={[styles.topicRow, active && styles.topicRowActive]}
        activeOpacity={0.7}
        onPress={() => (isWide ? setSelected(t.key) : openTopic(t.key))}
      >
        <View style={[styles.topicIcon, active && styles.topicIconActive]}>
          <Ionicons name={t.icon} size={18} color={active ? '#fff' : Colors.textSecondary} />
        </View>
        <View style={styles.topicText}>
          <Text style={[styles.topicLabel, active && styles.topicLabelActive]}>{t.label}</Text>
          <Text style={styles.topicDesc} numberOfLines={1}>{t.desc}</Text>
        </View>
        {!isWide && <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />}
      </TouchableOpacity>
    );
  });

  const topicList = (
    <>
      <View style={styles.topicHeader}>
        <Text style={styles.topicHeaderTitle}>Configurações</Text>
      </View>
      {topicItems}
    </>
  );

  const detailInner = (
    <>
      <View style={styles.detailHeader}>
        {!isWide && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setDetailOpen(false)} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}
        <View style={styles.detailHeaderText}>
          <Text style={styles.detailTitle}>{current.label}</Text>
          <Text style={styles.detailSub}>{current.desc}</Text>
        </View>
      </View>
      <Panel topic={selected} />
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isWide ? (
        <View style={[styles.wideBody, { paddingLeft: Math.max(0, (width - CONTENT_MAX_W) / 2) }]}>
          <ScrollView style={styles.leftCol} showsVerticalScrollIndicator={false}>
            <LeftSidebar />
          </ScrollView>
          <ScrollView
            style={styles.middleCol}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.topicListContent}
          >
            {topicList}
          </ScrollView>
          <ScrollView
            style={styles.detailCol}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.detailContent}
          >
            {detailInner}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.mobileBody}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={detailOpen ? styles.detailContent : styles.topicListContent}
          >
            {detailOpen ? detailInner : topicList}
          </ScrollView>
        </View>
      )}
      {!isWide && <MobileMenu />}
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Painéis por tópico                                                  */
/* ------------------------------------------------------------------ */

function Panel({ topic }: { topic: TopicKey }) {
  switch (topic) {
    case 'edit-profile':   return <EditProfilePanel />;
    case 'privacy':     return <PrivacyPanel />;
    case 'notifications':    return <NotificationsPanel />;
    case 'address':        return <AddressPanel />;
    case 'appearance':       return <AppearancePanel />;
  }
}

const USERNAME_RE = /^[a-z0-9._]{3,18}$/;

type UsernameStatus = 'idle' | 'checking' | 'invalid' | 'taken' | 'available';

function EditProfilePanel() {
  const { user, refresh } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const [username, setUsername] = useState(user?.username ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [neighborhood, setNeighborhood] = useState(user?.neighborhood ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [uStatus, setUStatus] = useState<UsernameStatus>('idle');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // Validação dinâmica do nome de usuário (formato local + disponibilidade no servidor, com debounce).
  useEffect(() => {
    const uname = username.trim().toLowerCase();
    if (!user || uname === (user.username ?? '')) {
      setUStatus('idle');
      return;
    }
    if (!USERNAME_RE.test(uname)) {
      setUStatus('invalid');
      return;
    }
    setUStatus('checking');
    let cancelled = false;
    const t = setTimeout(() => {
      api.checkUsername(uname)
        .then((r) => { if (!cancelled) setUStatus(r.available ? 'available' : 'taken'); })
        .catch(() => { if (!cancelled) setUStatus('idle'); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username, user]);

  const usernameBlocked = uStatus === 'invalid' || uStatus === 'taken' || uStatus === 'checking';

  const pickAvatar = async () => {
    setFeedback(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setFeedback({ ok: false, text: 'Permita o acesso às fotos para trocar o avatar.' });
        return;
      }
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
      await api.updateAvatar(`data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
      await refresh();
      setFeedback({ ok: true, text: 'Foto de perfil atualizada!' });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : 'Não foi possível atualizar a foto.' });
    } finally {
      setAvatarBusy(false);
    }
  };

  const save = async () => {
    setFeedback(null);
    const uname = username.trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) {
      setFeedback({ ok: false, text: 'Nome de usuário: 3–18 caracteres, use apenas letras minúsculas, números, ponto ou _.' });
      return;
    }
    if (uStatus === 'taken') {
      setFeedback({ ok: false, text: 'Este nome de usuário já está em uso.' });
      return;
    }
    if (!name.trim()) {
      setFeedback({ ok: false, text: 'O nome de exibição não pode ficar vazio.' });
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({
        username: uname,
        name: name.trim(),
        bio: bio.trim(),
        neighborhood: neighborhood.trim(),
      });
      await refresh();
      setUsername(uname);
      setFeedback({ ok: true, text: 'Perfil atualizado com sucesso!' });
    } catch (e) {
      const text = e instanceof ApiError ? e.message : 'Não foi possível salvar. Tente novamente.';
      setFeedback({ ok: false, text });
    } finally {
      setSaving(false);
    }
  };

  const USERNAME_STATUS: Record<Exclude<UsernameStatus, 'idle'>, { text: string; tone: 'ok' | 'err' | 'muted' }> = {
    checking:  { text: 'Verificando disponibilidade…', tone: 'muted' },
    invalid:   { text: '3–18 caracteres: apenas letras minúsculas, números, ponto ou _.', tone: 'err' },
    taken:     { text: 'Este nome de usuário já está em uso.', tone: 'err' },
    available: { text: 'Nome de usuário disponível!', tone: 'ok' },
  };
  const status = uStatus === 'idle' ? null : USERNAME_STATUS[uStatus];

  return (
    <View style={styles.panelGroup}>
      <View style={styles.avatarRow}>
        <Image source={{ uri: user?.avatar }} style={styles.avatar} />
        <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={pickAvatar} disabled={avatarBusy}>
          {avatarBusy ? (
            <ActivityIndicator size="small" color={Colors.text} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={16} color={Colors.text} />
              <Text style={styles.secondaryBtnText}>Alterar foto</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Field
        label="Nome de usuário"
        value={username}
        onChangeText={setUsername}
        placeholder="seunome"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={18}
        prefix="@"
      />
      {status ? (
        <Text
          style={[
            styles.usernameStatus,
            status.tone === 'ok' && styles.feedbackOk,
            status.tone === 'err' && styles.feedbackErr,
          ]}
        >
          {status.text}
        </Text>
      ) : (
        <Text style={styles.fieldHint}>Seu identificador único. Sem espaços, apenas letras minúsculas, números, ponto ou _.</Text>
      )}

      <Field
        label="Nome de exibição"
        value={name}
        onChangeText={setName}
        placeholder="Como você quer aparecer"
        hint="Pode ter espaços, acentos e emojis. Não precisa ser único."
      />
      <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Fale um pouco sobre você" multiline />
      <Field label="Bairro" value={neighborhood} onChangeText={setNeighborhood} placeholder="Seu bairro" />

      {feedback && (
        <Text style={[styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr]}>
          {feedback.text}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.saveBtn, (saving || usernameBlocked) && styles.saveBtnDisabled]}
        activeOpacity={0.85}
        onPress={save}
        disabled={saving || usernameBlocked}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Salvar alterações</Text>}
      </TouchableOpacity>
    </View>
  );
}

function PrivacyPanel() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.panelGroup}>
      <SectionTitle>Visibilidade</SectionTitle>
      <ToggleRow label="Perfil privado" desc="Só vizinhos aprovados veem seus posts" defaultValue={false} />
      <ToggleRow label="Mostrar localização aproximada" desc="Exibe seu bairro no perfil" defaultValue />
      <ToggleRow label="Aparecer em buscas" desc="Permite que vizinhos encontrem seu perfil" defaultValue />

      <SectionTitle>Segurança</SectionTitle>
      <TwoFactorSection />
      <ChangePasswordSection />
      <ConnectedDevicesSection />
    </View>
  );
}

/**
 * Alteração de senha: pede a senha atual + a nova (com confirmação). Expande
 * inline a partir de uma linha de link, no mesmo padrão da seção de A2F.
 */
function ChangePasswordSection() {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const reset = () => {
    setExpanded(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setFeedback(null);
  };

  const toggle = () => {
    if (expanded) {
      reset();
    } else {
      setFeedback(null);
      setExpanded(true);
    }
  };

  const submit = async () => {
    setFeedback(null);
    if (newPassword.length < 6) {
      setFeedback({ ok: false, text: 'A nova senha deve ter ao menos 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ ok: false, text: 'A confirmação não confere com a nova senha.' });
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      reset();
      setFeedback({ ok: true, text: 'Senha alterada com sucesso!' });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : 'Não foi possível alterar a senha.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.settingRow}
        activeOpacity={0.7}
        onPress={toggle}
      >
        <View style={styles.linkIcon}>
          <Ionicons name="key-outline" size={18} color={Colors.textSecondary} />
        </View>
        <Text style={[styles.settingLabel, styles.linkLabel]}>Alterar senha</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={18} color={Colors.textTertiary} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.twoFaCard}>
          <Field
            label="Senha atual"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Sua senha atual"
            secureToggle
          />
          <Field
            label="Nova senha"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Ao menos 6 caracteres"
            secureToggle
          />
          <Field
            label="Confirmar nova senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repita a nova senha"
            secureToggle
          />
          {feedback && (
            <Text style={[styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr]}>{feedback.text}</Text>
          )}
          <View style={styles.twoFaBtnRow}>
            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={reset} disabled={busy}>
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.twoFaPrimaryBtn, (busy || !currentPassword || !newPassword || !confirmPassword) && styles.saveBtnDisabled]}
              activeOpacity={0.85}
              onPress={submit}
              disabled={busy || !currentPassword || !newPassword || !confirmPassword}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Salvar nova senha</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Dispositivos conectados: lista as sessões ativas (login atual + outros
 * dispositivos), com nome do dispositivo e quando a sessão começou. A sessão
 * atual não pode ser desconectada por aqui — só as demais.
 */
function ConnectedDevicesSection() {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<UserSession[] | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getSessions();
      setSessions(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível carregar os dispositivos.');
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && sessions === null) load();
  };

  const disconnect = async (session: UserSession) => {
    setRevokingId(session.id);
    try {
      await api.revokeSession(session.id);
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== session.id) : prev));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível desconectar esse dispositivo.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.settingRow} activeOpacity={0.7} onPress={toggle}>
        <View style={styles.linkIcon}>
          <Ionicons name="phone-portrait-outline" size={18} color={Colors.textSecondary} />
        </View>
        <Text style={[styles.settingLabel, styles.linkLabel]}>Dispositivos conectados</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={18} color={Colors.textTertiary} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.twoFaCard}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : error ? (
            <Text style={styles.feedbackErr}>{error}</Text>
          ) : !sessions?.length ? (
            <Text style={styles.fieldHint}>Nenhuma sessão ativa encontrada.</Text>
          ) : (
            sessions.map((session) => (
              <View key={session.id} style={styles.deviceRow}>
                <View style={styles.linkIcon}>
                  <Ionicons name="hardware-chip-outline" size={16} color={Colors.textSecondary} />
                </View>
                <View style={styles.settingText}>
                  <View style={styles.deviceNameRow}>
                    <Text style={styles.settingLabel}>{session.deviceName}</Text>
                    {session.isCurrent && (
                      <View style={styles.devicePill}>
                        <Text style={styles.devicePillText}>Este dispositivo</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.settingDesc}>Sessão iniciada em {formatExactDateTime(session.createdAt)}</Text>
                </View>
                {!session.isCurrent && (
                  <TouchableOpacity
                    style={styles.deviceDisconnectBtn}
                    activeOpacity={0.7}
                    onPress={() => disconnect(session)}
                    disabled={revokingId === session.id}
                  >
                    {revokingId === session.id ? (
                      <ActivityIndicator size="small" color={Colors.error} />
                    ) : (
                      <Text style={styles.deviceDisconnectText}>Desconectar</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Autenticação de dois fatores (A2F/TOTP). Fluxo:
 * - desativada → "Ativar" chama /auth/2fa/setup, mostra o segredo p/ o app
 *   autenticador e pede o código de confirmação (/auth/2fa/enable).
 * - ativada → "Desativar" pede um código válido (/auth/2fa/disable).
 */
function TwoFactorSection() {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const { user, refresh } = useAuth();
  const enabled = !!user?.twoFactorEnabled;

  const [mode, setMode] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard;

  const reset = () => {
    setMode('idle');
    setSetup(null);
    setCode('');
    setFeedback(null);
    setCopied(false);
  };

  const startSetup = async () => {
    setFeedback(null);
    setBusy(true);
    try {
      const s = await api.start2faSetup();
      setSetup(s);
      setCode('');
      setMode('setup');
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : 'Não foi possível iniciar a configuração.' });
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    if (code.length < 6) {
      setFeedback({ ok: false, text: 'Digite o código de 6 dígitos do app autenticador.' });
      return;
    }
    setFeedback(null);
    setBusy(true);
    try {
      await api.enable2fa(code);
      await refresh();
      reset();
      setFeedback({ ok: true, text: 'Autenticação de dois fatores ativada!' });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : 'Código inválido. Tente novamente.' });
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    if (code.length < 6) {
      setFeedback({ ok: false, text: 'Digite o código de 6 dígitos do app autenticador.' });
      return;
    }
    setFeedback(null);
    setBusy(true);
    try {
      await api.disable2fa(code);
      await refresh();
      reset();
      setFeedback({ ok: true, text: 'Autenticação de dois fatores desativada.' });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : 'Código inválido. Tente novamente.' });
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    if (!setup || !canCopy) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const codeField = (onSubmit: () => void) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Código de verificação</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.input, styles.codeInput]}
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
          placeholder="000000"
          placeholderTextColor={Colors.textTertiary}
          keyboardType="number-pad"
          maxLength={6}
          onSubmitEditing={onSubmit}
        />
      </View>
    </View>
  );

  return (
    <View>
      <View style={styles.twoFaHeaderRow}>
        <View style={styles.linkIcon}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textSecondary} />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingLabel}>Autenticação de dois fatores</Text>
          <Text style={styles.settingDesc}>Um código do app autenticador a cada login</Text>
        </View>
        <View style={[styles.twoFaBadge, enabled ? styles.twoFaBadgeOn : styles.twoFaBadgeOff]}>
          <Text style={[styles.twoFaBadgeText, enabled ? styles.twoFaBadgeTextOn : styles.twoFaBadgeTextOff]}>
            {enabled ? 'Ativada' : 'Desativada'}
          </Text>
        </View>
      </View>

      {/* Passo a passo de ativação */}
      {mode === 'setup' && setup && (
        <View style={styles.twoFaCard}>
          <Text style={styles.twoFaStep}>1. Escaneie o QR code com seu app autenticador (Google Authenticator, Authy…).</Text>
          <View style={styles.qrBox}>
            <QRCode value={setup.otpauthUrl} size={180} backgroundColor="#fff" color="#000" />
          </View>

          <View style={styles.manualKey}>
            <Text style={styles.manualKeyLabel}>Não consegue escanear? Use a chave manual:</Text>
            <View style={styles.secretRow}>
              <Text selectable style={styles.secretText}>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</Text>
              {canCopy && (
                <TouchableOpacity style={styles.copyBtn} onPress={copySecret} activeOpacity={0.7}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={Colors.primary} />
                  <Text style={styles.copyBtnText}>{copied ? 'Copiado' : 'Copiar'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.twoFaStep}>2. Digite o código de 6 dígitos que o app mostrar para confirmar.</Text>
          {codeField(confirmEnable)}
          {feedback && (
            <Text style={[styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr]}>{feedback.text}</Text>
          )}
          <View style={styles.twoFaBtnRow}>
            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={reset} disabled={busy}>
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.twoFaPrimaryBtn, busy && styles.saveBtnDisabled]} activeOpacity={0.85} onPress={confirmEnable} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Confirmar e ativar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Confirmação de desativação */}
      {mode === 'disable' && (
        <View style={styles.twoFaCard}>
          <Text style={styles.twoFaStep}>Digite um código atual do seu app autenticador para desativar a A2F.</Text>
          {codeField(confirmDisable)}
          {feedback && (
            <Text style={[styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr]}>{feedback.text}</Text>
          )}
          <View style={styles.twoFaBtnRow}>
            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={reset} disabled={busy}>
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.twoFaDangerBtn, busy && styles.saveBtnDisabled]} activeOpacity={0.85} onPress={confirmDisable} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Desativar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Ações padrão (sem fluxo aberto) */}
      {mode === 'idle' && (
        <>
          {feedback && (
            <Text style={[styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr]}>{feedback.text}</Text>
          )}
          {enabled ? (
            <TouchableOpacity style={styles.twoFaOutlineDanger} activeOpacity={0.8} onPress={() => { setFeedback(null); setCode(''); setMode('disable'); }}>
              <Ionicons name="lock-open-outline" size={16} color={Colors.error} />
              <Text style={styles.twoFaOutlineDangerText}>Desativar autenticação de dois fatores</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.twoFaOutline} activeOpacity={0.8} onPress={startSetup} disabled={busy}>
              {busy ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
                  <Text style={styles.twoFaOutlineText}>Ativar autenticação de dois fatores</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

function NotificationsPanel() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.panelGroup}>
      <SectionTitle>No aplicativo</SectionTitle>
      <ToggleRow label="Curtidas" desc="Quando curtirem seus posts" defaultValue />
      <ToggleRow label="Comentários" desc="Respostas e menções" defaultValue />
      <ToggleRow label="Mensagens" desc="Novas conversas e respostas" defaultValue />
      <ToggleRow label="Novos vizinhos" desc="Quando alguém entra no seu bairro" defaultValue={false} />
      <ToggleRow label="Avisos do bairro" desc="Alertas de segurança e eventos" defaultValue />

      <SectionTitle>Por email</SectionTitle>
      <ToggleRow label="Resumo semanal" desc="O que rolou no seu bairro" defaultValue={false} />
    </View>
  );
}

function AddressPanel() {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const { user } = useAuth();
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState(user?.neighborhood ?? '');

  return (
    <View style={styles.panelGroup}>
      <View style={styles.addressLockedWrap}>
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
          <Text style={styles.infoBoxText}>Seu endereço exato nunca é exibido — usamos só o bairro para montar seu feed.</Text>
        </View>

        <Field label="CEP" value={cep} onChangeText={setCep} placeholder="00000-000" keyboardType="numeric" editable={false} />
        <Field label="Rua" value={rua} onChangeText={setRua} placeholder="Nome da rua" editable={false} />
        <View style={styles.rowFields}>
          <View style={styles.rowFieldSmall}>
            <Field label="Número" value={numero} onChangeText={setNumero} placeholder="123" keyboardType="numeric" editable={false} />
          </View>
          <View style={styles.rowFieldFlex}>
            <Field label="Complemento" value={complemento} onChangeText={setComplemento} placeholder="Apto, bloco…" editable={false} />
          </View>
        </View>
        <Field label="Bairro" value={bairro} onChangeText={setBairro} placeholder="Seu bairro" editable={false} />

        <VisualSaveButton disabled />

        <View style={styles.lockOverlay} pointerEvents="none">
          <Ionicons name="lock-closed" size={22} color={Colors.textSecondary} style={styles.lockIcon} />
          <Text style={styles.lockText}>
            Em breve, apenas moradores comprovados poderão pertencer às comunidades com o selo de Morador.
          </Text>
        </View>
      </View>
    </View>
  );
}

function AppearancePanel() {
  const styles = useThemedStyles(makeStyles);
  const { mode, toggle } = useThemeMode();
  return (
    <View style={styles.panelGroup}>
      <SectionTitle>Tema</SectionTitle>
      <ToggleRow
        label="Modo escuro"
        desc="Reduz o brilho em ambientes com pouca luz"
        value={mode === 'dark'}
        onValueChange={toggle}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Blocos reutilizáveis                                                */
/* ------------------------------------------------------------------ */

function SectionTitle({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Field({
  label,
  multiline,
  hint,
  prefix,
  editable = true,
  secureToggle = false,
  ...props
}: {
  label: string;
  multiline?: boolean;
  hint?: string;
  prefix?: string;
  secureToggle?: boolean; // mostra o botão de olho e controla secureTextEntry internamente
} & React.ComponentProps<typeof TextInput>) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, multiline && styles.inputWrapMultiline, !editable && styles.inputWrapDisabled]}>
        {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          placeholderTextColor={Colors.textTertiary}
          multiline={multiline}
          editable={editable}
          {...props}
          secureTextEntry={secureToggle ? !visible : props.secureTextEntry}
        />
        {secureToggle && (
          <TouchableOpacity onPress={() => setVisible((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

function ToggleRow({
  label,
  desc,
  defaultValue = false,
  value,
  onValueChange,
}: {
  label: string;
  desc?: string;
  defaultValue?: boolean;
  value?: boolean;
  onValueChange?: (v: boolean) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const [internal, setInternal] = useState(defaultValue);
  const isOn = value ?? internal;
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        {desc && <Text style={styles.settingDesc}>{desc}</Text>}
      </View>
      <Switch
        value={isOn}
        onValueChange={onValueChange ?? setInternal}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

function VisualSaveButton({ disabled = false }: { disabled?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.saveBtn, disabled && styles.saveBtnDisabled]}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <Text style={styles.saveBtnText}>Salvar alterações</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  wideBody: { flex: 1, flexDirection: 'row', backgroundColor: Colors.background },
  leftCol: {
    width: LEFT_W,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: Colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  middleCol: {
    width: MIDDLE_W,
    flexShrink: 0,
    backgroundColor: Colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  detailCol: { width: DETAIL_W, flexShrink: 1, minWidth: 0, backgroundColor: Colors.background },
  mobileBody: { flex: 1, backgroundColor: Colors.surface },

  // Lista de tópicos
  topicListContent: { padding: 12 },
  topicHeader: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12 },
  topicHeaderTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  topicRowActive: { backgroundColor: Colors.primaryFaint },
  topicIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  topicIconActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  topicText: { flex: 1, minWidth: 0 },
  topicLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  topicLabelActive: { color: Colors.primary, fontWeight: '700' },
  topicDesc: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },

  // Painel de detalhe
  detailContent: { padding: 24, paddingBottom: 60 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  detailHeaderText: { flex: 1, minWidth: 0 },
  detailTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 },
  detailSub: { fontSize: 14, color: Colors.textTertiary, marginTop: 2 },

  panelGroup: { gap: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 4,
  },

  // Campos de formulário
  field: { gap: 6, marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  fieldHint: { fontSize: 12, color: Colors.textTertiary, lineHeight: 16 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
  },
  inputWrapMultiline: { alignItems: 'flex-start' },
  inputWrapDisabled: { opacity: 0.6 },
  inputPrefix: { fontSize: 15, color: Colors.textTertiary, fontWeight: '600' },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.text },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  eyeBtn: { padding: 4, borderRadius: 8 },
  rowFields: { flexDirection: 'row', gap: 12 },
  rowFieldSmall: { width: 110 },
  rowFieldFlex: { flex: 1, minWidth: 0 },

  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  avatar: { width: 72, height: 72, borderRadius: 20 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: Colors.text },

  // Linhas de configuração (toggle / link)
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  settingText: { flex: 1, minWidth: 0 },
  settingLabel: { fontSize: 15, fontWeight: '500', color: Colors.text },
  settingDesc: { fontSize: 13, color: Colors.textTertiary, marginTop: 2 },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  linkLabel: { flex: 1 },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.primaryFaint,
    marginBottom: 8,
  },
  infoBoxText: { flex: 1, fontSize: 13, color: Colors.primary, lineHeight: 18 },

  // Interdição temporária da tela de endereço
  addressLockedWrap: { position: 'relative' },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: Colors.background + 'E6',
  },
  lockIcon: { marginBottom: 10 },
  lockText: { fontSize: 14, fontWeight: '700', color: Colors.text, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  feedback: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  feedbackOk: { color: Colors.success },
  feedbackErr: { color: Colors.error },
  usernameStatus: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary, lineHeight: 16 },

  saveBtn: {
    marginTop: 20,
    // Compacto e alinhado à direita, em vez de ocupar a largura toda.
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Autenticação de dois fatores (A2F)
  twoFaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  twoFaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  twoFaBadgeOn: { backgroundColor: Colors.success + '1A' },
  twoFaBadgeOff: { backgroundColor: Colors.borderLight },
  twoFaBadgeText: { fontSize: 12, fontWeight: '700' },
  twoFaBadgeTextOn: { color: Colors.success },
  twoFaBadgeTextOff: { color: Colors.textTertiary },

  twoFaCard: {
    gap: 12,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  twoFaStep: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  qrBox: {
    alignSelf: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  manualKey: {
    gap: 6,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  manualKeyLabel: { fontSize: 12, color: Colors.textTertiary },
  secretRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  secretText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  codeInput: { fontSize: 20, fontWeight: '700', letterSpacing: 6 },
  twoFaBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  twoFaPrimaryBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  twoFaDangerBtn: {
    flex: 1,
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  twoFaOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaint,
  },
  twoFaOutlineText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  twoFaOutlineDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
    backgroundColor: 'transparent',
  },
  twoFaOutlineDangerText: { fontSize: 14, fontWeight: '700', color: Colors.error },

  // Dispositivos conectados
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  deviceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  devicePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.primaryFaint,
  },
  devicePillText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  deviceDisconnectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deviceDisconnectText: { fontSize: 13, fontWeight: '700', color: Colors.error },
});
