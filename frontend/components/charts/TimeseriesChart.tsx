import { View, Text, LayoutChangeEvent } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import Svg, { Circle, Defs, ClipPath, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../../lib/theme';
import { formatCompactNumber, niceTicks, pickLabelIndices } from './chartUtils';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export interface TimeseriesDatum {
  key: string;
  label: string;
  a: number;
  b: number;
}

interface TimeseriesChartProps {
  data: TimeseriesDatum[];
  seriesALabel: string;
  seriesBLabel: string;
  seriesAColor?: string;
  seriesBColor?: string;
  height?: number;
}

const PAD_TOP = 14;
const PAD_BOTTOM = 24;
const PAD_LEFT = 38;
const PAD_RIGHT = 40;

// Gráfico de linha + área para duas séries na mesma escala (impressões e
// cliques são ambos contagens — nunca eixo duplo). Área só na série
// principal (evita a leitura confusa de duas áreas translúcidas
// sobrepostas); a secundária fica só como linha. Revelado com animação de
// "cortina" via clip-path (funciona igual em web e nativo, sem depender de
// medir o comprimento do path).
export default function TimeseriesChart({
  data,
  seriesALabel,
  seriesBLabel,
  seriesAColor,
  seriesBColor,
  height = 200,
}: TimeseriesChartProps) {
  const Colors = useTheme();
  const colorA = seriesAColor ?? Colors.primary;
  const colorB = seriesBColor ?? Colors.accent;
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const chartW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const chartH = height - PAD_TOP - PAD_BOTTOM;

  const geometry = useMemo(() => {
    if (!data.length || chartW <= 0) return null;
    const maxRaw = Math.max(1, ...data.map((d) => Math.max(d.a, d.b)));
    const ticks = niceTicks(maxRaw, 3);
    const yMax = ticks[ticks.length - 1];
    const n = data.length;
    const xStep = n > 1 ? chartW / (n - 1) : 0;
    const xAt = (i: number) => PAD_LEFT + i * xStep;
    const yAt = (v: number) => PAD_TOP + chartH - (v / yMax) * chartH;
    const pointsA = data.map((d, i) => ({ x: xAt(i), y: yAt(d.a) }));
    const pointsB = data.map((d, i) => ({ x: xAt(i), y: yAt(d.b) }));
    const lineOf = (pts: { x: number; y: number }[]) =>
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaOf = (pts: { x: number; y: number }[]) => {
      const baseline = PAD_TOP + chartH;
      return `${lineOf(pts)} L ${pts[pts.length - 1].x.toFixed(1)} ${baseline} L ${pts[0].x.toFixed(1)} ${baseline} Z`;
    };
    return { ticks, yMax, xStep, xAt, yAt, pointsA, pointsB, lineOf, areaOf };
  }, [data, chartW, chartH]);

  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) });
  }, [data, reveal]);
  const clipProps = useAnimatedProps(() => ({ width: Math.max(0, chartW * reveal.value) }));

  if (!data.length) {
    return (
      <View onLayout={onLayout} style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, color: Colors.textTertiary }}>Sem eventos no período.</Text>
      </View>
    );
  }

  const labelIndices = pickLabelIndices(data.length, Math.max(2, Math.floor(chartW / 70)));

  const handleTouch = (evt: any) => {
    if (!geometry) return;
    const x = evt.nativeEvent.locationX;
    const idx = geometry.xStep > 0 ? Math.round((x - PAD_LEFT) / geometry.xStep) : 0;
    setActiveIndex(Math.max(0, Math.min(data.length - 1, idx)));
  };

  let labelAY: number | null = null;
  let labelBY: number | null = null;
  if (geometry) {
    const lastA = geometry.pointsA[geometry.pointsA.length - 1];
    const lastB = geometry.pointsB[geometry.pointsB.length - 1];
    labelAY = lastA.y;
    labelBY = lastB.y;
    if (Math.abs(labelAY - labelBY) < 14) {
      if (labelAY < labelBY) { labelAY -= 7; labelBY += 7; }
      else { labelAY += 7; labelBY -= 7; }
    }
  }

  const active = activeIndex != null ? data[activeIndex] : null;
  const activeX = geometry && activeIndex != null ? geometry.xAt(activeIndex) : null;
  const tooltipLeft = activeX != null ? Math.min(Math.max(activeX - 60, 0), Math.max(0, width - 130)) : 0;

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8 }}>
        <LegendDot color={colorA} label={seriesALabel} textColor={Colors.textSecondary} />
        <LegendDot color={colorB} label={seriesBLabel} textColor={Colors.textSecondary} />
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
              <ClipPath id="ts-reveal-clip">
                <AnimatedRect x={PAD_LEFT} y={0} height={height} animatedProps={clipProps} />
              </ClipPath>
            </Defs>

            {geometry.ticks.map((t) => (
              <G key={t}>
                <Line
                  x1={PAD_LEFT}
                  x2={width - PAD_RIGHT}
                  y1={geometry.yAt(t)}
                  y2={geometry.yAt(t)}
                  stroke={Colors.borderLight}
                  strokeWidth={1}
                />
                <SvgText x={PAD_LEFT - 8} y={geometry.yAt(t) + 3} fontSize={10} fill={Colors.textTertiary} textAnchor="end">
                  {formatCompactNumber(t)}
                </SvgText>
              </G>
            ))}

            <G clipPath="url(#ts-reveal-clip)">
              <Path d={geometry.areaOf(geometry.pointsA)} fill={colorA} fillOpacity={0.1} />
              <Path d={geometry.lineOf(geometry.pointsB)} stroke={colorB} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <Path d={geometry.lineOf(geometry.pointsA)} stroke={colorA} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />

              <Circle cx={geometry.pointsB[geometry.pointsB.length - 1].x} cy={geometry.pointsB[geometry.pointsB.length - 1].y} r={6} fill={Colors.surface} />
              <Circle cx={geometry.pointsB[geometry.pointsB.length - 1].x} cy={geometry.pointsB[geometry.pointsB.length - 1].y} r={4} fill={colorB} />
              <Circle cx={geometry.pointsA[geometry.pointsA.length - 1].x} cy={geometry.pointsA[geometry.pointsA.length - 1].y} r={6} fill={Colors.surface} />
              <Circle cx={geometry.pointsA[geometry.pointsA.length - 1].x} cy={geometry.pointsA[geometry.pointsA.length - 1].y} r={4} fill={colorA} />
            </G>

            {labelAY != null && (
              <SvgText x={geometry.pointsA[geometry.pointsA.length - 1].x + 9} y={labelAY + 4} fontSize={11} fontWeight="700" fill={Colors.text}>
                {formatCompactNumber(data[data.length - 1].a)}
              </SvgText>
            )}
            {labelBY != null && (
              <SvgText x={geometry.pointsB[geometry.pointsB.length - 1].x + 9} y={labelBY + 4} fontSize={11} fontWeight="700" fill={Colors.text}>
                {formatCompactNumber(data[data.length - 1].b)}
              </SvgText>
            )}

            {labelIndices.map((i) => (
              <SvgText key={i} x={geometry.xAt(i)} y={height - 6} fontSize={10} fill={Colors.textTertiary} textAnchor="middle">
                {data[i].label}
              </SvgText>
            ))}

            {activeIndex != null && (
              <G>
                <Line x1={geometry.xAt(activeIndex)} x2={geometry.xAt(activeIndex)} y1={PAD_TOP} y2={PAD_TOP + chartH} stroke={Colors.textTertiary} strokeWidth={1} strokeDasharray="3,3" />
                <Circle cx={geometry.xAt(activeIndex)} cy={geometry.pointsA[activeIndex].y} r={5} fill={Colors.surface} stroke={colorA} strokeWidth={2} />
                <Circle cx={geometry.xAt(activeIndex)} cy={geometry.pointsB[activeIndex].y} r={5} fill={Colors.surface} stroke={colorB} strokeWidth={2} />
              </G>
            )}
          </Svg>
        )}

        {active && activeX != null && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: tooltipLeft,
              top: 4,
              backgroundColor: Colors.surfaceElevated,
              borderWidth: 1,
              borderColor: Colors.borderLight,
              borderRadius: 10,
              paddingVertical: 6,
              paddingHorizontal: 10,
              gap: 2,
              ...Colors.shadow.md,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.text }}>{active.label}</Text>
            <Text style={{ fontSize: 11, color: Colors.textSecondary }}>{seriesALabel}: {active.a.toLocaleString('pt-BR')}</Text>
            <Text style={{ fontSize: 11, color: Colors.textSecondary }}>{seriesBLabel}: {active.b.toLocaleString('pt-BR')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function LegendDot({ color, label, textColor }: { color: string; label: string; textColor: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: textColor }}>{label}</Text>
    </View>
  );
}
