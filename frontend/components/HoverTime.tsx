import { useState, type ComponentType } from 'react';
import { View, Text, StyleSheet, Platform, TextStyle, ViewProps } from 'react-native';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { formatHoverTime, formatPostTime } from '../lib/time';

interface Props {
  iso: string;
  style?: TextStyle | TextStyle[];
}

// react-native-web repassa onMouseEnter/onMouseLeave pro elemento, mas os
// tipos de View (focados no nativo) não os declaram — só a view, não Pressable
// (que ganharia tabindex="0" e o tint de hover global, ver globalStyles.web.ts).
type WebViewProps = ViewProps & { onMouseEnter?: () => void; onMouseLeave?: () => void };
const HoverableView = View as unknown as ComponentType<WebViewProps>;

// Contagem compacta de tempo (post/comentário/feed) que, no hover (web), mostra
// o horário exato num tooltip — "29 Jan 2026, 23:59" (dia anterior) ou "23:59"
// (mesmo dia). Sem hover no nativo (touch não tem esse conceito): só o texto.
export default function HoverTime({ iso, style }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [hovered, setHovered] = useState(false);

  if (Platform.OS !== 'web') {
    return <Text style={style}>{formatPostTime(iso)}</Text>;
  }

  return (
    <HoverableView
      style={styles.wrapper}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Text style={style}>{formatPostTime(iso)}</Text>
      {hovered && (
        <View style={styles.tooltip} pointerEvents="none">
          <Text style={styles.tooltipText}>{formatHoverTime(iso)}</Text>
        </View>
      )}
    </HoverableView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  wrapper: { position: 'relative' },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: 6,
    backgroundColor: Colors.text,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 50,
    ...Colors.shadow.md,
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.surface,
    whiteSpace: 'nowrap',
  } as any,
});
