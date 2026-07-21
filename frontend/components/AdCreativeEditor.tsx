import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { adsApi, AdFormat, CreativeInput } from '../lib/adsApi';
import { api, GeocodeResult } from '../lib/api';
import { useAuth } from '../lib/auth';
import { User } from '../data/mock';
import VideoPlayer from './VideoPlayer';
import LocationAutocompleteInput from './LocationAutocompleteInput';
import LocationPickerModal from './LocationPickerModal';

// Editor de criativos por-formato. Um bloco base ("O anúncio") — reutilizado
// em todos os lugares — mais um bloco opcional por superfície (Feed/mapa,
// Busca, Mensagens, Novidades): o anunciante configura o conteúdo uma vez e,
// se quiser, sobrepõe ícone/texto diferente em qualquer uma delas, sem
// preencher tudo 4 vezes. Usado tanto na criação (checkout.tsx) quanto na
// edição pelo próprio anunciante (painel/editar/[token].tsx).

// Superfícies que podem receber um criativo próprio, na ordem em que
// aparecem no editor. `post` cobre feed + pin no mapa; `search_poster` é a
// Busca. Cada uma vira um `format` específico no backend (o base é
// `format=null` e serve de fallback pra qualquer uma sem bloco próprio).
export const OVERRIDE_FORMATS: { key: AdFormat; label: string; allowVideo: boolean }[] = [
  { key: 'post', label: 'Feed e mapa', allowVideo: true },
  { key: 'search_poster', label: 'Busca', allowVideo: true },
  { key: 'conversation', label: 'Mensagens', allowVideo: false },
  { key: 'notification', label: 'Novidades', allowVideo: false },
];

export interface CreativeBlockDraft {
  title: string;
  content: string;
  targetUrl: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | '';
  ctaLabel: string;
  latitude: string;
  longitude: string;
  // Endereço legível do pin no mapa (só UI — não vai pro backend, que guarda
  // lat/lng). `locationStatus` reproduz a semântica do picker do "Novo post":
  // `valid` só ao escolher uma sugestão ou marcar no mapa.
  locationLabel: string;
  locationStatus: 'idle' | 'valid';
  linkedUserId?: number;
}

export interface CreativeBlocks {
  // Base — `format=null` no backend: cobre qualquer formato sem bloco próprio.
  default: CreativeBlockDraft;
  // Sobreposições opcionais por superfície.
  post?: CreativeBlockDraft;
  search_poster?: CreativeBlockDraft;
  conversation?: CreativeBlockDraft;
  notification?: CreativeBlockDraft;
}

export function emptyCreativeBlock(): CreativeBlockDraft {
  return {
    title: '', content: '', targetUrl: '', mediaUrl: '', mediaType: '', ctaLabel: '',
    latitude: '', longitude: '', locationLabel: '', locationStatus: 'idle', linkedUserId: undefined,
  };
}

export function emptyCreativeBlocks(): CreativeBlocks {
  return { default: emptyCreativeBlock() };
}

