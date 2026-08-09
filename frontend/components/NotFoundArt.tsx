import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle, ClipPath, Defs, Ellipse, G, Path, Rect, Text as SvgText,
} from 'react-native-svg';
import { Palette } from '../constants/Colors';
import { BRAND_FONT } from '../constants/BrandFont';

// Ilustração estática (sem animação, de propósito) da tela "não encontrado":
// uma pessoa de costas, parada num beco sem saída fechado por um muro de
// tijolos, coçando a cabeça. Pose simétrica e reta de propósito (sem giro
// artificial de corpo) — cada parte é uma forma geométrica simples
// (círculo, retângulo arredondado) presa num ponto exato da anterior, então
// a anatomia fecha sem precisar de curva desenhada à mão livre. A única
// assimetria de verdade é o braço erguido coçando a cabeça.

const WALL_X = 120;
const WALL_Y = 70;
const WALL_W = 120;
const WALL_H = 110;
const BRICK_ROWS = 6;
const BRICK_H = WALL_H / BRICK_ROWS;
const BRICK_W = 30;

const BACK_WALL_BRICKS = (() => {
  const bricks: { x: number; y: number }[] = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    const y = WALL_Y + r * BRICK_H;
    const offset = r % 2 === 0 ? 0 : -BRICK_W / 2;
    for (let x = WALL_X + offset - BRICK_W; x < WALL_X + WALL_W + BRICK_W; x += BRICK_W) {
      bricks.push({ x, y });
    }
  }
  return bricks;
})();

// Linhas de fiada convergindo em perspectiva pras paredes laterais do
// beco — sugerem tijolo sem precisar desenhar uma grade inteira deformada.
const SIDE_ROW_FRACTIONS = [0.15, 0.35, 0.55, 0.75, 0.92];
function sideWallRow(f: number, side: 'left' | 'right') {
  const nearY = 15 + f * (270 - 15);
  const backY = WALL_Y + f * WALL_H;
  const nearX = side === 'left' ? 15 : 345;
  const backX = side === 'left' ? WALL_X : WALL_X + WALL_W;
  return `M ${nearX} ${nearY} L ${backX} ${backY}`;
}

const SKIN = '#D9A574';
const HAIR = '#3B2F2F';
const HAIR_LIGHT = '#6B5744';
const JACKET_SHADE = '#DC5C0E';
const PANTS = '#334155';
const PANTS_LIGHT = '#475569';
const SHOE_SOLE = '#0F172A';

