import { Animated, TouchableOpacity, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
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
  saleRadiusKm?: number | null;
  onOpenSaleRadius?: () => void;
}

const PANEL_WIDTH = 220;
const DRAWER_DURATION_MS = 180;

export default function MobileMenu({
  inline = false,
  activeCategory,
  onCategoryChange,
  importantOnly,
  onImportantChange,
  includeNearby,
  onIncludeNearbyChange,
  saleRadiusKm,
  onOpenSaleRadius,
}: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [slideX] = useState(() => new Animated.Value(PANEL_WIDTH));
  const [overlayOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!open) return;

    slideX.setValue(PANEL_WIDTH);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: 0,
        duration: DRAWER_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: DRAWER_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, overlayOpacity, slideX]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: PANEL_WIDTH,
        duration: DRAWER_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: DRAWER_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setOpen(false);
    });
  }, [overlayOpacity, slideX]);

  return (
    <>
      <TouchableOpacity
        style={inline ? styles.trigger : [styles.fab, { top: insets.top + 6 }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="menu" size={22} color={Colors.text} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={close}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} tabIndex={-1} />
          <Animated.View
            style={[
              styles.panel,
              { paddingTop: insets.top, transform: [{ translateX: slideX }] },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <LeftSidebar
                onNavigate={close}
                activeCategory={activeCategory}
                onCategoryChange={onCategoryChange}
                importantOnly={importantOnly}
                onImportantChange={onImportantChange}
                includeNearby={includeNearby}
                onIncludeNearbyChange={onIncludeNearbyChange}
                saleRadiusKm={saleRadiusKm}
                onOpenSaleRadius={onOpenSaleRadius}
              />
            </ScrollView>
          </Animated.View>
        </Animated.View>
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
    width: PANEL_WIDTH,
    backgroundColor: Colors.background,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
    ...Colors.shadow.lg,
  },
});
