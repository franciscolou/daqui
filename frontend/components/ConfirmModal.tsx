import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';

/**
 * Modal de confirmação sim/não do próprio app (nunca `window.confirm`, que não
 * funciona bem na web/nativo). Usado para ações destrutivas (excluir post/comentário).
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={loading ? undefined : onClose} tabIndex={-1}>
        <Pressable style={styles.card} onPress={() => {}} tabIndex={-1}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, destructive ? styles.dangerBtn : styles.confirmBtn]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
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
      padding: 20,
      ...Colors.shadow.lg,
    },
    title: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 6 },
    message: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
    btn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtn: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
    cancelText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
    confirmBtn: { backgroundColor: Colors.primary },
    dangerBtn: { backgroundColor: Colors.error },
    confirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
