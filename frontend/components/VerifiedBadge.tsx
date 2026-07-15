import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useThemedStyles } from '../lib/theme';

// Selo de verificado — exibido ao lado do nome quando User.verified é true.
// O campo já existe no modelo desde sempre mas nenhuma tela renderiza um
// selo pra ele; hoje só é usado pelos anúncios vinculados a conta (ver
// AdPostCard), mas pode ser reaproveitado em qualquer lugar que mostre nome.
export default function VerifiedBadge({ size = 14 }: { size?: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="checkmark" size={Math.round(size * 0.7)} color="#fff" />
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
});
