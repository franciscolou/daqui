import { View, Text } from 'react-native';
import { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../../lib/theme';
import { formatCompactNumber } from './chartUtils';

export interface RankedBarDatum {
  key: string;
  label: string;
  value: number;
  sublabel?: string;
}

interface RankedBarChartProps {
  data: RankedBarDatum[];
  color?: string;
  valueFormatter?: (v: number) => string;
  emptyLabel?: string;
}

function Bar({ pct, color, delay, trackColor }: { pct: number; color: string; delay: number; trackColor: string }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = 0;
    width.value = withDelay(delay, withTiming(pct, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [pct, delay, width]);
  const style = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, width.value)) * 100}%` }));
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: trackColor, overflow: 'hidden' }}>
      <Animated.View
        style={[
          {
            height: '100%',
            backgroundColor: color,
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
          },
          style,
        ]}
      />
    </View>
  );
}

// Barras horizontais ranqueadas por magnitude (não identidade) — por isso um
// hue só, comprimento carrega o valor; o rótulo de texto ao lado já garante
// a identidade de cada linha, sem depender de cor.
export default function RankedBarChart({ data, color, valueFormatter, emptyLabel = 'Sem dados.' }: RankedBarChartProps) {
  const Colors = useTheme();
  const barColor = color ?? Colors.primary;
  const fmt = valueFormatter ?? formatCompactNumber;
  const max = Math.max(1, ...data.map((d) => d.value));

  if (!data.length) {
    return (
      <Text style={{ fontSize: 13, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 16 }}>
        {emptyLabel}
      </Text>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {data.map((d, i) => (
        <View key={d.key} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.text, flex: 1 }} numberOfLines={1}>
              {d.label}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textSecondary }}>
              {fmt(d.value)}
              {d.sublabel ? ` · ${d.sublabel}` : ''}
            </Text>
          </View>
          <Bar pct={d.value / max} color={barColor} delay={i * 60} trackColor={Colors.borderLight} />
        </View>
      ))}
    </View>
  );
}
