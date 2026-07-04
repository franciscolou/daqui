import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Palette } from '../constants/Colors';
import { useThemedStyles } from '../lib/theme';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import MobileMenu from './MobileMenu';

const WIDE = 900;
// Largura de referência do bloco central (sidebar + conteúdo + widgets) usada
// para calcular o recuo esquerdo — precisa bater com a mesma constante usada
// em telas com colunas próprias (mensagens, configurações) para a barra
// lateral não pular de posição ao trocar de tela.
export const CONTENT_MAX_W = 1140;

/**
 * Em telas largas, envolve o conteúdo central com a barra lateral esquerda
 * (navegação) e a direita (widgets), centralizado — igual ao feed.
 * Em telas estreitas, renderiza apenas o conteúdo.
 */
export default function WideLayout({
  children,
  showMobileMenu = true,
}: {
  children: React.ReactNode;
  // Telas que já têm ações no topo (ex.: o form de publicar) podem esconder o
  // FAB do menu para ele não colidir com seus próprios botões.
  showMobileMenu?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const styles = useThemedStyles(makeStyles);

  if (!isWide) {
    return (
      <>
        {children}
        {showMobileMenu && <MobileMenu />}
      </>
    );
  }

  return (
    <View style={[styles.body, { paddingHorizontal: Math.max(0, (width - CONTENT_MAX_W) / 2) }]}>
      {/* Barra lateral esquerda — rolável */}
      <ScrollView style={styles.leftCol} showsVerticalScrollIndicator={false}>
        <LeftSidebar />
      </ScrollView>

      {/* Conteúdo central */}
      <View style={styles.centerCol}>{children}</View>

      {/* Barra lateral direita — rolável */}
      <ScrollView style={styles.rightCol} showsVerticalScrollIndicator={false}>
        <RightSidebar />
      </ScrollView>
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  body: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
  },
  leftCol: {
    width: 220,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: Colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  centerCol: {
    width: 640,
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: Colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  rightCol: {
    width: 280,
    flexShrink: 0,
    backgroundColor: Colors.background,
  },
});
