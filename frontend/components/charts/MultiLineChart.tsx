import { View, Text, LayoutChangeEvent } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import Svg, { Circle, Defs, ClipPath, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../../lib/theme';
import { formatCompactNumber, niceTicks, pickLabelIndices } from './chartUtils';
import { activeLocale } from '../../lib/time';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export interface MultiLineSeries {
  key: string;
  label: string;
  color: string;
  values: number[]; // alinhado a `xLabels`, mesmo índice
}

interface MultiLineChartProps {
  xLabels: string[]; // rótulos curtos do eixo X (dia formatado)
  series: MultiLineSeries[];
  height?: number;
  emptyLabel: string;
}

const PAD_TOP = 14;
const PAD_BOTTOM = 24;
const PAD_LEFT = 38;
const PAD_RIGHT = 8;
// Só faz sentido rotular a linha diretamente (nome, não valor — ver skill de
// dataviz) quando poucas séries cabem sem virar sopa de texto; do contrário
// a legenda abaixo do gráfico já garante que identidade nunca depende só de cor.
const DIRECT_LABEL_MAX_SERIES = 4;

// Gráfico de múltiplas linhas pra comparar campanhas na mesma janela de dias —
// ao contrário de TimeseriesChart (2 séries fixas, área na principal), aqui
// toda série é só linha fina (marcas grossas/área com N sobrepostas
// deixariam de ser legíveis — ver anti-patterns da skill de dataviz).
export default function MultiLineChart({ xLabels, series, height = 220, emptyLabel }: MultiLineChartProps) {
  const Colors = useTheme();
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const chartW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const chartH = height - PAD_TOP - PAD_BOTTOM;

  const geometry = useMemo(() => {
    if (!xLabels.length || chartW <= 0 || !series.length) return null;
    const maxRaw = Math.max(1, ...series.flatMap((s) => s.values));
    const ticks = niceTicks(maxRaw, 3);
    const yMax = ticks[ticks.length - 1];
    const n = xLabels.length;
    const xStep = n > 1 ? chartW / (n - 1) : 0;
    const xAt = (i: number) => PAD_LEFT + i * xStep;
    const yAt = (v: number) => PAD_TOP + chartH - (v / yMax) * chartH;
    const linesFor = (values: number[]) => values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    const pathOf = (pts: { x: number; y: number }[]) =>
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return { ticks, yMax, xStep, xAt, yAt, linesFor, pathOf };
  }, [xLabels, series, chartW, chartH]);

  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) });
  }, [series, reveal]);
  const clipProps = useAnimatedProps(() => ({ width: Math.max(0, chartW * reveal.value) }));

  if (!series.length) {
    return (
      <View onLayout={onLayout} style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, color: Colors.textTertiary }}>{emptyLabel}</Text>
      </View>
    );
  }

  const labelIndices = pickLabelIndices(xLabels.length, Math.max(2, Math.floor(chartW / 70)));
  const directLabel = series.length <= DIRECT_LABEL_MAX_SERIES;

  const handleTouch = (evt: any) => {
    if (!geometry) return;
    const x = evt.nativeEvent.locationX;
    const idx = geometry.xStep > 0 ? Math.round((x - PAD_LEFT) / geometry.xStep) : 0;
    setActiveIndex(Math.max(0, Math.min(xLabels.length - 1, idx)));
  };

  const activeX = geometry && activeIndex != null ? geometry.xAt(activeIndex) : null;
  const tooltipW = 168;
  const tooltipLeft = activeX != null ? Math.min(Math.max(activeX - tooltipW / 2, 0), Math.max(0, width - tooltipW)) : 0;

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
        {series.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 180 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: Colors.textSecondary }} numberOfLines={1}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View
        onLayout={onLayout}
        style={{ height }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={() => setActiveIndex(null)}
      >
        {width > 0 && geometry && (
          <Svg width={width} height={height}>
            <Defs>
              <ClipPath id="ml-reveal-clip">
                <AnimatedRect x={PAD_LEFT} y={0} height={height} animatedProps={clipProps} />
              </ClipPath>
            </Defs>

            {geometry.ticks.map((t) => (
              <G key={t}>
                <Line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={geometry.yAt(t)} y2={geometry.yAt(t)} stroke={Colors.borderLight} strokeWidth={1} />
                <SvgText x={PAD_LEFT - 8} y={geometry.yAt(t) + 3} fontSize={10} fill={Colors.textTertiary} textAnchor="end">
                  {formatCompactNumber(t)}
                </SvgText>
              </G>
            ))}

            <G clipPath="url(#ml-reveal-clip)">
              {series.map((s) => {
                const pts = geometry.linesFor(s.values);
                const last = pts[pts.length - 1];
                return (
                  <G key={s.key}>
                    <Path d={geometry.pathOf(pts)} stroke={s.color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={last.x} cy={last.y} r={5} fill={Colors.surface} />
                    <Circle cx={last.x} cy={last.y} r={3.5} fill={s.color} />
                    {directLabel && (
                      <SvgText x={last.x - 4} y={last.y - 8} fontSize={10} fontWeight="700" fill={s.color} textAnchor="end">
                        {s.label.length > 18 ? `${s.label.slice(0, 17)}…` : s.label}
                      </SvgText>
                    )}
                  </G>
                );
              })}
            </G>

            {labelIndices.map((i) => (
              <SvgText key={i} x={geometry.xAt(i)} y={height - 6} fontSize={10} fill={Colors.textTertiary} textAnchor="middle">
                {xLabels[i]}
              </SvgText>
            ))}

            {activeIndex != null && (
              <Line x1={geometry.xAt(activeIndex)} x2={geometry.xAt(activeIndex)} y1={PAD_TOP} y2={PAD_TOP + chartH} stroke={Colors.textTertiary} strokeWidth={1} strokeDasharray="3,3" />
            )}
          </Svg>
        )}

        {activeIndex != null && activeX != null && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: tooltipLeft,
              top: 4,
              width: tooltipW,
              backgroundColor: Colors.surfaceElevated,
              borderWidth: 1,
              borderColor: Colors.borderLight,
              borderRadius: 10,
              paddingVertical: 8,
              paddingHorizontal: 10,
              gap: 4,
              ...Colors.shadow.md,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.text }}>{xLabels[activeIndex]}</Text>
            {series.map((s) => (
              <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.color }} />
                <Text style={{ flex: 1, fontSize: 10.5, color: Colors.textSecondary }} numberOfLines={1}>{s.label}</Text>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: Colors.text }}>
                  {s.values[activeIndex].toLocaleString(activeLocale())}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
