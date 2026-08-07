import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { getItem, setItem } from '../lib/storage';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useT } from '../lib/i18n';

const SKIP_EXTERNAL_LINK_WARNING_KEY = 'daqui.skipExternalLinkWarning';

export async function shouldSkipExternalLinkWarning(): Promise<boolean> {
  return (await getItem(SKIP_EXTERNAL_LINK_WARNING_KEY)) === 'true';
}

export default function ExternalLinkModal({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const close = () => {
    setDontShowAgain(false);
    onClose();
  };

  const proceed = async () => {
    if (!url) return;
    if (dontShowAgain) await setItem(SKIP_EXTERNAL_LINK_WARNING_KEY, 'true');
    close();
    await Linking.openURL(url).catch(() => {});
  };

  let hostname = '';
  if (url) {
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = url;
    }
  }

  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close} tabIndex={-1}>
        <Pressable style={styles.card} onPress={() => {}} tabIndex={-1}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning-outline" size={28} color={Colors.warning} />
          </View>
          <Text style={styles.title}>{t('externalLink.title')}</Text>
          <Text style={styles.message}>{t('externalLink.message')}</Text>
          <View style={styles.destination}>
            <Ionicons name="globe-outline" size={17} color={Colors.textSecondary} />
            <Text style={styles.destinationText} numberOfLines={1}>{hostname}</Text>
          </View>
          <Pressable
            nativeID="external-link-checkbox-no-hover"
            style={styles.checkboxRow}
            onPress={() => setDontShowAgain((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: dontShowAgain }}
          >
            <View style={[styles.checkbox, dontShowAgain && styles.checkboxChecked]}>
              {dontShowAgain && <Ionicons name="checkmark" size={15} color="#fff" />}
            </View>
            <Text style={styles.checkboxLabel}>{t('externalLink.dontShowAgain')}</Text>
          </Pressable>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={close} activeOpacity={0.75}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.continueButton]} onPress={proceed} activeOpacity={0.85}>
              <Text style={styles.continueText}>{t('externalLink.continue')}</Text>
              <Ionicons name="open-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 22,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow.lg,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.warning + '18',
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 7 },
  message: { fontSize: 14, lineHeight: 21, color: Colors.textSecondary },
  destination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  destinationText: { flex: 1, color: Colors.text, fontSize: 13, fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 17 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  cancelButton: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  continueButton: { backgroundColor: Colors.primary },
  cancelText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  continueText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