// Um bloco de sobreposição herda o link/local/conta-vinculada do base — o
// anunciante só personaliza título/texto/mídia por superfície; destino do
// clique, pino no mapa e conta vinculada continuam vindo do base (senão uma
// sobreposição de texto no Feed perderia o pin/vínculo).
export function blocksToCreatives(blocks: CreativeBlocks): CreativeInput[] {
  const base = blocks.default;
  const toInput = (format: AdFormat | undefined, d: CreativeBlockDraft): CreativeInput => ({
    format,
    title: d.title.trim(),
    content: d.content.trim(),
    imageUrl: d.mediaType === 'image' ? d.mediaUrl : undefined,
    videoUrl: d.mediaType === 'video' ? d.mediaUrl : undefined,
    ctaLabel: d.ctaLabel.trim() || undefined,
    // Link/local/conta sempre do base (mesmo numa sobreposição).
    targetUrl: base.targetUrl.trim(),
    latitude: base.latitude.trim() ? Number(base.latitude) : undefined,
    longitude: base.longitude.trim() ? Number(base.longitude) : undefined,
    linkedUserId: base.linkedUserId,
  });
  const out = [toInput(undefined, base)];
  for (const { key } of OVERRIDE_FORMATS) {
    const block = blocks[key];
    if (block) out.push(toInput(key, block));
  }
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
    // Já tem pin (edição/reativação) → nasce confirmado; o rótulo legível é
    // resolvido depois por reverse-geocoding (ver CreativeBlockFields).
    locationLabel: '',
    locationStatus: c.latitude != null && c.longitude != null ? 'valid' : 'idle',
    linkedUserId: c.linkedUserId,
  });
  const def = creatives.find((c) => !c.format);
  const find = (fmt: AdFormat) => {
    const c = creatives.find((x) => x.format === fmt);
    return c ? draftFrom(c) : undefined;
  };
  return {
    default: def ? draftFrom(def) : emptyCreativeBlock(),
    post: find('post'),
    search_poster: find('search_poster'),
    conversation: find('conversation'),
    notification: find('notification'),
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
  const { user } = useAuth();

  const updateBlock = (key: AdFormat, next: CreativeBlockDraft | undefined) =>
    onChange({ ...value, [key]: next });

  // Ao ativar uma sobreposição, parto do conteúdo do base (reaproveita em vez
  // de começar do zero) — mas descarto uma mídia de vídeo em superfícies que
  // só aceitam imagem (ícones de Mensagens/Novidades).
  const seedOverride = (allowVideo: boolean): CreativeBlockDraft => {
    const seed = { ...value.default };
    if (!allowVideo && seed.mediaType === 'video') { seed.mediaUrl = ''; seed.mediaType = ''; }
    return seed;
  };

  // Só ofereço sobreposição pras superfícies que a campanha realmente inclui.
  const overrides = OVERRIDE_FORMATS.filter((f) => formats.includes(f.key));

  return (
    <View style={styles.wrap}>
      <CreativeBlockFields
        label="O anúncio"
        draft={value.default}
        onChange={(next) => onChange({ ...value, default: next })}
        allowVideo
        showLocation={formats.includes('post')}
        showAccountLink
        user={user}
        Colors={Colors}
        styles={styles}
      />

      {overrides.length > 0 && (
        <Text style={styles.overridesHint}>
          O conteúdo acima aparece em todos os lugares. Quer título, texto ou imagem
          diferentes em algum? Personalize abaixo — o resto continua usando o de cima.
        </Text>
      )}

      {overrides.map((f) => {
        const block = value[f.key];
        return (
          <View key={f.key} style={styles.overrideCard}>
            <TouchableOpacity
              style={styles.toggleRow}
              activeOpacity={0.7}
              onPress={() => updateBlock(f.key, block ? undefined : seedOverride(f.allowVideo))}
            >
              <Ionicons
                name={block ? 'checkbox' : 'square-outline'}
                size={18}
                color={block ? Colors.primary : Colors.textTertiary}
              />
              <Text style={styles.toggleText}>Personalizar para {f.label}</Text>
            </TouchableOpacity>
            {block && (
              <CreativeBlockFields
                label={`Em ${f.label}`}
                draft={block}
                onChange={(next) => updateBlock(f.key, next)}
                allowVideo={f.allowVideo}
                showLocation={false}
                showAccountLink={false}
                showTargetUrl={false}
                user={null}
                Colors={Colors}
                styles={styles}
              />
            )}
          </View>
        );
      })}
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
  showTargetUrl = true,
  user,
  Colors,
  styles,
}: {
  label: string;
  draft: CreativeBlockDraft;
  onChange: (next: CreativeBlockDraft) => void;
  allowVideo: boolean;
  showLocation: boolean;
  showAccountLink: boolean;
  showTargetUrl?: boolean;
  user: User | null;
  Colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  // Rótulo legível resolvido por reverse-geocoding ao abrir a edição de um
  // anúncio que já tem pin (só lat/lng). Fica em estado local (não no draft)
  // pra não sobrescrever outros campos que o usuário edite enquanto resolve.
  const [resolvedLabel, setResolvedLabel] = useState('');

  // Centro inicial do mapa de seleção: coordenadas do usuário (como no publish)
  // ou o centro de São Paulo como fallback.
  const pickerCenter = useMemo(
    () =>
      user?.latitude != null && user?.longitude != null
        ? { latitude: user.latitude, longitude: user.longitude }
        : { latitude: -23.5505, longitude: -46.6333 },
    [user?.latitude, user?.longitude],
  );

  useEffect(() => {
    if (draft.locationStatus !== 'valid' || draft.locationLabel) return;
    if (!draft.latitude || !draft.longitude) return;
    let cancelled = false;
    api
      .resolveNeighborhood(Number(draft.latitude), Number(draft.longitude))
      .then((r) => { if (!cancelled) setResolvedLabel(r.displayName); })
      .catch(() => { if (!cancelled) setResolvedLabel('Local marcado no mapa'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escolha de endereço (sugestão ou ponto no mapa) — captura o rótulo + as
  // coordenadas do pin. Digitar à mão volta pra `idle` e limpa o pin, igual
  // ao "Novo post" (só uma escolha confirmada vira um pin de verdade).
  const onChangeLocationText = (v: string) => {
    setResolvedLabel('');
    onChange({ ...draft, locationLabel: v, locationStatus: 'idle', latitude: '', longitude: '' });
  };
  const confirmLocation = (label: string, coords?: { latitude: number; longitude: number }) => {
    onChange({
      ...draft,
      locationLabel: label,
      locationStatus: 'valid',
      latitude: coords ? String(coords.latitude) : draft.latitude,
      longitude: coords ? String(coords.longitude) : draft.longitude,
    });
  };

  const isSelfLinked = !!user && draft.linkedUserId === Number(user.id);

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

  return (
    <View style={styles.creativeBlock}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <TextInput style={styles.input} placeholder="Título" placeholderTextColor={Colors.textTertiary} value={draft.title} onChangeText={(v) => onChange({ ...draft, title: v })} />
      <TextInput style={[styles.input, styles.inputMultiline]} placeholder="Texto" placeholderTextColor={Colors.textTertiary} value={draft.content} onChangeText={(v) => onChange({ ...draft, content: v })} multiline />
      {showTargetUrl && (
        <TextInput style={styles.input} placeholder="Link de destino (ao tocar no anúncio)" placeholderTextColor={Colors.textTertiary} value={draft.targetUrl} onChangeText={(v) => onChange({ ...draft, targetUrl: v })} autoCapitalize="none" />
      )}

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
        <View style={styles.locationField}>
          <Text style={styles.fieldHint}>Local do pin no mapa</Text>
          <LocationAutocompleteInput
            value={draft.locationLabel || resolvedLabel}
            onChangeText={onChangeLocationText}
            onSelect={(label) => confirmLocation(label)}
            onSelectResult={(r) => confirmLocation(r.label, { latitude: r.latitude, longitude: r.longitude })}
            onPickOnMap={() => setLocationPickerOpen(true)}
            status={draft.locationStatus}
            placeholder="Ex.: Rua das Flores 123, Praça..."
          />
        </View>
      )}

      {showAccountLink && !!user && (
        <TouchableOpacity
          style={styles.toggleRow}
          activeOpacity={0.7}
          onPress={() => onChange({ ...draft, linkedUserId: isSelfLinked ? undefined : Number(user.id) })}
        >
          <Ionicons
            name={isSelfLinked ? 'checkbox' : 'square-outline'}
            size={18}
            color={isSelfLinked ? Colors.primary : Colors.textTertiary}
          />
          <Text style={styles.toggleText} numberOfLines={1}>Vincular à conta @{user.username}</Text>
        </TouchableOpacity>
      )}

      {showLocation && (
        <LocationPickerModal
          visible={locationPickerOpen}
          onClose={() => setLocationPickerOpen(false)}
          onConfirm={(address, coords) => { confirmLocation(address, coords); setLocationPickerOpen(false); }}
          initialCenter={pickerCenter}
          neighborhood={user?.neighborhood ?? ''}
        />
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
  toggleText: { fontSize: 13, fontWeight: '700', color: Colors.text, flexShrink: 1 },

  locationField: { gap: 6 },
  fieldHint: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },

  overridesHint: { fontSize: 12, color: Colors.textTertiary, lineHeight: 17, marginTop: 2 },
  overrideCard: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
});
