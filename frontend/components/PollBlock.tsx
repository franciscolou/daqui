import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Palette } from '../constants/Colors';
import { Poll } from '../data/mock';
import { api } from '../lib/api';
import { useTheme, useThemedStyles } from '../lib/theme';

// "Encerra 12/07 às 18:00" / "Encerrada" — prazo exato da enquete.
function formatCloses(iso: string, closed: boolean): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return closed ? 'Enquete encerrada' : `Encerra ${date} às ${time}`;
}

export default function PollBlock({
  poll: pollProp,
  postId,
  onChange,
}: {
  poll: Poll;
  postId: string;
  onChange?: (poll: Poll) => void;
}) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const accent = Colors.category.enquete ?? Colors.primary;

  const [poll, setPoll] = useState<Poll>(pollProp);
  const [mode, setMode] = useState<'vote' | 'results'>(
    pollProp.closed || pollProp.myVotes.length > 0 ? 'results' : 'vote',
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(pollProp.myVotes));
  const [busy, setBusy] = useState(false);

  // Sincroniza quando a enquete muda por fora (ex.: após edição do autor).
  useEffect(() => {
    setPoll(pollProp);
    setSelected(new Set(pollProp.myVotes));
    setMode(pollProp.closed || pollProp.myVotes.length > 0 ? 'results' : 'vote');
  }, [pollProp]);

  const submit = async (ids: string[]) => {
    if (busy || ids.length === 0) return;
    setBusy(true);
    try {
      const updated = await api.votePoll(postId, ids);
      if (updated.poll) {
        setPoll(updated.poll);
        onChange?.(updated.poll);
        setMode('results');
      }
    } catch {
      // reverte a seleção visual
      setSelected(new Set(poll.myVotes));
    } finally {
      setBusy(false);
    }
  };

  const onOptionPress = (id: string) => {
    if (busy) return;
    if (poll.multiple) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelected(new Set([id]));
      submit([id]); // voto único: confirma na hora
    }
  };

  const startEdit = () => {
    setSelected(new Set(poll.myVotes));
    setMode('vote');
  };

  const unvote = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await api.unvotePoll(postId);
      if (updated.poll) {
        setPoll(updated.poll);
        onChange?.(updated.poll);
        setSelected(new Set());
        setMode('vote');
      }
    } catch {
      // ignora
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {mode === 'vote' ? (
        <>
          {poll.options.map((o) => {
            const on = selected.has(o.id);
            return (
              <TouchableOpacity
                key={o.id}
                style={[styles.voteRow, on && { borderColor: accent, backgroundColor: accent + '10' }]}
                activeOpacity={0.8}
                onPress={() => onOptionPress(o.id)}
                disabled={busy}
              >
                <View
                  style={[
                    poll.multiple ? styles.checkbox : styles.radio,
                    on && { borderColor: accent, backgroundColor: accent },
                  ]}
                >
                  {on && <Ionicons name="checkmark" size={13} color="#fff" />}
                </View>
                <Text style={styles.voteText} numberOfLines={2}>{o.text}</Text>
              </TouchableOpacity>
            );
          })}
          {poll.multiple && (
            <TouchableOpacity
              style={[styles.voteBtn, (selected.size === 0 || busy) && styles.voteBtnDisabled]}
              onPress={() => submit([...selected])}
              disabled={selected.size === 0 || busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.voteBtnText}>Votar</Text>
              )}
            </TouchableOpacity>
          )}
        </>
      ) : (
        poll.options.map((o) => {
          const pct = poll.totalVotes > 0 ? Math.round((o.votesCount / poll.totalVotes) * 100) : 0;
          const mine = poll.myVotes.includes(o.id);
          return (
            <View key={o.id} style={styles.resultRow}>
              <View style={[styles.resultFill, { width: `${pct}%`, backgroundColor: accent + (mine ? '2E' : '18') }]} />
              <View style={styles.resultContent}>
                <View style={styles.resultLeft}>
                  {mine && <Ionicons name="checkmark-circle" size={15} color={accent} />}
                  <Text style={[styles.resultText, mine && { fontWeight: '800', color: Colors.text }]} numberOfLines={2}>
                    {o.text}
                  </Text>
                </View>
                <Text style={[styles.resultPct, mine && { color: accent }]}>{pct}%</Text>
              </View>
            </View>
          );
        })
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {poll.totalVotes} {poll.totalVotes === 1 ? 'voto' : 'votos'}
          {'  ·  '}
          {formatCloses(poll.closesAt, poll.closed)}
        </Text>
        {mode === 'results' && !poll.closed && (
          <View style={styles.footerActions}>
            {poll.myVotes.length > 0 && (
              <TouchableOpacity onPress={unvote} hitSlop={8} disabled={busy}>
                <Text style={[styles.changeVote, { color: Colors.textTertiary }]}>Remover voto</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={startEdit} hitSlop={8}>
              <Text style={[styles.changeVote, { color: accent }]}>
                {poll.myVotes.length > 0 ? 'Alterar voto' : 'Votar'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  wrap: { gap: 8, marginBottom: 12 },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: Colors.surface,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteText: { flex: 1, fontSize: 14, color: Colors.text, fontWeight: '600' },
  voteBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  voteBtnDisabled: { backgroundColor: Colors.textTertiary, opacity: 0.5 },
  voteBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  resultRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    justifyContent: 'center',
    minHeight: 42,
  },
  resultFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 12 },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  resultLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  resultText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600', flexShrink: 1 },
  resultPct: { fontSize: 13, color: Colors.textSecondary, fontWeight: '800' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  footerText: { fontSize: 12, color: Colors.textTertiary, fontWeight: '500' },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  changeVote: { fontSize: 12, fontWeight: '800' },
});
