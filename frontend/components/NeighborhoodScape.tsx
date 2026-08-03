import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withRepeat, withTiming, withDelay, runOnJS, Easing, SharedValue,
} from 'react-native-reanimated';

// ─── Composição SVG "bairro abstrato" ──────────────────────────────────────
// Interpretação artística de um mapa de bairro (ruas, quarteirões, pontos de
// atividade e um marcador central), não um mapa real. Coordenadas em
// porcentagem (0–100) de largura/altura do container — viewBox normalizado
// "0 0 100 100" + preserveAspectRatio="none" faz cada unidade da `d` casar
// 1:1 com `left`/`top` em "%" nas Views irmãs (cards, headline, avatares em
// welcome.tsx), então SVG e overlay RN compartilham o mesmo sistema de
// coordenadas sem precisar medir nada em pixels.

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Node { x: number; y: number; r: number; active?: boolean }

const FULL_STREETS = [
  'M 20 -4 C 26 14, 12 30, 22 46 C 30 60, 18 78, 24 104',
  'M -4 24 C 20 20, 48 28, 74 20 C 90 15, 100 13, 106 15',
  'M -4 70 C 22 64, 52 74, 78 62 C 92 56, 100 58, 106 54',
  'M 68 -4 C 60 14, 82 32, 70 50 C 60 66, 78 82, 72 104',
];
const FULL_STREETS_MINOR = [
  'M 4 -4 C 0 18, 26 40, 20 104',
  'M 84 4 C 92 14, 96 26, 100 24',
];
const FULL_BLOCKS: { x: number; y: number; w: number; h: number; rot: number; cx: number; cy: number }[] = [
  { x: 6, y: 34, w: 14, h: 20, rot: -10, cx: 13, cy: 44 },
  { x: 58, y: 5, w: 18, h: 12, rot: 8, cx: 67, cy: 11 },
  { x: 54, y: 70, w: 16, h: 22, rot: -6, cx: 62, cy: 81 },
];
const FULL_NODES: Node[] = [
  { x: 22, y: 28, r: 1.5 },
  { x: 46, y: 22, r: 1.3 },
  { x: 72, y: 18, r: 2.1, active: true },
  { x: 16, y: 52, r: 1.5 },
  { x: 84, y: 54, r: 1.7 },
  { x: 10, y: 80, r: 2.1, active: true },
  { x: 76, y: 86, r: 1.6 },
  { x: 48, y: 96, r: 1.3 },
];
const FULL_CONNECTORS = [
  'M 72 18 C 76 14, 80 12, 84 11',
  'M 76 86 C 78 88, 79 89, 80 90',
];
// Ruas principais que recebem o realce de percurso (índices em FULL_STREETS)
// — as 4, com atraso escalonado dentro de um mesmo ciclo (~8.8s) pra nunca
// mais de uma acender ao mesmo tempo. Esse escalonamento continua em
// AMBIENT_ENERGY (mesmo espaçamento de ~2.4s, ver NeighborhoodScape.tsx),
// completando um ciclo maior só depois que as 4 linhas de ambientação
// também entram — as duas listas dividem o mesmo orçamento de brilhos por
// minuto (ver ENERGY_PAUSE_MIN_SHARED).
const FULL_ENERGY = [
  { streetIndex: 0, delay: 300 },
  { streetIndex: 1, delay: 2500 },
  { streetIndex: 2, delay: 5000 },
  { streetIndex: 3, delay: 7400 },
];

const COMPACT_STREETS = [
  'M -4 20 C 20 8, 50 30, 74 12 C 88 4, 96 10, 104 6',
  'M -4 70 C 24 60, 54 80, 80 58 C 92 50, 100 54, 104 50',
  'M 30 -4 C 24 20, 40 40, 34 60 C 30 78, 42 90, 38 104',
];
const COMPACT_NODES: Node[] = [
  { x: 26, y: 26, r: 2.2 },
  { x: 58, y: 18, r: 3, active: true },
  { x: 14, y: 58, r: 2.2 },
  { x: 72, y: 44, r: 2.2 },
  { x: 44, y: 72, r: 2.6, active: true },
];
const COMPACT_ENERGY = [{ streetIndex: 2, delay: 600 }];

const LUMINOUS = '#4ADE80';
const LINE = 'rgba(255,255,255,0.13)';
const LINE_MINOR = 'rgba(255,255,255,0.07)';
const BLOCK = 'rgba(255,255,255,0.035)';
const NODE_PASSIVE = 'rgba(255,255,255,0.55)';

