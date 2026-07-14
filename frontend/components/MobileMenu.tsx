import { TouchableOpacity, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import LeftSidebar from './LeftSidebar';

/**
 * Botão flutuante (apenas mobile) que abre a barra lateral como um drawer —
 * dá acesso ao que no desktop fica sempre visível (Novidades, Configurações,
 * App, modo escuro, etc.).
 */
interface Props {
  inline?: boolean;
  // Repassados ao LeftSidebar interno — usado pelo feed para dar acesso, no
  // drawer mobile, ao filtro de categorias e ao checkbox "Somente importantes"
  // (no desktop eles ficam sempre visíveis na sidebar fixa).
  activeCategory?: string;
  onCategoryChange?: (key: string) => void;
  importantOnly?: boolean;
  onImportantChange?: (value: boolean) => void;
  includeNearby?: boolean;
  onIncludeNearbyChange?: (value: boolean) => void;
}

export default function MobileMenu({
  inline = false,
  activeCategory,
  onCategoryChange,
  importantOnly,
  onImportantChange,
  includeNearby,
  onIncludeNearbyChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <>
      <TouchableOpacity
        style={inline ? styles.trigger : [styles.fab, { top: insets.top + 6 }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="menu" size={22} color={Colors.text} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} tabIndex={-1}>
          <Pressable style={[styles.panel, { paddingTop: insets.top }]} onPress={() => {}} tabIndex={-1}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <LeftSidebar
                onNavigate={() => setOpen(false)}
                activeCategory={activeCategory}
                onCategoryChange={onCategoryChange}
                importantOnly={importantOnly}
                onImportantChange={onImportantChange}
                includeNearby={includeNearby}
                onIncludeNearbyChange={onIncludeNearbyChange}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 12,
    zIndex: 50,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow.md,
  },
  // Variante inline: botão comum, para colocar dentro de um header/top bar.
  trigger: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  panel: {
    width: 220,
    backgroundColor: Colors.background,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
    ...Colors.shadow.lg,
  },
});
