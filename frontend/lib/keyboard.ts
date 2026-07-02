import { Platform } from 'react-native';

// Handler de teclado para concluir ações com Enter na web.
// Enter dispara `handler`; Shift+Enter continua inserindo quebra de linha
// (útil em inputs multiline como comentário/mensagem). No nativo o envio
// continua sendo pelo botão / `onSubmitEditing`, então devolvemos undefined.
//
// O RN Web repassa o próprio evento sintético do React para `onKeyPress`,
// então lemos a tecla tanto do evento quanto do `nativeEvent` (DOM) por
// robustez.
export function submitOnEnter(handler: () => void) {
  if (Platform.OS !== 'web') return undefined;
  return (e: any) => {
    const key = e?.key ?? e?.nativeEvent?.key;
    const shift = e?.shiftKey ?? e?.nativeEvent?.shiftKey;
    if (key === 'Enter' && !shift) {
      e?.preventDefault?.();
      handler();
    }
  };
}