function Pulse({ x, y, r, delay, reducedMotion }: { x: number; y: number; r: number; delay: number; reducedMotion: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3400, easing: Easing.out(Easing.quad) }), -1, false));
    // Loop contínuo montado uma vez; parâmetros são estáveis por instância.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({
    r: r + t.value * (r * 2.4),
    opacity: reducedMotion ? 0 : 0.45 * (1 - t.value),
  }));

  return <AnimatedCircle cx={x} cy={y} fill="none" stroke={LUMINOUS} strokeWidth={0.5} animatedProps={animatedProps} />;
}

function Breathing({ x, y, r, color, delay, reducedMotion }: { x: number; y: number; r: number; color: string; delay: number; reducedMotion: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({
    opacity: reducedMotion ? 0.85 : 0.55 + t.value * 0.4,
  }));

  return <AnimatedCircle cx={x} cy={y} r={r} fill={color} animatedProps={animatedProps} />;
}

// "Percurso de energia": um trecho do próprio traço da rua fica levemente
// mais claro e desliza uma vez ao longo do caminho, some, pausa alguns
// segundos, repete — um aumento de claridade discreto, não um brilho/neon
// à parte. withRepeat sozinho não resolve isso (ele reinicia a sequência a
// partir do valor ATUAL, então uma pausa "parada" nunca voltaria ao
// início); por isso o ciclo é conduzido à mão via callback + runOnJS,
// resetando o offset antes de cada corrida. A pausa entre corridas varia
// aleatoriamente a cada ciclo pra não virar um metrônomo previsível.
const ENERGY_DASH = 26;
const ENERGY_TRAVEL = 170;
const ENERGY_PAUSE_MIN = 3200;
const ENERGY_PAUSE_RANGE = 6800;
// Ritmo "compartilhado": as 4 ruas principais (FULL_ENERGY) e as 4 linhas de
// ambientação (AMBIENT_ENERGY, ver AmbientBackdrop) disputam o mesmo
// orçamento de brilhos por minuto no desktop, já que aparecem juntas na
// mesma tela. Pausa maior que a do solo (ENERGY_PAUSE_MIN/RANGE, usada pelo
// compact do mobile, que não compartilha orçamento com ninguém) pra que
// dobrar de 4 pra 8 trechos elegíveis não dobre a frequência percebida de
// brilhos na tela.
const ENERGY_PAUSE_MIN_SHARED = 9500;
const ENERGY_PAUSE_RANGE_SHARED = 13400;

