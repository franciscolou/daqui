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
    `;
    document.head.appendChild(style);
  }
}

export {};
