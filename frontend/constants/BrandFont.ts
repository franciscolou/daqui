/**
 * Fonte-marca (wordmark) do Daqui: Bricolage Grotesque — grotesca
 * contemporânea, com caráter e um toque "design atual" (escolhida entre 5
 * candidatas testadas para um app de bairro acolhedor/comunitário).
 *
 * MODO PREVIEW: aplicada como fonte padrão de TODO `<Text>` do app (ver patch
 * no fim do arquivo), não só no wordmark.
 */
import { Text as RNText } from 'react-native';

/** fontFamily pronto para usar em styles do wordmark. */
export const BRAND_FONT = '"Bricolage Grotesque", system-ui, sans-serif';

// ── Carregamento da fonte na web ────────────────────────────────────────────
// `document` só existe na web; no nativo (RN) isto é ignorado.
// Inclui o peso 400 (regular) — sem ele, o navegador substitui qualquer
// <Text> sem fontWeight explícito (ou seja, a maioria do corpo de texto do
// app) pela face mais pesada disponível (600+), deixando tudo com aparência
// de negrito mesmo onde o CSS não pede isso.
const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap';

if (typeof document !== 'undefined') {
  let link = document.getElementById('daqui-brand-fonts') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = 'daqui-brand-fonts';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  // Atualiza o href mesmo se a tag já existir — sem isso, o Fast Refresh nunca
  // pega mudanças nos pesos carregados (a tag persiste no DOM entre reloads
  // do módulo, então só criar-se-não-existir deixava presos nos pesos antigos).
  if (link.href !== GOOGLE_FONTS_HREF) link.href = GOOGLE_FONTS_HREF;
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
