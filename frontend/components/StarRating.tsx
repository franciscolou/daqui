import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';

const GOLD = '#F59E0B';

/**
 * Nota em estrelas de 0 a 5 com suporte a meia estrela.
 * Cada toque numa estrela cicla seu estado, sem depender de onde foi tocada:
 * vazia -> cheia -> pela metade -> vazia -> ...
 */
export default function StarRating({
  value,
  onChange,
  size = 40,
  gap = 6,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  gap?: number;
  readOnly?: boolean;
}) {
  const Colors = useTheme();

  const cycle = (i: number) => {
    if (!onChange) return;
    const full = value >= i;
    const half = !full && value >= i - 0.5;
    if (full) onChange(i - 0.5);
    else if (half) onChange(i - 1);
    else onChange(i);
  };

  return (
    <View style={[styles.row, { gap }]}>
      {[1, 2, 3, 4, 5].map((i) => {
        const full = value >= i;
        const half = !full && value >= i - 0.5;
        return (
          <View key={i} style={{ width: size, height: size }}>
            <Ionicons name="star-outline" size={size} color={Colors.border} style={styles.icon} />
            {full && <Ionicons name="star" size={size} color={GOLD} style={styles.icon} />}
            {half && <Ionicons name="star-half" size={size} color={GOLD} style={styles.icon} />}
            {!readOnly && !!onChange && (
              <TouchableOpacity
                style={styles.tap}
                activeOpacity={0.7}
                onPress={() => cycle(i)}
                focusable={false}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { position: 'absolute', top: 0, left: 0 },
  tap: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
});
