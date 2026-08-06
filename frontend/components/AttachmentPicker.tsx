import { Dispatch, SetStateAction, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { PickedMediaAsset } from '../lib/api';
import { useT } from '../lib/i18n';

export interface AttachmentDraft {
  localUri: string;
  type: 'image' | 'video';
  url?: string;
  uploading: boolean;
}

interface AttachmentPickerProps {
  attachments: AttachmentDraft[];
  setAttachments: Dispatch<SetStateAction<AttachmentDraft[]>>;
  upload: (asset: PickedMediaAsset) => Promise<{ url: string; type: 'image' | 'video' }>;
  max?: number;
  label?: string;
}

/** Seletor de anexos (fotos/vídeos) reutilizado por ReportModal e "Meus
 * chamados" — cada tela mantém o estado (`attachments`) e só repassa as URLs
 * já enviadas (`.url`) no payload final. */
export default function AttachmentPicker({
  attachments,
  setAttachments,
  upload,
  max = 3,
  label,
}: AttachmentPickerProps) {
  const { t } = useT();
  const resolvedLabel = label ?? t('attachments.label');
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const remaining = max - attachments.length;
    if (remaining <= 0) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(t('attachments.permission'));
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.7,
      });
      if (res.canceled) return;

      const picked = res.assets.slice(0, remaining);
      const drafts: AttachmentDraft[] = picked.map((a) => ({
        localUri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        uploading: true,
      }));
      setAttachments((prev) => [...prev, ...drafts]);

      await Promise.all(
        picked.map(async (asset, i) => {
          const localUri = drafts[i].localUri;
          try {
            const uploaded = await upload({
              uri: asset.uri,
              mimeType: asset.mimeType ?? undefined,
              fileName: asset.fileName ?? undefined,
            });
            setAttachments((prev) =>
              prev.map((a) =>
                a.localUri === localUri ? { ...a, url: uploaded.url, uploading: false } : a,
              ),
            );
          } catch {
            setAttachments((prev) => prev.filter((a) => a.localUri !== localUri));
            setError(t('attachments.uploadError'));
          }
        }),
      );
    } catch {
      setError(t('attachments.loadError'));
    }
  };

  const remove = (localUri: string) => {
    setAttachments((prev) => prev.filter((a) => a.localUri !== localUri));
  };

  return (
    <View>
      <Text style={styles.label}>{`${resolvedLabel} (${attachments.length}/${max})`}</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {attachments.length === 0 ? (
        <TouchableOpacity style={styles.picker} onPress={pick} activeOpacity={0.8}>
          <Ionicons name="attach-outline" size={20} color={Colors.primary} />
          <Text style={styles.pickerText}>{t('attachments.add')}</Text>
        </TouchableOpacity>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {attachments.map((a) => (
            <View key={a.localUri} style={styles.thumbWrap}>
              {a.type === 'video' ? (
                <View style={[styles.thumb, styles.videoThumb]}>
                  <Ionicons name="videocam" size={20} color="#fff" />
                </View>
              ) : (
                <Image source={{ uri: a.localUri }} style={styles.thumb} resizeMode="cover" />
              )}
              {a.uploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => remove(a.localUri)}
                disabled={a.uploading}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {attachments.length < max && (
            <TouchableOpacity style={styles.addThumb} onPress={pick} activeOpacity={0.8}>
              <Ionicons name="add" size={22} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
    label: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 8 },
    error: { fontSize: 12, color: Colors.error, marginBottom: 8 },
    picker: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Colors.border,
      borderStyle: 'dashed',
      backgroundColor: Colors.background,
    },
    pickerText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
    row: { gap: 10 },
    thumbWrap: { position: 'relative', width: 64, height: 64 },
    thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: Colors.border },
    videoThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E293B' },
    uploadingOverlay: {
      position: 'absolute',
      inset: 0,
      borderRadius: 12,
      backgroundColor: 'rgba(15,23,42,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    } as any,
    removeBtn: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: Colors.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addThumb: {
      width: 64,
      height: 64,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.background,
    },
  });
