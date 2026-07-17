import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';

const LABEL_WIDTH = 128;

// Botão pequeno (só o ícone) que, no hover (web — em toque não existe hover,
// então fica sempre só o ícone), se estica suavemente e revela o rótulo
// "Escolher no mapa". Usado nos campos de local do publish (ver
// LocationField/o bloco de "recomendação" em publish.tsx).
export default function MapPickButton({ onPress }: { onPress: () => void }) {
  const Colors = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  const animateTo = (toValue: number) => {
    Animated.timing(anim, { toValue, duration: 180, useNativeDriver: false }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => animateTo(1)}
      onHoverOut={() => animateTo(0)}
      style={[styles.btn, { backgroundColor: Colors.primary + '15' }]}
    >
      <Ionicons name="map-outline" size={18} color={Colors.primary} />
      <Animated.View
        style={{
          width: anim.interpolate({ inputRange: [0, 1], outputRange: [0, LABEL_WIDTH] }),
          opacity: anim,
          overflow: 'hidden',
        }}
      >
        <Text style={[styles.label, { color: Colors.primary }]} numberOfLines={1}>
          Escolher no mapa
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    borderRadius: 9,
    paddingHorizontal: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    paddingLeft: 4,
  },
});
