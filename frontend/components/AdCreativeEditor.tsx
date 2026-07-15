import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { adsApi, AdFormat, CreativeInput } from '../lib/adsApi';
import { api } from '../lib/api';
import { User } from '../data/mock';
import VideoPlayer from './VideoPlayer';

// Editor de criativos por-formato: um bloco fixo por formato (post/mensagens/
// novidades — sem teste A/B por peso, ver plano de "mídia por formato").
// Usado tanto na criação (checkout.tsx) quanto na edição pelo próprio
// anunciante (painel/editar/[token].tsx) — construído uma vez, reaproveitado
// nos dois fluxos.

export interface CreativeBlockDraft {
  title: string;
  content: string;
  targetUrl: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | '';
  ctaLabel: string;
  latitude: string;
  longitude: string;
  linkedUserId?: number;
}

export interface CreativeBlocks {
  // format=null no backend — cobre "post" + "search_poster" + fallback de
  // qualquer formato sem bloco próprio.
  default: CreativeBlockDraft;
  conversation?: CreativeBlockDraft;
  notification?: CreativeBlockDraft;
}

export function emptyCreativeBlock(): CreativeBlockDraft {
  return {
    title: '', content: '', targetUrl: '', mediaUrl: '', mediaType: '', ctaLabel: '',
    latitude: '', longitude: '', linkedUserId: undefined,
  };
}

export function emptyCreativeBlocks(): CreativeBlocks {
  return { default: emptyCreativeBlock() };
}

export function blocksToCreatives(blocks: CreativeBlocks): CreativeInput[] {
  const toInput = (format: AdFormat | undefined, d: CreativeBlockDraft): CreativeInput => ({
    format,
    title: d.title.trim(),
    content: d.content.trim(),
    imageUrl: d.mediaType === 'image' ? d.mediaUrl : undefined,
    videoUrl: d.mediaType === 'video' ? d.mediaUrl : undefined,
    ctaLabel: d.ctaLabel.trim() || undefined,
    targetUrl: d.targetUrl.trim(),
    latitude: d.latitude.trim() ? Number(d.latitude) : undefined,
    longitude: d.longitude.trim() ? Number(d.longitude) : undefined,
    linkedUserId: d.linkedUserId,
  });
  const out = [toInput(undefined, blocks.default)];
  if (blocks.conversation) out.push(toInput('conversation', blocks.conversation));
  if (blocks.notification) out.push(toInput('notification', blocks.notification));
  return out;
}

interface CreativeLike {
  format?: AdFormat;
  title: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  ctaLabel?: string;
  targetUrl: string;
  latitude?: number;
  longitude?: number;
  linkedUserId?: number;
}

export function creativesToBlocks(creatives: CreativeLike[]): CreativeBlocks {
  const draftFrom = (c: CreativeLike): CreativeBlockDraft => ({
    title: c.title,
    content: c.content,
    targetUrl: c.targetUrl,
    mediaUrl: c.videoUrl || c.imageUrl || '',
    mediaType: c.videoUrl ? 'video' : c.imageUrl ? 'image' : '',
    ctaLabel: c.ctaLabel || '',
    latitude: c.latitude != null ? String(c.latitude) : '',
    longitude: c.longitude != null ? String(c.longitude) : '',
    linkedUserId: c.linkedUserId,
  });
  const def = creatives.find((c) => !c.format);
  const conv = creatives.find((c) => c.format === 'conversation');
  const notif = creatives.find((c) => c.format === 'notification');
  return {
    default: def ? draftFrom(def) : emptyCreativeBlock(),
    conversation: conv ? draftFrom(conv) : undefined,
    notification: notif ? draftFrom(notif) : undefined,
  };
}

interface AdCreativeEditorProps {
  formats: AdFormat[];
  value: CreativeBlocks;
  onChange: (next: CreativeBlocks) => void;
}

