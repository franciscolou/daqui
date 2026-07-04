import { useCallback, useState } from 'react';
import { api, ApiError } from './api';

export const MAX_COMMENT = 1000;

export const RATING_LABELS: Record<number, string> = {
  0: 'Toque nas estrelas para avaliar',
  1: 'Péssimo',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Ótimo',
};

/** Estado e ações do formulário de avaliação do app, compartilhados entre o modal (desktop) e a tela cheia (mobile). */
export function useRateForm() {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hasReview, setHasReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const mine = await api.getMyReview();
      if (mine) {
        setRating(mine.rating);
        setComment(mine.comment);
        setHasReview(true);
      }
    } catch {
      /* ignora */
    } finally {
      setLoading(false);
    }
  }, []);

  const submit = useCallback(async () => {
    if (rating < 0.5 || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      await api.submitReview(rating, comment.trim());
      setHasReview(true);
      setFeedback({ ok: true, text: 'Obrigado! Sua avaliação foi registrada.' });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : 'Não foi possível enviar. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  }, [rating, comment, saving]);

  const label = RATING_LABELS[Math.ceil(rating)] ?? RATING_LABELS[0];

  return { rating, setRating, comment, setComment, hasReview, loading, saving, feedback, load, submit, label };
}

export type RateForm = ReturnType<typeof useRateForm>;
