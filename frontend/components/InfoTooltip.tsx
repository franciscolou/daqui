import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, type ComponentRef } from 'react';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';

const WIDTH = 250;

// Versão nativa (iOS/Android) do "i": sem hover (não existe em touch), então
// abre num Modal — toque no ícone abre, toque de novo ou em qualquer lugar
// fora do popover fecha.
export default function InfoTooltip({ text }: { text: string }) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width: winW, height: winH } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const iconRef = useRef<ComponentRef<typeof TouchableOpacity>>(null);

  const handlePress = () => {
    if (open) { setOpen(false); return; }
    iconRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const openAbove = !!anchor && anchor.y > winH / 2;
  const left = anchor
    ? Math.max(12, Math.min(anchor.x - (WIDTH - anchor.width) / 2, winW - WIDTH - 12))
    : 0;

  return (
    <>
      <TouchableOpacity ref={iconRef} style={styles.iconWrap} onPress={handlePress}>
        <Ionicons name="information-circle-outline" size={15} color={Colors.textTertiary} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} tabIndex={-1}>
          {anchor && (
            <View
              style={[
                styles.popover,
                openAbove ? { bottom: winH - anchor.y + 8 } : { top: anchor.y + anchor.height + 8 },
                { left, width: WIDTH },
              ]}
            >
              <Text style={styles.popoverText}>{text}</Text>
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  iconWrap: { borderRadius: 8, padding: 2 },
  overlay: { flex: 1 },
  popover: {
    position: 'absolute',
    backgroundColor: Colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    ...Colors.shadow.lg,
  },
  popoverText: { fontSize: 12.5, lineHeight: 18, fontWeight: '500', color: Colors.surface },
});
