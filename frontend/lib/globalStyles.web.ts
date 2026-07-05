// Estilos globais só-web para os campos de texto.
//
// Problema: o browser desenha um outline retangular (azul/preto) ao focar
// inputs/textarea, que destoa do visual arredondado do app. Aqui removemos
// esse outline e, no lugar, damos um contorno verde elegante ao focar.
//
// O realce é feito só com `border-color` (nada de box-shadow). Isso é
// auto-limitante: a cor só fica visível onde já existe uma borda. Assim
// acertamos a caixa certa nos dois padrões de campo do app, sem vazar para o
// container:
//   - input transparente dentro de um wrapper com borda (auth, "Local",
//     preço, busca) → a borda verde vai no wrapper via `:focus-within`;
//   - input que é a própria caixa com borda (Título, Mensagem, Nome do local,
//     Horário) → a borda verde vai no input via `:focus`.
// O `View` de seção sem borda recebe a regra mas, sem `border-width`, nada
// aparece — então o contorno nunca envolve o campo inteiro.

if (typeof document !== 'undefined') {
  const STYLE_ID = 'daqui-input-focus-styles';
  if (!document.getElementById(STYLE_ID)) {
    const green = '#22C55E';
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      input, textarea, select, [contenteditable="true"] {
        outline: none !important;
        outline-offset: 0 !important;
        -webkit-tap-highlight-color: transparent;
      }
      input, textarea,
      div:has(> input), div:has(> textarea) {
        transition: border-color .15s ease;
      }
      input:focus, textarea:focus,
      div:has(> input):focus-within, div:has(> textarea):focus-within {
        border-color: ${green} !important;
      }

      /* Scrollbar fino e discreto no lugar do padrão do navegador (Chrome/Safari/Edge). */
      *::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      *::-webkit-scrollbar-track {
        background: transparent;
      }
      *::-webkit-scrollbar-thumb {
        background-color: rgba(100, 116, 139, 0.35);
        border-radius: 999px;
      }
      *::-webkit-scrollbar-thumb:hover {
        background-color: rgba(34, 197, 94, 0.55);
      }

      /* Firefox */
      * {
        scrollbar-width: thin;
        scrollbar-color: rgba(100, 116, 139, 0.35) transparent;
      }

      /* Hover para tudo que é clicável (TouchableOpacity/Pressable ganham
         tabindex="0" automaticamente no RNW; elementos desabilitados viram
         tabindex="-1", então já ficam de fora). Só em dispositivos com mouse
         de verdade, pra não deixar hover "grudado" em telas de toque.
         Usa box-shadow inset (não background-color) pra dar um realce visível
         sem apagar a cor de fundo própria do elemento (botão verde, chip
         colorido etc.) — o shadow soma por cima, respeitando o border-radius
         de cada um. Um mero opacity dim sozinho é sutil demais em ícones
         pequenos (like/comentário/compartilhar), por isso o reforço. */
      @media (hover: hover) and (pointer: fine) {
        div[tabindex="0"] {
          transition: box-shadow .15s ease, opacity .15s ease;
        }
        div[tabindex="0"]:hover {
          box-shadow: inset 0 0 0 999px rgba(120, 130, 145, 0.16);
        }
        div[tabindex="0"]:active {
          box-shadow: inset 0 0 0 999px rgba(120, 130, 145, 0.26);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

export {};