export default function AdCreativeEditor({ formats, value, onChange }: AdCreativeEditorProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const updateFormatBlock = (fmt: 'conversation' | 'notification', next: CreativeBlockDraft | undefined) =>
    onChange({ ...value, [fmt]: next });

  return (
    <View style={styles.wrap}>
      <CreativeBlockFields
        label="O anúncio"
        draft={value.default}
        onChange={(next) => onChange({ ...value, default: next })}
        allowVideo
        showLocation={formats.includes('post')}
        showAccountLink
        Colors={Colors}
        styles={styles}
      />

      {formats.includes('conversation') && (
        <View>
          <TouchableOpacity
            style={styles.toggleRow}
            activeOpacity={0.7}
            onPress={() => updateFormatBlock('conversation', value.conversation ? undefined : emptyCreativeBlock())}
          >
            <Ionicons
              name={value.conversation ? 'checkbox' : 'square-outline'}
              size={18}
              color={value.conversation ? Colors.primary : Colors.textTertiary}
            />
            <Text style={styles.toggleText}>Usar mídia diferente para Mensagens</Text>
          </TouchableOpacity>
          {value.conversation && (
            <CreativeBlockFields
              label="Ícone em Mensagens"
              draft={value.conversation}
              onChange={(next) => updateFormatBlock('conversation', next)}
              allowVideo={false}
              showLocation={false}
              showAccountLink={false}
              Colors={Colors}
              styles={styles}
            />
          )}
        </View>
      )}

      {formats.includes('notification') && (
        <View>
          <TouchableOpacity
            style={styles.toggleRow}
            activeOpacity={0.7}
            onPress={() => updateFormatBlock('notification', value.notification ? undefined : emptyCreativeBlock())}
          >
            <Ionicons
              name={value.notification ? 'checkbox' : 'square-outline'}
              size={18}
              color={value.notification ? Colors.primary : Colors.textTertiary}
            />
            <Text style={styles.toggleText}>Usar mídia diferente para Novidades</Text>
          </TouchableOpacity>
          {value.notification && (
            <CreativeBlockFields
              label="Ícone em Novidades"
              draft={value.notification}
              onChange={(next) => updateFormatBlock('notification', next)}
              allowVideo={false}
              showLocation={false}
              showAccountLink={false}
              Colors={Colors}
              styles={styles}
            />
          )}
        </View>
      )}
    </View>
  );
}

