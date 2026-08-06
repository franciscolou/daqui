import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { MuteDuration, MuteStatus } from '../lib/api';
import { formatExactDateTime } from '../lib/time';
import { useT } from '../lib/i18n';

// Silenciamento de notificações de uma conversa (DM) ou grupo — mesmo menu
// pros dois casos. Silenciado: some do selo agregado de "Mensagens" (ver
// services/message.py::unread_count no backend) até expirar ou ser reativado.
const DURATIONS: MuteDuration[] = ['8h', '1d', '1w', 'forever'];

interface MuteMenuProps {
  visible: boolean;
  onClose: () => void;
  status: MuteStatus;
  // "conversa" (DM) ou "grupo" — só muda o texto exibido.
  subject: 'conversa' | 'grupo';
  onMute: (duration: MuteDuration) => Promise<void>;
  onUnmute: () => Promise<void>;
}

export default function MuteMenu({ visible, onClose, status, subject, onMute, onUnmute }: MuteMenuProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await action();
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} tabIndex={-1}>
        <Pressable style={styles.card} onPress={() => {}} tabIndex={-1}>
          <View style={styles.header}>
            <Ionicons
              name={status.isMuted ? 'notifications-off' : 'notifications-outline'}
              size={20}
              color={status.isMuted ? Colors.textSecondary : Colors.primary}
            />
            <Text style={styles.title}>{t(`mute.title.${subject}`)}</Text>
          </View>
          <Text style={styles.subtitle}>
            {status.isMuted
              ? status.mutedUntil
                ? t('mute.mutedUntil', { date: formatExactDateTime(status.mutedUntil) })
                : t('mute.mutedForever')
              : t('mute.activeDescription')}
          </Text>

          {status.isMuted && (
            <TouchableOpacity
              style={[styles.option, styles.reactivateOption]}
              activeOpacity={0.7}
              onPress={() => run('unmute', onUnmute)}
              disabled={!!busy}
            >
              {busy === 'unmute' ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons name="notifications" size={18} color={Colors.primary} />
              )}
              <Text style={[styles.optionText, { color: Colors.primary }]}>{t('mute.reactivate')}</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionLabel}>
            {t(status.isMuted ? 'mute.changeDuration' : 'mute.muteFor')}
          </Text>
          {DURATIONS.map((duration, i) => (
            <TouchableOpacity
              key={duration}
              style={[styles.option, i > 0 && styles.optionBorder]}
              activeOpacity={0.7}
              onPress={() => run(duration, () => onMute(duration))}
              disabled={!!busy}
            >
              {busy === duration ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <Ionicons name="moon-outline" size={18} color={Colors.text} />
              )}
              <Text style={styles.optionText}>{t(`mute.duration.${duration}`)}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
      ...Colors.shadow.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 18,
      paddingTop: 18,
    },
    title: { fontSize: 15, fontWeight: '800', color: Colors.text, flexShrink: 1 },
    subtitle: {
      fontSize: 12,
      color: Colors.textTertiary,
      paddingHorizontal: 18,
      paddingTop: 6,
      paddingBottom: 12,
      lineHeight: 17,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: Colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    optionBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    reactivateOption: { paddingTop: 4 },
    optionText: { fontSize: 14, fontWeight: '600', color: Colors.text },
    cancel: {
      paddingVertical: 16,
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    cancelText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  });
