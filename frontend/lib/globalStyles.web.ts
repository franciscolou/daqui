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

      /* input[type=password]: o Chrome/Edge pintam o campo de branco (cor de
         sistema, ignora o tema claro/escuro do app) assim que ele reconhece o
         campo como preenchível/sugerível — não é possível sobrescrever o fundo
         nativo do autofill diretamente, então o truque padrão é "congelar" a
         transição de cor por um tempo enorme, o que na prática cancela o
         efeito, e forçar a cor do texto a acompanhar a cor herdada do app. */
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-text-fill-color: currentColor !important;
        caret-color: currentColor;
        transition: background-color 600000s ease-in-out 0s, color 600000s ease-in-out 0s !important;
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
         Usa um pseudo-elemento ::after por cima de tudo (não box-shadow no
         próprio elemento nem filter): box-shadow inset pinta atrás dos
         filhos, então um filho com fundo opaco (chip de ícone, avatar de
         grupo sem foto) "furava" o realce; e filter sozinho não pinta nada
         visível em cima de um elemento sem fundo próprio (a maioria das
         linhas de lista, que são transparentes). ::after resolve os dois:
         desenha uma camada translúcida por cima de tudo, sempre visível,
         indo com border-radius: inherit — ou seja, acompanha o arredondado
         que o PRÓPRIO elemento já declarar.
         IMPORTANTE ao criar um novo botão/chip pequeno e "solto" (não uma
         linha de lista full-width, que fica ok quadrada): declare um
         borderRadius nele mesmo (no TouchableOpacity/Pressable que recebe o
         onPress, não só num filho interno) — senão o hover sai com canto
         reto mesmo o elemento "parecendo" arredondado visualmente.
         A cor vem de --hover-tint/--hover-tint-active (setadas em
         lib/theme.tsx a partir de Colors.text do tema ativo) em vez de um
         cinza fixo: um cinza neutro igual nos dois temas escurece bem no
         claro mas fica um retângulo baço e destoante no escuro (a paleta
         escura é toda em tom de azul-marinho); usando a própria cor de texto
         em baixa opacidade, o tom sai certo e ainda inverte a direção
         sozinho — escurece no claro, clareia no escuro. */
      div[tabindex="0"] {
        position: relative;
      }
      div[tabindex="0"]::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background-color: transparent;
      }
      @media (hover: hover) and (pointer: fine) {
        div[tabindex="0"]::after {
          transition: background-color .15s ease;
        }
        div[tabindex="0"]:hover::after {
          background-color: var(--hover-tint, rgba(120, 130, 145, 0.16));
        }
        div[tabindex="0"]:active::after {
          background-color: var(--hover-tint-active, rgba(120, 130, 145, 0.26));
        }
      }
    `;
    document.head.appendChild(style);
  }
}

export {};
