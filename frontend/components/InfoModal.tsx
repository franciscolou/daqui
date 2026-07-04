import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';

type Variant = 'info' | 'danger';

const VARIANT_ICON: Record<Variant, keyof typeof Ionicons.glyphMap> = {
  info: 'megaphone-outline',
  danger: 'lock-closed-outline',
};

/**
 * Alerta modal do próprio app (nunca `Alert.alert`/`window.alert` — no web eles
 * são no-op ou usam o diálogo nativo do navegador, o que foge do visual do app).
 * Só fecha pelo botão: usado para avisos que o usuário precisa confirmar que leu.
 */
export default function InfoModal({
  visible,
  variant = 'info',
  title,
  message,
  buttonLabel = 'Entendi',
  onClose,
}: {
  visible: boolean;
  variant?: Variant;
  title: string;
  message: string;
  buttonLabel?: string;
  onClose: () => void;
}) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const color = variant === 'danger' ? Colors.error : Colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconBox, { backgroundColor: color + '18' }]}>
            <Ionicons name={VARIANT_ICON[variant]} size={26} color={color} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={[styles.button, { backgroundColor: color }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    ...Colors.shadow.lg,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  message: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  button: {
    alignSelf: 'stretch',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