function EnergyFlow({
  d, delay, reducedMotion, pauseMin = ENERGY_PAUSE_MIN, pauseRange = ENERGY_PAUSE_RANGE,
}: { d: string; delay: number; reducedMotion: boolean; pauseMin?: number; pauseRange?: number }) {
  const offset = useSharedValue(ENERGY_DASH);

  useEffect(() => {
    if (reducedMotion) return;
    let active = true;
    const run = () => {
      if (!active) return;
      offset.value = ENERGY_DASH;
      const pause = pauseMin + Math.random() * pauseRange;
      offset.value = withDelay(
        pause,
        withTiming(-ENERGY_TRAVEL, { duration: 2600 + Math.random() * 900, easing: Easing.inOut(Easing.quad) }, (finished) => {
          if (finished) runOnJS(run)();
        }),
      );
    };
    const t = setTimeout(run, delay);
    return () => { active = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  if (reducedMotion) return null;

  return (
    <AnimatedPath
      d={d}
      stroke="rgba(255,255,255,0.5)"
      strokeWidth={0.45}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={`${ENERGY_DASH} ${ENERGY_TRAVEL + 30}`}
      animatedProps={animatedProps}
    />
  );
}

// Núcleo/marcador central — símbolo de localização minimalista e autoral:
// um anel fino com uma "cauda" curta (silhueta de pin sem virar um teardrop
// sólido/clipart) e um ponto luminoso no centro. Ver Pulse acima para os
// anéis de pulso que partem dele. A cauda gira em torno do centro do anel
// pra apontar na direção do mouse — `pointerDirX/Y` é um vetor (não um
// ângulo acumulado) calculado na MESMA malha percentual 0–100 do SVG, não
// em pixels de tela, pra que a direção saia correta mesmo com o
// preserveAspectRatio="none" esticando os eixos de forma desigual. O
// ângulo final só é derivado (via atan2) aqui, na hora de desenhar — ver
// comentário em welcome.tsx sobre por que vetor em vez de ângulo.
function LocationCore({
  x, y, r, reducedMotion, pointerDirX, pointerDirY,
}: {
  x: number; y: number; r: number; reducedMotion: boolean;
  pointerDirX: SharedValue<number>; pointerDirY: SharedValue<number>;
}) {
  // Um "pingente" estreito preso no ponto mais baixo do anel (não uma corda
  // larga cruzando o miolo dele) — evita a silhueta de "orelhas" que uma
  // curva mais larga produziria dentro do círculo oco. Desenhado apontando
  // pra baixo por padrão (rotation 0 = "para baixo").
  const tailStart = y + r * 0.96;
  const tailTip = y + r * 1.85;
  const tailHalf = r * 0.22;
  const tailPath = `M ${x - tailHalf} ${tailStart} Q ${x} ${tailStart + r * 0.2} ${x + tailHalf} ${tailStart} L ${x} ${tailTip} Z`;

  // Gira em torno do centro do marcador (x,y) via string SVG `rotate(deg cx
  // cy)` — o atalho rotation/originX/originY do react-native-svg dispara um
  // aviso de DOM inválido ("transform-origin") quando animado via
  // useAnimatedProps na web, então a rotação vai direto pela prop
  // `transform`, que é a forma universalmente suportada.
  const tailAnimatedProps = useAnimatedProps(() => {
    const deg = (Math.atan2(pointerDirY.value, pointerDirX.value) * 180) / Math.PI - 90;
    return { transform: `rotate(${deg} ${x} ${y})` };
  });

  return (
    <>
      <Circle cx={x} cy={y} r={r * 2.6} fill="rgba(255,255,255,0.05)" />
      <Circle cx={x} cy={y} r={r * 1.6} fill="rgba(255,255,255,0.08)" />
      <AnimatedPath d={tailPath} fill="rgba(255,255,255,0.88)" animatedProps={tailAnimatedProps} />
      <Circle cx={x} cy={y} r={r} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth={r * 0.17} />
      <Circle cx={x} cy={y} r={r * 0.4} fill={LUMINOUS} />
      <Pulse x={x} y={y} r={r} delay={0} reducedMotion={reducedMotion} />
      <Pulse x={x} y={y} r={r} delay={1700} reducedMotion={reducedMotion} />
    </>
  );
}

interface NeighborhoodScapeProps {
  variant: 'full' | 'compact';
  reducedMotion: boolean;
  // Vetor de direção (não ângulo) pra cauda do marcador — só existe (mouse)
  // na versão desktop; o compact do mobile usa um valor parado próprio.
  pointerDirX?: SharedValue<number>;
  pointerDirY?: SharedValue<number>;
}

export default function NeighborhoodScape({ variant, reducedMotion, pointerDirX, pointerDirY }: NeighborhoodScapeProps) {
  const staticDirX = useSharedValue(0);
  const staticDirY = useSharedValue(1);
  const dirX = pointerDirX ?? staticDirX;
  const dirY = pointerDirY ?? staticDirY;
  const streets = variant === 'full' ? FULL_STREETS : COMPACT_STREETS;
  const minorStreets = variant === 'full' ? FULL_STREETS_MINOR : [];
  const blocks = variant === 'full' ? FULL_BLOCKS : [];
  const nodes = variant === 'full' ? FULL_NODES : COMPACT_NODES;
  const connectors = variant === 'full' ? FULL_CONNECTORS : [];
  const energy = variant === 'full' ? FULL_ENERGY : COMPACT_ENERGY;
  const markerPos = variant === 'full' ? SCAPE_ANCHORS.marker : { x: 50, y: 42 };
  const markerR = variant === 'full' ? 3.6 : 2.7;

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {blocks.map((b, i) => (
        <Rect
          key={`block-${i}`}
          x={b.x} y={b.y} width={b.w} height={b.h} rx={3}
          fill={BLOCK}
          transform={`rotate(${b.rot} ${b.cx} ${b.cy})`}
        />
      ))}
      {minorStreets.map((d, i) => (
        <Path key={`minor-${i}`} d={d} stroke={LINE_MINOR} strokeWidth={0.35} strokeDasharray="1.4 1.6" fill="none" />
      ))}
      {streets.map((d, i) => (
        <Path key={`street-${i}`} d={d} stroke={LINE} strokeWidth={0.45} fill="none" />
      ))}
      {energy.map((e, i) => (
        <EnergyFlow
          key={`energy-${i}`}
          d={streets[e.streetIndex]}
          delay={e.delay}
          reducedMotion={reducedMotion}
          pauseMin={variant === 'full' ? ENERGY_PAUSE_MIN_SHARED : undefined}
          pauseRange={variant === 'full' ? ENERGY_PAUSE_RANGE_SHARED : undefined}
        />
      ))}
      {connectors.map((d, i) => (
        <Path key={`conn-${i}`} d={d} stroke="rgba(74,222,128,0.35)" strokeWidth={0.35} strokeDasharray="1 1.6" fill="none" />
      ))}
      {nodes.map((n, i) => (
        <Breathing
          key={`node-${i}`}
          x={n.x} y={n.y} r={n.r}
          color={n.active ? LUMINOUS : NODE_PASSIVE}
          delay={i * 260}
          reducedMotion={reducedMotion}
        />
      ))}
      {nodes.filter((n) => n.active).map((n, i) => (
        <Pulse key={`pulse-${i}`} x={n.x} y={n.y} r={n.r} delay={i * 900 + 400} reducedMotion={reducedMotion} />
      ))}
      <LocationCore x={markerPos.x} y={markerPos.y} r={markerR} reducedMotion={reducedMotion} pointerDirX={dirX} pointerDirY={dirY} />
    </Svg>
  );
}

// Âncoras (% de largura/altura do container, mesmo espaço de coordenadas do
// SVG acima) para posicionar headline/avatares/cards por cima da arte em
// welcome.tsx sem duplicar números mágicos nos dois lugares.
export const SCAPE_ANCHORS = {
  marker: { x: 50, y: 34 },
  headline: { x: 50, y: 47 },
  avatarCluster: { x: 50, y: 64 },
  cardA: { x: 78, y: 12 },
  cardB: { x: 9, y: 75 },
  cardC: { x: 74, y: 89 },
};

// ─── Pano de fundo ambiente ─────────────────────────────────────────────
// Continuação bem discreta do bairro por trás de TODA a tela (ver
// welcome.tsx) — sem isso, o mapa detalhado (só do lado direito) parecia
// terminar abruptamente onde o cartão de vidro flutuante deixa o fundo à
// mostra. Poucos traços/pontos, bem apagados, sem marcador nem interação:
// é só textura, pra passar a ideia de bairro vasto e contínuo, não um mapa
// funcional de verdade nessa camada.
const AMBIENT_STREETS = [
  'M -10 12 C 25 22, 65 4, 130 18',
  'M -10 52 C 30 42, 70 62, 130 48',
  'M -10 84 C 28 90, 62 76, 130 86',
  'M 8 -10 C 14 30, 4 70, 16 130',
];
const AMBIENT_DOTS = [
  { x: 6, y: 18 }, { x: 18, y: 58 }, { x: 11, y: 82 },
  { x: 32, y: 34 }, { x: 26, y: 72 }, { x: 4, y: 44 },
];
// Continuação do escalonamento de FULL_ENERGY (mesmo espaçamento de ~2.4s),
// só que preenchendo a segunda metade do ciclo compartilhado — ver
// ENERGY_PAUSE_MIN_SHARED pra por que essas 4 linhas dividem orçamento com
// as ruas principais em vez de ganhar um ritmo próprio.
const AMBIENT_ENERGY = [
  { streetIndex: 0, delay: 9800 },
  { streetIndex: 1, delay: 12200 },
  { streetIndex: 2, delay: 14600 },
  { streetIndex: 3, delay: 17000 },
];

export function AmbientBackdrop({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <Svg
      width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
      style={StyleSheet.absoluteFill} pointerEvents="none"
    >
      {AMBIENT_STREETS.map((d, i) => (
        <Path key={`amb-street-${i}`} d={d} stroke="rgba(255,255,255,0.07)" strokeWidth={0.35} fill="none" />
      ))}
      {AMBIENT_ENERGY.map((e, i) => (
        <EnergyFlow
          key={`amb-energy-${i}`}
          d={AMBIENT_STREETS[e.streetIndex]}
          delay={e.delay}
          reducedMotion={reducedMotion}
          pauseMin={ENERGY_PAUSE_MIN_SHARED}
          pauseRange={ENERGY_PAUSE_RANGE_SHARED}
        />
      ))}
      {AMBIENT_DOTS.map((p, i) => (
        <Circle key={`amb-dot-${i}`} cx={p.x} cy={p.y} r={1} fill="rgba(255,255,255,0.3)" />
      ))}
    </Svg>
  );
}
