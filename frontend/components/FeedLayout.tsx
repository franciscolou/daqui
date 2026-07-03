import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Palette } from '../constants/Colors';
import { useThemedStyles } from '../lib/theme';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import MobileMenu from './MobileMenu';

const WIDE = 900;

/**
 * Estrutura padrão das telas no "modelo do feed": em telas largas o conteúdo
 * central é ladeado pela barra esquerda (navegação) e pela direita (widgets),
 * centralizado. Em telas estreitas, só o conteúdo.
 */
export default function FeedLayout({
  children,
  showMobileMenu = true,
}: {
  children: React.ReactNode;
  // Telas que já têm ações no topo (ex.: um botão de criar) podem esconder o
  // FAB do menu para ele não colidir com seus próprios botões.
  showMobileMenu?: boolean;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE;
  const styles = useThemedStyles(makeStyles);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isWide ? (
        <View style={[styles.wideBody, { paddingHorizontal: Math.max(0, (width - 1140) / 2) }]}>
          <ScrollView style={styles.leftCol} showsVerticalScrollIndicator={false}>
            <LeftSidebar />
          </ScrollView>
          <View style={styles.centerCol}>{children}</View>
          <ScrollView style={styles.rightCol} showsVerticalScrollIndicator={false}>
            <RightSidebar />
          </ScrollView>
        </View>
      ) : (
        <View style={styles.mobileBody}>{children}</View>
      )}
      {!isWide && showMobileMenu && <MobileMenu />}
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  wideBody: { flex: 1, flexDirection: 'row', backgroundColor: Colors.background },
  leftCol: {
    width: 220,
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
  rightCol: { width: 280, flexShrink: 0, backgroundColor: Colors.background },
  mobileBody: { flex: 1, backgroundColor: Colors.surface },
});