// Cabelo: um arco só por cima do círculo da cabeça (raio um pouco maior,
// mesmo centro), como uma "touca" — deriva as pontas por trigonometria em
// vez de coordenadas "no olho", pra sair sempre alinhado ao círculo.
const HEAD_CX = 184;
const HEAD_CY = 138;
const HEAD_R = 22;
function hairlineArc() {
  const r = HEAD_R + 3;
  const a1 = (-165 * Math.PI) / 180;
  const a2 = (-15 * Math.PI) / 180;
  const x1 = HEAD_CX + r * Math.cos(a1);
  const y1 = HEAD_CY + r * Math.sin(a1);
  const x2 = HEAD_CX + r * Math.cos(a2);
  const y2 = HEAD_CY + r * Math.sin(a2);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

// Abre espaço acima da cena pro "404" — tudo (muro, paredes do beco, chão,
// pessoa) desce esse tanto dentro de um único <G>, sem precisar recalcular
// nenhuma coordenada.
const SCENE_SHIFT = 70;

// Mão: palma (círculo) + três dedos curtos abrindo em leque a partir do
// mesmo centro — desenhada na origem (0,0) pra encaixar num simples
// translate no fim de cada braço, sem precisar recalcular a posição.
function Hand({ ink }: { ink: string }) {
  return (
    <G>
      <Circle cx={0} cy={0} r={5.5} fill={SKIN} stroke={ink} strokeWidth={1.4} />
      <Rect x={-1.2} y={-1} width={2.4} height={7.5} rx={1.2} fill={SKIN} stroke={ink} strokeWidth={1} transform="rotate(-20)" />
      <Rect x={-1.2} y={-1} width={2.4} height={8} rx={1.2} fill={SKIN} stroke={ink} strokeWidth={1} />
      <Rect x={-1.2} y={-1} width={2.4} height={7.5} rx={1.2} fill={SKIN} stroke={ink} strokeWidth={1} transform="rotate(20)" />
    </G>
  );
}

export default function NotFoundArt({ Colors }: { Colors: Palette }) {
  const ink = Colors.text;

  return (
    <View style={styles.canvas} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={`0 0 360 ${300 + SCENE_SHIFT}`}>
        <Defs>
          <ClipPath id="nfWallClip">
            <Rect x={WALL_X} y={WALL_Y} width={WALL_W} height={WALL_H} />
          </ClipPath>
        </Defs>

        <G transform={`translate(0, ${SCENE_SHIFT})`}>
          {/* Luz ambiente, bem discreta */}
          <Ellipse cx={182} cy={150} rx={175} ry={130} fill={Colors.primaryFaint} opacity={0.35} />

          {/* Chão do beco */}
          <Path d="M 15 270 L 345 270 L 240 180 L 120 180 Z" fill="none" stroke={ink} strokeWidth={1.2} opacity={0.3} />
          <Path d="M 180 270 L 180 180" stroke={ink} strokeWidth={1} opacity={0.22} />

          {/* Paredes laterais, em perspectiva, com fiadas de tijolo sugeridas */}
          <Path d="M 15 15 L 15 270 L 120 180 L 120 70 Z" fill="none" stroke={ink} strokeWidth={1.4} opacity={0.4} />
          <Path d="M 345 15 L 345 270 L 240 180 L 240 70 Z" fill="none" stroke={ink} strokeWidth={1.4} opacity={0.4} />
          {SIDE_ROW_FRACTIONS.map((f, i) => (
            <Path key={`l${i}`} d={sideWallRow(f, 'left')} stroke={ink} strokeWidth={1} opacity={0.22} />
          ))}
          {SIDE_ROW_FRACTIONS.map((f, i) => (
            <Path key={`r${i}`} d={sideWallRow(f, 'right')} stroke={ink} strokeWidth={1} opacity={0.22} />
          ))}

          {/* Muro de tijolos no fim do beco — só contorno, sem cor */}
          <Rect x={WALL_X} y={WALL_Y} width={WALL_W} height={WALL_H} fill="none" stroke={ink} strokeWidth={1.6} opacity={0.55} />
          <G clipPath="url(#nfWallClip)">
            {BACK_WALL_BRICKS.map((b, i) => (
              <Rect key={i} x={b.x} y={b.y} width={BRICK_W} height={BRICK_H} fill="none" stroke={ink} strokeWidth={1} opacity={0.4} />
            ))}
          </G>

          {/* Lâmpada pendurada no muro */}
          <Ellipse cx={180} cy={68} rx={13} ry={13} fill={Colors.warning} opacity={0.18} />
          <Path d="M 180 55 L 180 64" stroke={ink} strokeWidth={1.2} opacity={0.5} />
          <Ellipse cx={180} cy={68} rx={5} ry={5} fill="none" stroke={ink} strokeWidth={1.3} opacity={0.6} />

          {/* Sombra da pessoa */}
          <Ellipse cx={181} cy={247} rx={26} ry={6} fill={ink} opacity={0.12} />

          {/* Pessoa de costas, coçando a cabeça — cada parte é uma forma
              geométrica simples presa num ponto exato da vizinha (ombro,
              cotovelo, gola), sem silhueta curva desenhada à mão livre. */}
          <G>
            {/* pernas, simétricas, retas */}
            <Rect x={170} y={206} width={12} height={38} rx={6} fill={PANTS} stroke={ink} strokeWidth={1.6} />
            <Rect x={166} y={240} width={16} height={6} rx={3} fill={PANTS_LIGHT} stroke={ink} strokeWidth={1.4} />
            <Rect x={164} y={244} width={18} height={6} rx={3} fill={SHOE_SOLE} stroke={ink} strokeWidth={1.4} />

            <Rect x={186} y={206} width={12} height={38} rx={6} fill={PANTS} stroke={ink} strokeWidth={1.6} />
            <Rect x={186} y={240} width={16} height={6} rx={3} fill={PANTS_LIGHT} stroke={ink} strokeWidth={1.4} />
            <Rect x={186} y={244} width={18} height={6} rx={3} fill={SHOE_SOLE} stroke={ink} strokeWidth={1.4} />

            {/* tronco / jaqueta, reto e centrado — só a base e uma sombra
                de dobra, sem mais nada em cima pra não virar "rabisco" */}
            <Rect x={161} y={158} width={46} height={54} rx={17} fill={Colors.accent} stroke={ink} strokeWidth={1.7} />
            <Rect x={184} y={158} width={23} height={54} rx={17} fill={JACKET_SHADE} opacity={0.45} />

            {/* pescoço */}
            <Rect x={HEAD_CX - 7} y={150} width={14} height={10} fill={SKIN} stroke={ink} strokeWidth={1.6} />

            {/* cabeça: círculo preenchido de cabelo (é a nuca — de costas,
                só cabelo aparece) + mecha clara por cima pra dar volume —
                desenhada ANTES dos braços, pra mão coçando a cabeça ficar
                por cima do cabelo (não escondida atrás) */}
            <Circle cx={HEAD_CX} cy={HEAD_CY} r={HEAD_R} fill={HAIR} stroke={ink} strokeWidth={1.7} />
            <Path d={hairlineArc()} stroke={HAIR_LIGHT} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.75} />

            {/* braço relaxado, ao longo do corpo, preso no ombro esquerdo */}
            <G transform="translate(161,166) rotate(-4)">
              <Rect x={-6} y={0} width={12} height={36} rx={6} fill={Colors.accent} stroke={ink} strokeWidth={1.6} />
              <Rect x={-6} y={26} width={12} height={6} rx={3} fill={JACKET_SHADE} opacity={0.55} />
              <G transform="translate(0,39)">
                <Hand ink={ink} />
              </G>
            </G>

            {/* braço direito erguido, cotovelo pra fora, mão coçando a
                cabeça — dois segmentos presos um no outro (ombro→cotovelo,
                cotovelo→mão), cada rotação pequena e relativa à anterior */}
            <G transform="translate(206,166) rotate(-120)">
              <Rect x={-6} y={0} width={12} height={24} rx={6} fill={Colors.accent} stroke={ink} strokeWidth={1.6} />
              <G transform="translate(0,24) rotate(-125)">
                <Rect x={-5.5} y={0} width={11} height={27} rx={5.5} fill={Colors.accent} stroke={ink} strokeWidth={1.6} />
                <G transform="translate(0,30)">
                  <Hand ink={ink} />
                </G>
              </G>
            </G>
          </G>

          {/* interrogação flutuante, do lado oposto ao braço erguido */}
          <SvgText x={148} y={112} fontSize={28} fontWeight="800" fill={Colors.indigo} transform="rotate(8 148 112)">
            ?
          </SvgText>
        </G>

        {/* "404" bem grande, na frente da cena inteira (não mais atrás do
            muro) */}
        <SvgText
          x={180}
          y={138}
          fontSize={150}
          fontWeight="800"
          fontFamily={BRAND_FONT}
          textAnchor="middle"
          fill={Colors.primary}
        >
          404
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: '100%', aspectRatio: 360 / (300 + SCENE_SHIFT) },
});
