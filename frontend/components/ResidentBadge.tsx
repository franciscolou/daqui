import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';

// Selo exibido junto ao nome do autor em posts/comentários quando ele mora no
// bairro daquela publicação (bairro atual == bairro do post/comentário).
export default function ResidentBadge() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.badge}>
      <Ionicons name="home" size={10} color={Colors.success} />
      <Text style={styles.badgeText}>Morador</Text>
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.success + '1A',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: Colors.success },
});
