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
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { Palette } from '../constants/Colors';
import { DESKTOP_BREAKPOINT as WIDE } from '../constants/config';
import { api, ApiError, UserSession } from '../lib/api';
import { useAuth } from '../lib/auth';
import { LanguagePreference, SUPPORTED_LANGUAGES, useLanguage, useT } from '../lib/i18n';
import { registerPushToken, unregisterPushToken } from '../lib/push';
import { getItem, setItem } from '../lib/storage';
import { MapMode, useTheme, useThemedStyles, useThemeMode } from '../lib/theme';
import { formatExactDateTime } from '../lib/time';
import { getScreenMemory, setScreenMemory, useScreenMemory } from '../lib/screenMemory';
import LeftSidebar from '../components/LeftSidebar';
import MobileMenu from '../components/MobileMenu';
import { CONTENT_MAX_W } from '../components/WideLayout';

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


export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const { t } = useT();
  const TOPICS: Topic[] = [
    { key: 'edit-profile', label: t('settings.sections.editProfile.title'),           desc: t('settings.sections.editProfile.description'),            icon: 'person-outline' },
    { key: 'privacy',   label: t('settings.sections.privacy.title'), desc: t('settings.sections.privacy.description'), icon: 'lock-closed-outline' },
    { key: 'notifications',  label: t('settings.sections.notifications.title'),            desc: t('settings.sections.notifications.description'),           icon: 'notifications-outline' },
    { key: 'address',      label: t('settings.sections.addresses.title'),            desc: t('settings.sections.addresses.description'),           icon: 'location-outline' },
    { key: 'appearance',     label: t('settings.sections.appearance.title'),               desc: t('settings.sections.appearance.description'),                  icon: 'color-palette-outline' },
  ];
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const [selected, setSelected] = useScreenMemory<TopicKey>('settings.selected', 'edit-profile');
  // Em telas estreitas usamos master-detail: a lista abre o painel do tópico.
  const [detailOpen, setDetailOpen] = useScreenMemory('settings.detailOpen', false);
  const detailScrollRef = useRef<ScrollView>(null);
  const mobileScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const ref = isWide ? detailScrollRef : mobileScrollRef;
    const y = getScreenMemory(`settings.scrollY.${selected}`, 0);
    requestAnimationFrame(() => ref.current?.scrollTo({ y, animated: false }));
  }, [isWide, selected, detailOpen]);

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
        <Text style={styles.topicHeaderTitle}>{t('settings.title')}</Text>
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
            ref={detailScrollRef}
            style={styles.detailCol}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.detailContent}
            onScroll={(event) => setScreenMemory(`settings.scrollY.${selected}`, event.nativeEvent.contentOffset.y)}
            scrollEventThrottle={100}
            onContentSizeChange={() => detailScrollRef.current?.scrollTo({
              y: getScreenMemory(`settings.scrollY.${selected}`, 0),
              animated: false,
            })}
          >
            {detailInner}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.mobileBody}>
          <View style={styles.mobileHeader}>
            <TouchableOpacity
              style={styles.mobileHeaderButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <MobileMenu inline />
          </View>
          <ScrollView
            ref={mobileScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={detailOpen ? styles.detailContent : styles.topicListContent}
            onScroll={(event) => setScreenMemory(`settings.scrollY.${selected}`, event.nativeEvent.contentOffset.y)}
            scrollEventThrottle={100}
            onContentSizeChange={() => mobileScrollRef.current?.scrollTo({
              y: getScreenMemory(`settings.scrollY.${selected}`, 0),
              animated: false,
            })}
          >
            {detailOpen ? detailInner : topicList}
          </ScrollView>
        </View>
      )}
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
  const { t } = useT();
  const { user, refresh } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [username, setUsername] = useState(user?.username ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
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
        setFeedback({ ok: false, text: t('settings.profile.avatarPermission') });
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
      setFeedback({ ok: true, text: t('settings.profile.avatarUpdated') });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : t('settings.profile.avatarError') });
    } finally {
      setAvatarBusy(false);
    }
  };

  const pickCover = async () => {
    setFeedback(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setFeedback({ ok: false, text: t('settings.profile.coverPermission') });
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 1],
        quality: 0.7,
        base64: true,
      });
      const asset = res.assets?.[0];
      if (res.canceled || !asset?.base64) return;
      setCoverBusy(true);
      await api.updateCover(`data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
      await refresh();
      setFeedback({ ok: true, text: t('settings.profile.coverUpdated') });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : t('settings.profile.coverError') });
    } finally {
      setCoverBusy(false);
    }
  };

  const save = async () => {
    setFeedback(null);
    const uname = username.trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) {
      setFeedback({ ok: false, text: t('settings.profile.usernameInvalidLong') });
      return;
    }
    if (uStatus === 'taken') {
      setFeedback({ ok: false, text: t('settings.profile.usernameTaken') });
      return;
    }
    if (!name.trim()) {
      setFeedback({ ok: false, text: t('settings.profile.nameRequired') });
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({
        username: uname,
        name: name.trim(),
        bio: bio.trim(),
      });
      await refresh();
      setUsername(uname);
      setFeedback({ ok: true, text: t('settings.profile.updated') });
    } catch (e) {
      const text = e instanceof ApiError ? e.message : t('settings.profile.saveError');
      setFeedback({ ok: false, text });
    } finally {
      setSaving(false);
    }
  };

  const USERNAME_STATUS: Record<Exclude<UsernameStatus, 'idle'>, { text: string; tone: 'ok' | 'err' | 'muted' }> = {
    checking:  { text: t('settings.profile.usernameChecking'), tone: 'muted' },
    invalid:   { text: t('settings.profile.usernameInvalid'), tone: 'err' },
    taken:     { text: t('settings.profile.usernameTaken'), tone: 'err' },
    available: { text: t('settings.profile.usernameAvailable'), tone: 'ok' },
  };
  const status = uStatus === 'idle' ? null : USERNAME_STATUS[uStatus];

  return (
    <View style={styles.panelGroup}>
      <View style={styles.coverEditWrap}>
        {user?.cover ? (
          <Image source={{ uri: user.cover }} style={styles.coverEditImage} />
        ) : (
          <View style={styles.coverEditPlaceholder} />
        )}
        <View style={styles.coverEditBtnWrap}>
          <TouchableOpacity style={styles.coverEditBtn} activeOpacity={0.8} onPress={pickCover} disabled={coverBusy}>
            {coverBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={14} color="#fff" />
                <Text style={styles.coverEditBtnText}>{t('settings.profile.changeCover')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.coverEditAvatarWrap}>
          <Image source={{ uri: user?.avatar }} style={styles.coverEditAvatar} />
          <View style={styles.avatarEditBtnWrap}>
            <TouchableOpacity style={styles.avatarEditBtn} activeOpacity={0.8} onPress={pickAvatar} disabled={avatarBusy}>
              {avatarBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera-outline" size={14} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles.coverEditSpacer} />

      <Field
        label={t('settings.profile.username')}
        value={username}
        onChangeText={setUsername}
        placeholder={t('settings.profile.usernamePlaceholder')}
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
        <Text style={styles.fieldHint}>{t('settings.profile.usernameHint')}</Text>
      )}

      <Field
        label={t('settings.profile.displayName')}
        value={name}
        onChangeText={setName}
        placeholder={t('settings.profile.displayNamePlaceholder')}
        hint={t('settings.profile.displayNameHint')}
      />
      <Field label={t('settings.profile.bio')} value={bio} onChangeText={setBio} placeholder={t('settings.profile.bioPlaceholder')} multiline />

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
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('settings.profile.save')}</Text>}
      </TouchableOpacity>

    </View>
  );
}

function PrivacyPanel() {
  const { t } = useT();
  const styles = useThemedStyles(makeStyles);
  const { user, refresh } = useAuth();
  const [showLocation, setShowLocation] = useState(user?.showLocation ?? true);
  const [searchable, setSearchable] = useState(user?.searchable ?? true);
  const [hideResidentBadge, setHideResidentBadge] = useState(user?.hideResidentBadge ?? false);

  const savePref = (
    payload: Parameters<typeof api.updateProfile>[0],
    revert: () => void,
  ) => {
    api.updateProfile(payload).then(() => refresh()).catch(() => revert());
  };

  return (
    <View style={styles.panelGroup}>
      <SectionTitle>{t('settings.privacy.visibility')}</SectionTitle>
      <ToggleRow
        label={t('settings.privacy.showLocation')}
        desc={t('settings.privacy.showLocationDesc')}
        value={showLocation}
        onValueChange={(v) => {
          setShowLocation(v);
          savePref({ show_location: v }, () => setShowLocation(!v));
        }}
      />
      <ToggleRow
        label={t('settings.privacy.searchable')}
        desc={t('settings.privacy.searchableDesc')}
        value={searchable}
        onValueChange={(v) => {
          setSearchable(v);
          savePref({ searchable: v }, () => setSearchable(!v));
        }}
      />
      <ToggleRow
        label={t('settings.privacy.hideBadge')}
        desc={t('settings.privacy.hideBadgeDesc')}
        value={hideResidentBadge}
        onValueChange={(v) => {
          setHideResidentBadge(v);
          savePref({ hide_resident_badge: v }, () => setHideResidentBadge(!v));
        }}
      />

      <SectionTitle>{t('settings.privacy.security')}</SectionTitle>
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
  const { t } = useT();
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
      setFeedback({ ok: false, text: t('settings.password.tooShort') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ ok: false, text: t('settings.password.mismatch') });
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      reset();
      setFeedback({ ok: true, text: t('settings.password.updated') });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : t('settings.password.error') });
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
        <Text style={[styles.settingLabel, styles.linkLabel]}>{t('settings.password.change')}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={18} color={Colors.textTertiary} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.twoFaCard}>
          <Field
            label={t('settings.password.current')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder={t('settings.password.currentPlaceholder')}
            secureToggle
          />
          <Field
            label={t('settings.password.new')}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('settings.password.newPlaceholder')}
            secureToggle
          />
          <Field
            label={t('settings.password.confirm')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('settings.password.confirmPlaceholder')}
            secureToggle
          />
          {feedback && (
            <Text style={[styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr]}>{feedback.text}</Text>
          )}
          <View style={styles.twoFaBtnRow}>
            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={reset} disabled={busy}>
              <Text style={styles.secondaryBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.twoFaPrimaryBtn, (busy || !currentPassword || !newPassword || !confirmPassword) && styles.saveBtnDisabled]}
              activeOpacity={0.85}
              onPress={submit}
              disabled={busy || !currentPassword || !newPassword || !confirmPassword}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('settings.password.save')}</Text>}
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
  const { t } = useT();
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
      setError(e instanceof ApiError ? e.message : t('settings.devices.loadError'));
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
      setError(e instanceof ApiError ? e.message : t('settings.devices.disconnectError'));
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
        <Text style={[styles.settingLabel, styles.linkLabel]}>{t('settings.devices.title')}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={18} color={Colors.textTertiary} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.twoFaCard}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : error ? (
            <Text style={styles.feedbackErr}>{error}</Text>
          ) : !sessions?.length ? (
            <Text style={styles.fieldHint}>{t('settings.devices.empty')}</Text>
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
                        <Text style={styles.devicePillText}>{t('settings.devices.current')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.settingDesc}>{t('settings.devices.startedAt', { date: formatExactDateTime(session.createdAt) })}</Text>
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
                      <Text style={styles.deviceDisconnectText}>{t('settings.devices.disconnect')}</Text>
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
  const { t } = useT();
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
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : t('settings.twoFactor.setupError') });
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    if (code.length < 6) {
      setFeedback({ ok: false, text: t('settings.twoFactor.codeRequired') });
      return;
    }
    setFeedback(null);
    setBusy(true);
    try {
      await api.enable2fa(code);
      await refresh();
      reset();
      setFeedback({ ok: true, text: t('settings.twoFactor.enabledSuccess') });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : t('settings.twoFactor.invalidCode') });
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    if (code.length < 6) {
      setFeedback({ ok: false, text: t('settings.twoFactor.codeRequired') });
      return;
    }
    setFeedback(null);
    setBusy(true);
    try {
      await api.disable2fa(code);
      await refresh();
      reset();
      setFeedback({ ok: true, text: t('settings.twoFactor.disabledSuccess') });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : t('settings.twoFactor.invalidCode') });
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
      <Text style={styles.fieldLabel}>{t('settings.twoFactor.verificationCode')}</Text>
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
          <Text style={styles.settingLabel}>{t('settings.twoFactor.title')}</Text>
          <Text style={styles.settingDesc}>{t('settings.twoFactor.description')}</Text>
        </View>
        <View style={[styles.twoFaBadge, enabled ? styles.twoFaBadgeOn : styles.twoFaBadgeOff]}>
          <Text style={[styles.twoFaBadgeText, enabled ? styles.twoFaBadgeTextOn : styles.twoFaBadgeTextOff]}>
            {enabled ? t('settings.twoFactor.enabled') : t('settings.twoFactor.disabled')}
          </Text>
        </View>
      </View>

      {/* Passo a passo de ativação */}
      {mode === 'setup' && setup && (
        <View style={styles.twoFaCard}>
          <Text style={styles.twoFaStep}>{t('settings.twoFactor.scanStep')}</Text>
          <View style={styles.qrBox}>
            <QRCode value={setup.otpauthUrl} size={180} backgroundColor="#fff" color="#000" />
          </View>

          <View style={styles.manualKey}>
            <Text style={styles.manualKeyLabel}>{t('settings.twoFactor.manualKey')}</Text>
            <View style={styles.secretRow}>
              <Text selectable style={styles.secretText}>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</Text>
              {canCopy && (
                <TouchableOpacity style={styles.copyBtn} onPress={copySecret} activeOpacity={0.7}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={Colors.primary} />
                  <Text style={styles.copyBtnText}>{copied ? t('settings.twoFactor.copied') : t('settings.twoFactor.copy')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.twoFaStep}>{t('settings.twoFactor.confirmStep')}</Text>
          {codeField(confirmEnable)}
          {feedback && (
            <Text style={[styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr]}>{feedback.text}</Text>
          )}
          <View style={styles.twoFaBtnRow}>
            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={reset} disabled={busy}>
              <Text style={styles.secondaryBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.twoFaPrimaryBtn, busy && styles.saveBtnDisabled]} activeOpacity={0.85} onPress={confirmEnable} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('settings.twoFactor.confirmEnable')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Confirmação de desativação */}
      {mode === 'disable' && (
        <View style={styles.twoFaCard}>
          <Text style={styles.twoFaStep}>{t('settings.twoFactor.disablePrompt')}</Text>
          {codeField(confirmDisable)}
          {feedback && (
            <Text style={[styles.feedback, feedback.ok ? styles.feedbackOk : styles.feedbackErr]}>{feedback.text}</Text>
          )}
          <View style={styles.twoFaBtnRow}>
            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={reset} disabled={busy}>
              <Text style={styles.secondaryBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.twoFaDangerBtn, busy && styles.saveBtnDisabled]} activeOpacity={0.85} onPress={confirmDisable} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('settings.twoFactor.disable')}</Text>}
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
              <Text style={styles.twoFaOutlineDangerText}>{t('settings.twoFactor.disableAction')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.twoFaOutline} activeOpacity={0.8} onPress={startSetup} disabled={busy}>
              {busy ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
                  <Text style={styles.twoFaOutlineText}>{t('settings.twoFactor.enableAction')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const PUSH_ENABLED_KEY = 'daqui.pushEnabled';

function NotificationsPanel() {
  const { t } = useT();
  const styles = useThemedStyles(makeStyles);
  const { user, refresh } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [notifyLikes, setNotifyLikes] = useState(user?.notifyLikes ?? true);
  const [notifyComments, setNotifyComments] = useState(user?.notifyComments ?? true);
  const [notifyMessages, setNotifyMessages] = useState(user?.notifyMessages ?? true);
  const [notifyNeighborhoodAlerts, setNotifyNeighborhoodAlerts] = useState(
    user?.notifyNeighborhoodAlerts ?? true,
  );

  useEffect(() => {
    getItem(PUSH_ENABLED_KEY).then((v) => {
      if (v === 'false') setPushEnabled(false);
    });
  }, []);

  const handlePushToggle = (value: boolean) => {
    setPushEnabled(value);
    setItem(PUSH_ENABLED_KEY, String(value)).catch(() => {});
    if (value) registerPushToken();
    else unregisterPushToken();
  };

  const savePref = (
    payload: Parameters<typeof api.updateProfile>[0],
    revert: () => void,
  ) => {
    api.updateProfile(payload).then(() => refresh()).catch(() => revert());
  };

  return (
    <View style={styles.panelGroup}>
      <SectionTitle>{t('settings.notifications.push')}</SectionTitle>
      <ToggleRow
        label={t('settings.notifications.pushLabel')}
        desc={t('settings.notifications.pushDesc')}
        value={pushEnabled}
        onValueChange={handlePushToggle}
      />

      <SectionTitle>{t('settings.notifications.inApp')}</SectionTitle>
      <ToggleRow
        label={t('settings.notifications.likes')}
        desc={t('settings.notifications.likesDesc')}
        value={notifyLikes}
        onValueChange={(v) => {
          setNotifyLikes(v);
          savePref({ notify_likes: v }, () => setNotifyLikes(!v));
        }}
      />
      <ToggleRow
        label={t('settings.notifications.comments')}
        desc={t('settings.notifications.commentsDesc')}
        value={notifyComments}
        onValueChange={(v) => {
          setNotifyComments(v);
          savePref({ notify_comments: v }, () => setNotifyComments(!v));
        }}
      />
      <ToggleRow
        label={t('settings.notifications.messages')}
        desc={t('settings.notifications.messagesDesc')}
        value={notifyMessages}
        onValueChange={(v) => {
          setNotifyMessages(v);
          savePref({ notify_messages: v }, () => setNotifyMessages(!v));
        }}
      />
      <ToggleRow
        label={t('settings.notifications.neighborhood')}
        desc={t('settings.notifications.neighborhoodDesc')}
        value={notifyNeighborhoodAlerts}
        onValueChange={(v) => {
          setNotifyNeighborhoodAlerts(v);
          savePref({ notify_neighborhood_alerts: v }, () => setNotifyNeighborhoodAlerts(!v));
        }}
      />
    </View>
  );
}

function AddressPanel() {
  const { t } = useT();
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const { user } = useAuth();
  const [changeNeighborhoodOpen, setChangeNeighborhoodOpen] = useState(false);
  const neighborhood = user?.neighborhood?.trim();

  return (
    <View style={styles.panelGroup}>
      <View style={styles.addressIntro}>
        <Text style={styles.addressEyebrow}>{t('settings.address.eyebrow')}</Text>
        <Text style={styles.addressIntroText}>
          {t('settings.address.intro')}
        </Text>
      </View>

      <View style={styles.neighborhoodHero}>
        <View style={styles.neighborhoodPin}>
          <Ionicons name="location" size={30} color="#fff" />
        </View>
        <Text style={styles.neighborhoodHeroLabel}>{t('settings.address.current')}</Text>
        <Text style={styles.neighborhoodHeroName} numberOfLines={2}>
          {neighborhood || t('settings.address.notConfigured')}
        </Text>
        <View style={styles.neighborhoodPrivacy}>
          <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
          <Text style={styles.neighborhoodPrivacyText}>
            {t('settings.address.privacy')}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.changeNeighborhoodAction}
        activeOpacity={0.82}
        onPress={() => setChangeNeighborhoodOpen(true)}
      >
        <Ionicons name={neighborhood ? 'swap-horizontal-outline' : 'add-circle-outline'} size={20} color="#fff" />
        <Text style={styles.changeNeighborhoodActionText}>
          {neighborhood ? t('settings.address.change') : t('settings.address.configure')}
        </Text>
      </TouchableOpacity>

      <ChangeNeighborhoodModal
        visible={changeNeighborhoodOpen}
        onClose={() => setChangeNeighborhoodOpen(false)}
      />
    </View>
  );
}

function AppearancePanel() {
  const { t } = useT();
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const { mode, toggle, mapMode, setMapMode } = useThemeMode();
  const mapOptions: { key: MapMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'system', label: t('settings.appearance.mapFollowApp'), icon: 'contrast-outline' },
    { key: 'light', label: t('settings.appearance.mapLight'), icon: 'sunny-outline' },
    { key: 'dark', label: t('settings.appearance.mapDark'), icon: 'moon-outline' },
  ];
  return (
    <View style={styles.panelGroup}>
      <SectionTitle>{t('settings.appearance.theme')}</SectionTitle>
      <ToggleRow
        label={t('settings.appearance.darkMode')}
        desc={t('settings.appearance.darkModeDesc')}
        value={mode === 'dark'}
        onValueChange={toggle}
      />
      <View style={{ height: 20 }} />
      <SectionTitle>{t('settings.appearance.mapTheme')}</SectionTitle>
      <Text style={[styles.settingDesc, { marginBottom: 10 }]}>{t('settings.appearance.mapThemeDesc')}</Text>
      <View style={{ gap: 8 }}>
        {mapOptions.map((option) => {
          const active = mapMode === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.settingRow, styles.languageOption, active && { backgroundColor: Colors.primaryFaint }]}
              activeOpacity={0.7}
              onPress={() => setMapMode(option.key)}
            >
              <Ionicons name={option.icon} size={20} color={active ? Colors.primary : Colors.textSecondary} />
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, active && { color: Colors.primary, fontWeight: '700' }]}>{option.label}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ height: 20 }} />
      <LanguagePanel />
    </View>
  );
}

/**
 * Idioma da interface: 'Automático' (padrão) segue o idioma do dispositivo
 * (ver I18nProvider em lib/i18n.tsx); os outros dois fixam manualmente,
 * seguindo a recomendação de plataforma (iOS/Android) de sempre deixar o
 * usuário sobrepor o idioma detectado — útil em dispositivo compartilhado ou
 * quando a pessoa só prefere usar o app num idioma diferente do sistema.
 */
function LanguagePanel() {
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const { t } = useT();
  const { preference, setPreference } = useLanguage();

  const options: { key: LanguagePreference; label: string }[] = [
    { key: 'auto', label: t('settings.language.auto') },
    ...SUPPORTED_LANGUAGES.map((code) => ({ key: code, label: t(`settings.language.${code}`) })),
  ];

  return (
    <>
      <SectionTitle>{t('settings.language.sectionTitle')}</SectionTitle>
      <Text style={[styles.settingDesc, { marginBottom: 10 }]}>{t('settings.language.desc')}</Text>
      <View style={{ gap: 8 }}>
        {options.map((opt) => {
          const active = preference === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.settingRow,
                styles.languageOption,
                active && { backgroundColor: Colors.primaryFaint },
              ]}
              activeOpacity={0.7}
              onPress={() => setPreference(opt.key)}
            >
              <View style={styles.settingText}>
                <Text style={[styles.settingLabel, active && { color: Colors.primary, fontWeight: '700' }]}>{opt.label}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
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

/**
 * Confirmação de "Alterar bairro de moradia": avisa que atestar morar num
 * bairro que não é o seu pode suspender a conta (ver Termos de Uso, seção 4)
 * antes de zerar o bairro cadastrado e mandar o usuário de volta pro fluxo
 * de configuração de bairro (feed > "Meu bairro", que detecta de novo por GPS).
 */
function ChangeNeighborhoodModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useT();
  const styles = useThemedStyles(makeStyles);
  const Colors = useTheme();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.updateProfile({ neighborhood: '' });
      await refresh();
      onClose();
      router.replace({ pathname: '/(tabs)', params: { view: 'meu' } } as any);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('settings.changeNeighborhood.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.confirmOverlay} onPress={busy ? undefined : onClose} tabIndex={-1}>
        <Pressable style={styles.confirmCard} onPress={() => {}} tabIndex={-1}>
          <View style={styles.confirmIconWrap}>
            <Ionicons name="alert-circle-outline" size={24} color={Colors.error} />
          </View>
          <Text style={styles.confirmTitle}>{t('settings.changeNeighborhood.title')}</Text>
          <Text style={styles.confirmText}>
            {t('settings.changeNeighborhood.description')}
          </Text>
          <View style={styles.confirmWarningBox}>
            <Ionicons name="warning-outline" size={16} color={Colors.error} />
            <Text style={styles.confirmWarningText}>
              {t('settings.changeNeighborhood.warning')}
            </Text>
          </View>
          {error && (
            <Text style={[styles.feedback, styles.feedbackErr]}>{error}</Text>
          )}
          <View style={styles.confirmBtnRow}>
            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={onClose} disabled={busy}>
              <Text style={styles.secondaryBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.twoFaPrimaryBtn, busy && styles.saveBtnDisabled]}
              activeOpacity={0.85}
              onPress={confirm}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('settings.changeNeighborhood.continue')}</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
  mobileHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  mobileHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  coverEditWrap: {
    height: 120,
    borderRadius: 16,
    overflow: 'visible',
  },
  coverEditImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  coverEditPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: Colors.primaryFaint,
  },
  coverEditBtnWrap: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  coverEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  coverEditBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  coverEditAvatarWrap: {
    position: 'absolute',
    left: 16,
    bottom: -28,
  },
  coverEditAvatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: Colors.surface,
  },
  avatarEditBtnWrap: {
    position: 'absolute',
    right: -4,
    bottom: -4,
  },
  avatarEditBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  coverEditSpacer: { height: 40 },

  // Modal de confirmação de "Alterar bairro de moradia"
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 22,
    ...Colors.shadow.lg,
  },
  confirmIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error + '15',
    marginBottom: 14,
  },
  confirmTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  confirmText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 8 },
  confirmWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.error + '12',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 18,
  },
  confirmWarningText: { flex: 1, fontSize: 13, color: Colors.error, lineHeight: 18, fontWeight: '500' },
  confirmBtnRow: { flexDirection: 'row', gap: 10 },
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
    borderRadius: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  settingText: { flex: 1, minWidth: 0 },
  settingLabel: { fontSize: 15, fontWeight: '500', color: Colors.text },
  settingDesc: { fontSize: 13, color: Colors.textTertiary, marginTop: 2 },
  languageOption: {
    paddingHorizontal: 12,
    borderRadius: 12,
  },
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

  addressIntro: { alignItems: 'center', marginTop: 8, marginBottom: 12, paddingHorizontal: 16 },
  addressEyebrow: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 1.2 },
  addressIntroText: { marginTop: 6, maxWidth: 380, fontSize: 14, lineHeight: 20, color: Colors.textSecondary, textAlign: 'center' },
  neighborhoodHero: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 30,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.primary + '32',
    backgroundColor: Colors.primaryFaint,
  },
  neighborhoodPin: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginBottom: 18,
    ...Colors.shadow.md,
  },
  neighborhoodHeroLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  neighborhoodHeroName: { marginTop: 5, fontSize: 30, lineHeight: 36, fontWeight: '800', color: Colors.text, textAlign: 'center', letterSpacing: -0.7 },
  neighborhoodPrivacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 20, maxWidth: 340 },
  neighborhoodPrivacyText: { flex: 1, fontSize: 12, lineHeight: 17, color: Colors.textSecondary, textAlign: 'left' },
  changeNeighborhoodAction: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 13,
    backgroundColor: Colors.primary,
  },
  changeNeighborhoodActionText: { fontSize: 14, fontWeight: '700', color: '#fff' },

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
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 },
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
