import { Text, StyleProp, TextStyle } from 'react-native';
import glyphMap from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json';
import ioniconsFont from '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf?url';

// Substituto de `@expo/vector-icons` para este painel (ver o alias no
// vite.config.ts). O pacote original passa por expo-font/expo-modules-core,
// que só funcionam dentro do runtime do Expo — aqui é um app Vite comum.
//
// Os componentes de local do Daqui usam só Ionicons, e a fonte + o mapa de
// glifos vêm do MESMO pacote, então os ícones são idênticos aos do app.

const FAMILY = 'daqui-ionicons';
const STYLE_ID = 'daqui-ionicons-face';

if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent =
    `@font-face{font-family:"${FAMILY}";src:url("${ioniconsFont}") format("truetype");font-display:block;}`;
  document.head.appendChild(style);
}

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Ionicons({ name, size = 24, color, style }: IconProps) {
  const code = (glyphMap as Record<string, number>)[name];
  return (
    <Text
      selectable={false}
      style={[
        { fontFamily: FAMILY, fontSize: size, lineHeight: size, color, userSelect: 'none' } as TextStyle,
        style,
      ]}
    >
      {code ? String.fromCodePoint(code) : ''}
    </Text>
  );
}

export default { Ionicons };
