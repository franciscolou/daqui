/**
 * Fonte-marca (wordmark) do Daqui.
 *
 * COMO TESTAR: troque SOMENTE a constante `SELECTED` abaixo por uma das chaves
 * e recarregue a web. As 5 fontes candidatas são carregadas em runtime logo
 * abaixo (o SPA do Expo ignora `app/+html.tsx`, então injetamos via JS).
 *
 * MODO PREVIEW: enquanto escolhemos a fonte, ela é aplicada como fonte padrão
 * de TODO `<Text>` do app (ver patch no fim do arquivo), para você ver como
 * ficaria no sistema inteiro — não só no wordmark. Quando você decidir, me
 * avise a escolhida que eu removo as outras, tiro o patch global e deixo a
 * fonte só onde fizer sentido.
 *
 * As opções (pensadas para um app de bairro — acolhedor, comunitário, brasileiro):
 *  - poppins   → geométrica, moderna e limpa. Aposta segura.
 *  - baloo     → arredondada e "gordinha", bem cara de logo, brincalhona e calorosa.
 *  - nunito    → humanista arredondada, amigável e muito legível.
 *  - fraunces  → serifada com personalidade, dá um ar editorial/icônico.
 *  - bricolage → grotesca contemporânea, com caráter e um toque "design atual".
 */
import { Text as RNText } from 'react-native';

export type BrandFontKey = 'poppins' | 'baloo' | 'nunito' | 'fraunces' | 'bricolage';

// 👇 TROQUE AQUI para pré-visualizar cada fonte
const SELECTED: BrandFontKey = 'bricolage';

const FAMILIES: Record<BrandFontKey, string> = {
  poppins: '"Poppins", system-ui, sans-serif',
  baloo: '"Baloo 2", system-ui, sans-serif',
  nunito: '"Nunito", system-ui, sans-serif',
  fraunces: '"Fraunces", Georgia, serif',
  bricolage: '"Bricolage Grotesque", system-ui, sans-serif',
};

/** fontFamily pronto para usar em styles do wordmark. */
export const BRAND_FONT = FAMILIES[SELECTED];

// ── Carregamento das fontes na web ─────────────────────────────────────────
// `document` só existe na web; no nativo (RN) isto é ignorado.
const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Baloo+2:wght@600;700;800&family=Nunito:wght@600;700;800;900&family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&display=swap';

if (typeof document !== 'undefined' && !document.getElementById('daqui-brand-fonts')) {
  const link = document.createElement('link');
  link.id = 'daqui-brand-fonts';
  link.rel = 'stylesheet';
  link.href = GOOGLE_FONTS_HREF;
  document.head.appendChild(link);
}

// ── Preview global: BRAND_FONT como fonte padrão de todo <Text> ─────────────
// Injetamos BRAND_FONT nas PROPS DE ENTRADA do render (como base do array de
// estilo) e deixamos o render original resolver. É o caminho normal de
// `<Text style={[...]}>`, então nada de array vaza pro DOM — diferente de
// clonar o elemento de saída (que na web já é DOM e quebra o CSSStyleDeclaration).
// O estilo próprio de cada Text vem DEPOIS do nosso base, então quem define a
// própria fonte (ícones do Ionicons etc.) vence e continua intacto.
//
// Guardamos o render ORIGINAL uma vez (__brandOrigRender) e sempre reinstalamos
// um wrapper novo a partir dele. Isso sobrevive ao Fast Refresh sem (a) empilhar
// wrappers nem (b) ficar preso num patch antigo/quebrado.
type TextProps = { style?: unknown } & Record<string, unknown>;
type TextInternal = {
  render?: (props: TextProps, ref: unknown) => unknown;
  __brandOrigRender?: (props: TextProps, ref: unknown) => unknown;
};
const TextAny = RNText as unknown as TextInternal;
if (typeof TextAny.render === 'function') {
  if (!TextAny.__brandOrigRender) TextAny.__brandOrigRender = TextAny.render;
  const originalRender = TextAny.__brandOrigRender!;
  TextAny.render = function (this: unknown, props: TextProps, ref: unknown) {
    const style = [{ fontFamily: BRAND_FONT }, props?.style];
    return originalRender.call(this, { ...props, style }, ref);
  };
}
