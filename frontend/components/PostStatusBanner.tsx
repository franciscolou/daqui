import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useT } from '../lib/i18n';
import { PostStatus } from '../lib/postStatus';

// Aviso fixo por cima do conteúdo de um post — "Expirado" (enquete/evento,
// calculado) ou "Vendido"/"Encontrado" (venda/perdidos, ação manual do autor
// — ver lib/postStatus.ts::getPostStatus). O post continua visível
// normalmente, só ganha este selo.
export default function PostStatusBanner({ status }: { status: PostStatus | null }) {
  const { t } = useT();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (!status) return null;

  const color = status === 'expired' ? Colors.textTertiary : Colors.success;
  const icon = status === 'expired' ? 'time-outline' : 'checkmark-circle';

  return (
    <View style={[styles.banner, { backgroundColor: color + '1A' }]}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[styles.text, { color }]}>{t(`post.status.${status}`)}</Text>
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  text: { fontSize: 12, fontWeight: '700' },
});
