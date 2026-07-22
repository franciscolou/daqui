import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { api, MuteDuration, MuteStatus } from '../lib/api';
import { formatExactDateTime } from '../lib/time';
import { useRealtime } from '../lib/realtime';
import MuteMenu from './MuteMenu';

// Linha de configuração "Notificações" — usada nas telas de informações da
// conversa (DM) e do grupo. Mostra o estado atual (Ativadas / Silenciadas até
// X) e abre o MuteMenu pra trocar entre as opções. Dono do fetch/estado do
// silenciamento: os dois pais só passam `kind`/`id` (+ um valor inicial
// quando já tiverem, como o grupo, que já vem no GroupDetail).
interface NotificationMuteRowProps {
  kind: 'dm' | 'group';
  id: string;
  initialStatus?: MuteStatus;
  // Avisa o pai quando o estado muda (ex.: refletir no ícone da lista de conversas).
  onChange?: (status: MuteStatus) => void;
}

function statusLabel(status: MuteStatus | null): string {
  if (!status) return '…';
  if (!status.isMuted) return 'Ativadas';
  if (!status.mutedUntil) return 'Silenciadas até reativar';
  return `Silenciadas até ${formatExactDateTime(status.mutedUntil)}`;
}

export default function NotificationMuteRow({ kind, id, initialStatus, onChange }: NotificationMuteRowProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { refreshUnreadCounts } = useRealtime();
  const [status, setStatus] = useState<MuteStatus | null>(initialStatus ?? null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (initialStatus) { setStatus(initialStatus); return; }
    if (kind === 'dm') api.getDmMuteStatus(id).then(setStatus).catch(() => {});
  }, [kind, id, initialStatus]);

  const applyStatus = (s: MuteStatus) => {
    setStatus(s);
    onChange?.(s);
    // Sem esperar o próximo tick do websocket (~2s) pro selo global sumir/voltar.
    refreshUnreadCounts();
  };

  const handleMute = async (duration: MuteDuration) => {
    const s = kind === 'dm' ? await api.muteDm(id, duration) : await api.muteGroup(id, duration);
    applyStatus(s);
  };

  const handleUnmute = async () => {
    const s = kind === 'dm' ? await api.unmuteDm(id) : await api.unmuteGroup(id);
    applyStatus(s);
  };

  return (
    <>
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => setMenuOpen(true)}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={status?.isMuted ? 'notifications-off-outline' : 'notifications-outline'}
            size={18}
            color={Colors.primary}
          />
        </View>
        <Text style={styles.label}>Notificações</Text>
        <Text style={styles.value} numberOfLines={1}>{statusLabel(status)}</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>

      <MuteMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        status={status ?? { isMuted: false }}
        subject={kind === 'group' ? 'grupo' : 'conversa'}
        onMute={handleMute}
        onUnmute={handleUnmute}
      />
    </>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFaint,
  },
  label: { fontSize: 15, fontWeight: '600', color: Colors.text },
  value: { flex: 1, fontSize: 13, color: Colors.textTertiary, fontWeight: '600', textAlign: 'right' },
});
