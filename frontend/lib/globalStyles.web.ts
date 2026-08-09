import { DESKTOP_BREAKPOINT } from '../constants/config';

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

      /* Scrollbar fino e discreto no lugar do padrão do navegador (Chrome/Safari/Edge),
         só no desktop (mesmo DESKTOP_BREAKPOINT de constants/config.ts). No mobile web
         mantém o scrollbar nativo do sistema (que já é overlay/discreto por padrão).
         Só aparece quando o conteúdo realmente estoura o container — isso é o
         comportamento padrão do browser com overflow:auto, nenhuma regra extra precisa
         disso. Fino sempre (largura fixa nos dois estados) — "enrijece" (fica mais
         visível) quando o mouse se aproxima só por cor/opacidade do thumb, nunca por
         tamanho. Sem transition em lugar nenhum aqui de propósito, mesmo na cor: é
         limitação real do motor, não falta de tentativa — scrollbars são renderizados
         como "anonymous content"/shadow DOM interno do browser, que nunca passou a
         suportar transition/animação (WebKit bug 104412, aberto desde 2013, sem
         correção; confirmado também pro Chromium na discussão do CSSWG sobre
         scrollbar hover colors, github.com/w3c/csswg-drafts/issues/10591 — "there is
         no way to address this issue in chromium browsers with css"). Declarar
         transition no thumb não quebra nada, só não faz nada — por isso nem declaramos.
         A troca de cor no hover é instantânea por design, é o mesmo comportamento de
         qualquer site com scrollbar customizado hoje. O hover é no container inteiro
         — não é preciso acertar o cabelo fino do thumb.

         !important em 'display'/'scrollbar-width': quase todo ScrollView do app passa
         showsVerticalScrollIndicator={false} (pensado pro visual mobile, sem indicador
         nenhum) — o react-native-web compila isso pra uma regra por-classe
         '.rXXXX::-webkit-scrollbar{display:none}' (+ 'scrollbar-width:none'), com
         especificidade maior que '*::-webkit-scrollbar'. Sem o !important aqui, essa
         regra global nunca apareceria de verdade em nenhuma tela — é exatamente o
         showsVerticalScrollIndicator={false} que esconde tudo hoje.

         @supports selector(::-webkit-scrollbar) separa Chrome/Safari/Edge de Firefox
         de propósito — não é só sobre ONDE cada sintaxe funciona, é sobre EVITAR QUE
         AS DUAS COMPITAM no mesmo navegador. Desde a v121 o Chrome também implementa a
         property padrão scrollbar-width (que antes era só do Firefox); se a gente fixa
         'scrollbar-width: thin' pra tudo, o Chrome passa a desenhar o scrollbar "thin"
         NATIVO do próprio SO — que ignora completamente as cores/bordas dos pseudo-
         elementos ::-webkit-scrollbar-* abaixo e não tem opção de espessura em px nem
         de engrossar no hover. Foi exatamente isso que deixou a barra grossa, com
         setas, e sem reação ao mouse num teste real (o Chromium headless usado antes
         pra verificar computa scrollbar-width certinho mas não pinta o resultado,
         então esse conflito passou despercebido). Por isso: no ramo com suporte a
         ::-webkit-scrollbar, cancela o 'none' do react-native-web com 'auto' (deixa o
         Chrome fora do modo nativo "thin") e controla espessura/cor só via pixel; só
         no ramo SEM suporte (Firefox) usa scrollbar-width, que ali é o único jeito. */
      @media (min-width: ${DESKTOP_BREAKPOINT}px) {
        @supports selector(::-webkit-scrollbar) {
          * {
            scrollbar-width: auto !important;
          }
          *::-webkit-scrollbar {
            display: block !important;
            width: 4px;
            height: 4px;
          }
          *::-webkit-scrollbar-button {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          *::-webkit-scrollbar-track {
            background: transparent;
          }
          *::-webkit-scrollbar-corner {
            background: transparent;
          }
          *::-webkit-scrollbar-thumb {
            background-color: rgba(100, 116, 139, 0.16);
            border-radius: 999px;
            border: none;
          }
          *:hover::-webkit-scrollbar-thumb {
            background-color: rgba(100, 116, 139, 0.45);
          }
          *::-webkit-scrollbar-thumb:hover {
            background-color: rgba(34, 197, 94, 0.55);
          }
        }

        /* Firefox: sem controle de espessura por hover (scrollbar-width só aceita
           thin/auto/none), fica fino sempre — já é bem mais discreto que o padrão. */
        @supports not selector(::-webkit-scrollbar) {
          * {
            scrollbar-width: thin !important;
            scrollbar-color: rgba(100, 116, 139, 0.2) transparent;
          }
        }
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

        /* O calendário de segmentação já comunica todos os estados por cor.
           Remove inclusive o hover do overlay externo, que clarearia a box
           inteira por causa da regra global acima. */
        #ad-calendar-no-hover::after,
        #ad-calendar-no-hover div[tabindex="0"]::after {
          display: none !important;
        }

        /* A checkbox do aviso de link externo mantém foco e clique, mas o
           próprio check já comunica seu estado sem o realce global. */
        #external-link-checkbox-no-hover::after {
          display: none !important;
        }

        /* Fotos e vídeos enviados em DMs/grupos já comunicam o clique pelo
           próprio conteúdo e não devem receber a película global de hover. */
        [id^="chat-media-no-hover-"]::after {
          display: none !important;
        }

        /* O botão que abre/fecha o seletor de membros do grupo não recebe a
           película global; os botões individuais de adicionar continuam com hover. */
        #group-add-members-toggle-no-hover::after {
          display: none !important;
        }

      }
    `;
    document.head.appendChild(style);
  }
}

export {};
