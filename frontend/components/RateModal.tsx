import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useRateForm } from '../lib/useRateForm';
import RateForm from './RateForm';

/** Só usado no desktop — no mobile, "Avaliar o Daqui" abre uma tela cheia (ver app/rate/index.tsx). */
export default function RateModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const form = useRateForm();
  const { load } = form;

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Avaliar o Daqui</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <RateForm form={form} compact />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    ...Colors.shadow.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
});