function CreativeBlockFields({
  label,
  draft,
  onChange,
  allowVideo,
  showLocation,
  showAccountLink,
  Colors,
  styles,
}: {
  label: string;
  draft: CreativeBlockDraft;
  onChange: (next: CreativeBlockDraft) => void;
  allowVideo: boolean;
  showLocation: boolean;
  showAccountLink: boolean;
  Colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [linkedUser, setLinkedUser] = useState<User | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [linkResults, setLinkResults] = useState<User[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!draft.linkedUserId) {
      setLinkedUser(null);
      return;
    }
    if (linkedUser && Number(linkedUser.id) === draft.linkedUserId) return;
    api.getUser(String(draft.linkedUserId)).then(setLinkedUser).catch(() => setLinkedUser(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.linkedUserId]);

  const pickMedia = async () => {
    setMediaError('');
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setMediaError('Permita o acesso às fotos para adicionar mídia.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: allowVideo ? ['images', 'videos'] : ['images'],
        quality: 0.7,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      setMediaUploading(true);
      const uploaded = await adsApi.uploadAdMedia({
        uri: asset.uri,
        mimeType: asset.mimeType ?? undefined,
        fileName: asset.fileName ?? undefined,
      });
      onChange({ ...draft, mediaUrl: uploaded.url, mediaType: uploaded.type });
    } catch {
      setMediaError('Não foi possível enviar o arquivo.');
    } finally {
      setMediaUploading(false);
    }
  };
  const removeMedia = () => onChange({ ...draft, mediaUrl: '', mediaType: '' });

  const runLinkSearch = (q: string) => {
    const term = q.trim();
    if (!term) {
      setLinkResults([]);
      setLinkLoading(false);
      return;
    }
    const id = ++seq.current;
    setLinkLoading(true);
    api
      .search(term, 'users')
      .then((r) => { if (id === seq.current) setLinkResults(r.users); })
      .catch(() => { if (id === seq.current) setLinkResults([]); })
      .finally(() => { if (id === seq.current) setLinkLoading(false); });
  };
  const onChangeLinkQuery = (v: string) => {
    setLinkQuery(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runLinkSearch(v), 300);
  };

  return (
    <View style={styles.creativeBlock}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <TextInput style={styles.input} placeholder="Título" placeholderTextColor={Colors.textTertiary} value={draft.title} onChangeText={(v) => onChange({ ...draft, title: v })} />
      <TextInput style={[styles.input, styles.inputMultiline]} placeholder="Texto" placeholderTextColor={Colors.textTertiary} value={draft.content} onChangeText={(v) => onChange({ ...draft, content: v })} multiline />
      <TextInput style={styles.input} placeholder="Link de destino (ao tocar no anúncio)" placeholderTextColor={Colors.textTertiary} value={draft.targetUrl} onChangeText={(v) => onChange({ ...draft, targetUrl: v })} autoCapitalize="none" />

      {draft.mediaUrl ? (
        <View style={styles.mediaPreviewWrap}>
          {draft.mediaType === 'video' ? (
            <VideoPlayer uri={draft.mediaUrl} style={styles.mediaPreview} hideMuteToggle />
          ) : (
            <Image source={{ uri: draft.mediaUrl }} style={styles.mediaPreview} resizeMode="cover" />
          )}
          <View style={styles.removeMediaBtnWrap}>
            <TouchableOpacity style={styles.removeMediaBtn} onPress={removeMedia}>
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.mediaPickerBtn} onPress={pickMedia} activeOpacity={0.8} disabled={mediaUploading}>
          {mediaUploading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <Ionicons name="image-outline" size={18} color={Colors.primary} />
              <Text style={styles.mediaPickerText}>{allowVideo ? 'Adicionar foto ou vídeo' : 'Adicionar ícone (foto)'}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
      {!!mediaError && <Text style={styles.errorText}>{mediaError}</Text>}

      <TextInput style={styles.input} placeholder="Texto do botão (opcional)" placeholderTextColor={Colors.textTertiary} value={draft.ctaLabel} onChangeText={(v) => onChange({ ...draft, ctaLabel: v })} />

      {showLocation && (
        <View style={styles.row2}>
          <TextInput style={[styles.input, styles.inputHalf]} placeholder="Latitude (pin no mapa)" placeholderTextColor={Colors.textTertiary} value={draft.latitude} onChangeText={(v) => onChange({ ...draft, latitude: v })} keyboardType="numeric" />
          <TextInput style={[styles.input, styles.inputHalf]} placeholder="Longitude" placeholderTextColor={Colors.textTertiary} value={draft.longitude} onChangeText={(v) => onChange({ ...draft, longitude: v })} keyboardType="numeric" />
        </View>
      )}

      {showAccountLink && (
        linkedUser ? (
          <View style={styles.linkedChip}>
            <Image source={{ uri: linkedUser.avatar }} style={styles.linkedAvatar} />
            <Text style={styles.linkedName} numberOfLines={1}>{linkedUser.name} · @{linkedUser.username}</Text>
            <TouchableOpacity
              onPress={() => { onChange({ ...draft, linkedUserId: undefined }); setLinkedUser(null); }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <TouchableOpacity style={styles.toggleRow} activeOpacity={0.7} onPress={() => setLinkOpen((v) => !v)}>
              <Ionicons name={linkOpen ? 'checkbox' : 'square-outline'} size={18} color={linkOpen ? Colors.primary : Colors.textTertiary} />
              <Text style={styles.toggleText}>Vincular a uma conta do Daqui (opcional)</Text>
            </TouchableOpacity>
            {linkOpen && (
              <View style={styles.linkSearchBox}>
                <TextInput
                  style={styles.input}
                  placeholder="Buscar por nome ou @usuário"
                  placeholderTextColor={Colors.textTertiary}
                  value={linkQuery}
                  onChangeText={onChangeLinkQuery}
                  autoCapitalize="none"
                />
                {linkLoading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 8 }} />}
                {!linkLoading && linkResults.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.linkResultRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      onChange({ ...draft, linkedUserId: Number(u.id) });
                      setLinkedUser(u);
                      setLinkOpen(false);
                      setLinkQuery('');
                      setLinkResults([]);
                    }}
                  >
                    <Image source={{ uri: u.avatar }} style={styles.linkedAvatar} />
                    <Text style={styles.linkedName} numberOfLines={1}>{u.name} · @{u.username}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )
      )}
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  wrap: { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.text, marginTop: 10 },
  creativeBlock: { gap: 10, borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 14, padding: 12 },

  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surface,
    outlineStyle: 'none',
  } as any,
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 10 },
  inputHalf: { flex: 1 },

  mediaPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaint,
  },
  mediaPickerText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  mediaPreviewWrap: { position: 'relative' },
  mediaPreview: { width: '100%', height: 160, borderRadius: 12, backgroundColor: Colors.borderLight },
  removeMediaBtnWrap: { position: 'absolute', top: -6, right: -6 },
  removeMediaBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorText: { fontSize: 12, fontWeight: '600', color: Colors.error },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  toggleText: { fontSize: 13, fontWeight: '700', color: Colors.text },

  linkedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 8,
  },
  linkedAvatar: { width: 32, height: 32, borderRadius: 10 },
  linkedName: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.text },

  linkSearchBox: { gap: 6, marginTop: 4 },
  linkResultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
});
