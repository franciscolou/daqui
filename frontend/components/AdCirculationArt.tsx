import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { lightColors } from '../constants/Colors';

// Peça de assinatura do hero de anúncios: uma composição abstrata mostrando
// a marca do anunciante "circulando" pelas superfícies do Daqui (feed, mapa,
// Novidades, Mensagens). Cada cartão reaproveita a MESMA gramática visual dos
// componentes reais (ver AdPreview.tsx: avatar/ícone + texto de exemplo),
// só que em miniatura e sem interatividade — não é screenshot nem card
// genérico, é uma prévia estilizada do produto de verdade. Cartões e traço
// usam sempre as cores do tema claro (`lightColors`), de propósito: eles
// pousam sobre o gradiente verde do hero (fixo nos dois temas), não sobre o
// fundo da página, então não devem reagir ao tema — mesmo padrão dos badges
// pastel fixos citados no CLAUDE.md.

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function SignalPulse({ cx, cy, reducedMotion }: { cx: number; cy: number; reducedMotion: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    t.value = withDelay(900, withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({
    r: 1.6 + t.value * 5,
    opacity: reducedMotion ? 0 : 0.5 * (1 - t.value),
  }));

  return <AnimatedCircle cx={cx} cy={cy} fill="none" stroke="#fff" strokeWidth={0.5} animatedProps={animatedProps} />;
}

// Cada card flutua com sua própria amplitude/duração/atraso pra não parecer
// um bloco só respirando em sincronia — o objetivo é um movimento orgânico,
// quase imperceptível, não um "efeito" chamativo.
function useFloatStyle(
  config: { amplitude: number; duration: number; delay: number; rotateDeg: number; rotateWobble: number },
  reducedMotion: boolean,
) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    t.value = withDelay(
      config.delay,
      withRepeat(withTiming(1, { duration: config.duration, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return useAnimatedStyle(() => {
    const drift = reducedMotion ? 0 : (t.value - 0.5) * 2;
    return {
      transform: [
        { translateY: drift * config.amplitude },
        { translateX: drift * config.amplitude * 0.3 },
        { rotate: `${config.rotateDeg + drift * config.rotateWobble}deg` },
      ],
    };
  });
}

const PATH_D = 'M 16 24 C 40 6, 62 10, 82 16 C 96 20, 90 46, 70 52 C 48 58, 46 78, 66 84 C 78 88, 20 90, 22 68 C 24 50, -2 42, 16 24';

function Badge({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.badge}>
      <Ionicons name={icon} size={15} color="#fff" />
    </View>
  );
}

function Lines({ lines }: { lines: string[] }) {
  return (
    <View style={{ gap: 3, flex: 1 }}>
      {lines.map((line, i) => (
        <Text
          key={i}
          numberOfLines={1}
          style={i === 0 ? styles.linePrimary : styles.lineSecondary}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

export default function AdCirculationArt({ reducedMotion }: { reducedMotion: boolean }) {
  const feedFloat = useFloatStyle({ amplitude: 5, duration: 3900, delay: 0, rotateDeg: -3, rotateWobble: 0.8 }, reducedMotion);
  const mapFloat = useFloatStyle({ amplitude: 4, duration: 3200, delay: 500, rotateDeg: 2, rotateWobble: 0.6 }, reducedMotion);
  const notifFloat = useFloatStyle({ amplitude: 4.6, duration: 4500, delay: 900, rotateDeg: 2, rotateWobble: 0.9 }, reducedMotion);
  const convFloat = useFloatStyle({ amplitude: 3.6, duration: 3600, delay: 250, rotateDeg: -2, rotateWobble: 0.5 }, reducedMotion);

  return (
    <View style={styles.canvas} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Path d={PATH_D} stroke="rgba(255,255,255,0.4)" strokeWidth={0.6} strokeDasharray="2.6 3.2" strokeLinecap="round" fill="none" />
        <SignalPulse cx={16} cy={24} reducedMotion={reducedMotion} />
      </Svg>

      <Animated.View style={[styles.chip, styles.chipFeed, feedFloat]}>
        <View style={styles.chipRow}>
          <Badge icon="storefront-outline" />
          <Lines lines={['Padaria Nova', 'Patrocinado']} />
        </View>
        <Text numberOfLines={1} style={styles.captionText}>Pão fresquinho todo dia ☀️</Text>
        <View style={styles.chipFooterRow}>
          <Ionicons name="heart-outline" size={12} color={lightColors.textTertiary} />
          <Text style={styles.footerCount}>24</Text>
          <Ionicons name="chatbubble-outline" size={11} color={lightColors.textTertiary} style={{ marginLeft: 6 }} />
          <Text style={styles.footerCount}>6</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.chip, styles.chipMap, mapFloat]}>
        <View style={styles.mapPin}>
          <Ionicons name="location" size={16} color="#fff" />
        </View>
        <Text style={styles.chipLabel} numberOfLines={1}>Patrocinado</Text>
      </Animated.View>

      <Animated.View style={[styles.chip, styles.chipNotif, notifFloat]}>
        <Badge icon="megaphone-outline" />
        <Lines lines={['Novidade por perto', 'Confira a promoção']} />
      </Animated.View>

      <Animated.View style={[styles.chip, styles.chipConv, convFloat]}>
        <Badge icon="chatbubbles-outline" />
        <Lines lines={['Recomendo esse salão!', 'Combinar horário']} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: '100%', height: '100%', position: 'relative' },
  chip: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 14,
    padding: 10,
    boxShadow: '0px 6px 16px rgba(8,28,18,0.22)',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8 },
  badge: {
    width: 26, height: 26, borderRadius: 9,
    backgroundColor: lightColors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  chipLabel: { fontSize: 11, fontWeight: '700', color: lightColors.text },
  linePrimary: { fontSize: 11, fontWeight: '700', color: lightColors.text },
  lineSecondary: { fontSize: 10, fontWeight: '500', color: lightColors.textTertiary },
  captionText: { fontSize: 10.5, fontWeight: '500', color: lightColors.textSecondary, marginTop: 6 },
  footerCount: { fontSize: 10.5, fontWeight: '600', color: lightColors.textTertiary },

  chipFeed: { left: '3%', top: '6%', width: '48%' },
  chipMap: {
    right: '2%', top: '2%', width: '38%',
    alignItems: 'center', gap: 6, paddingVertical: 12,
  },
  chipNotif: { left: '0%', bottom: '4%', width: '46%' },
  chipConv: { right: '1%', bottom: '9%', width: '42%' },

  mapPin: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: lightColors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
});
