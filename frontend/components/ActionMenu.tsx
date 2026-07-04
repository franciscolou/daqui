import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';

export interface ActionMenuOption {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

/** Menu de ações do botão "..." (posts, comentários, perfis). Extensível: hoje só tem denúncia. */
export default function ActionMenu({
  visible,
  onClose,
  options,
}: {
  visible: boolean;
  onClose: () => void;
  options: ActionMenuOption[];
}) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {options.map((opt, i) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.option, i > 0 && styles.optionBorder]}
              onPress={() => {
                onClose();
                opt.onPress();
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={opt.destructive ? Colors.error : Colors.text}
              />
              <Text style={[styles.optionText, opt.destructive && { color: Colors.error }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancelar</Text>
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
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 16,
    },
    optionBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    optionText: { fontSize: 15, fontWeight: '600', color: Colors.text },
    cancel: {
      paddingVertical: 16,
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    cancelText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  });
