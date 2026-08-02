import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, type ComponentRef } from 'react';
import { createPortal } from 'react-dom';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';

const WIDTH = 250;

// Versão web do "i": só reage a hover. O popover é renderizado via
// `createPortal` direto em `document.body` — não como filho de nenhum View
// da tela — porque tentar posicioná-lo com `position: absolute` dentro da
// árvore normal disputa a ordem de empilhamento (z-index/stacking context)
// com o que vier depois dele (ex: os chips de "Objetivo da campanha" logo
// abaixo), e pode acabar renderizado por baixo. Um portal pra `document.body`
// escapa desse problema de vez: fica sempre por cima de tudo, sem precisar
// de `Modal` (cujo overlay de tela cheia cobriria o próprio ícone e ficaria
// roubando o hover — abre e fecha em loop, "piscando").
export default function InfoTooltip({ text }: { text: string }) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width: winW, height: winH } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const iconRef = useRef<ComponentRef<typeof Pressable>>(null);

  const handleHoverIn = () => {
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
      <Pressable ref={iconRef} style={styles.iconWrap} onHoverIn={handleHoverIn} onHoverOut={() => setOpen(false)}>
        <Ionicons name="information-circle-outline" size={15} color={Colors.textTertiary} />
      </Pressable>
      {open && anchor && typeof document !== 'undefined' && createPortal(
        <View
          pointerEvents="none"
          style={[
            styles.popover,
            openAbove ? { bottom: winH - anchor.y + 8 } : { top: anchor.y + anchor.height + 8 },
            { left, width: WIDTH },
          ] as any}
        >
          <Text style={styles.popoverText}>{text}</Text>
        </View>,
        document.body,
      )}
    </>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  iconWrap: { borderRadius: 8, padding: 2 },
  popover: {
    position: 'fixed',
    zIndex: 9999,
    backgroundColor: Colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    ...Colors.shadow.lg,
  } as any,
  popoverText: { fontSize: 12.5, lineHeight: 18, fontWeight: '500', color: Colors.surface },
});
