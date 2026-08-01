import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { AdsSettings } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { Field, LoadingState } from '../ui/primitives';

export function Settings() {
  const { data, loading, error } = useAsync<AdsSettings>(() =>
    api.get<AdsSettings>('/admin/ads/settings'),
  );
  const [multiplier, setMultiplier] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setMultiplier(String(data.price_multiplier));
  }, [data]);

  const save = async () => {
    setSaveError('');
    setSaved(false);
    const value = parseFloat(multiplier);
    if (!(value > 0)) {
      setSaveError('Informe um multiplicador maior que zero.');
      return;
    }
    setBusy(true);
    try {
      const next = await api.put<AdsSettings>('/admin/ads/settings', { price_multiplier: value });
      setMultiplier(String(next.price_multiplier));
      setSaved(true);
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="form-card" style={{ maxWidth: 460 }}>
      <header>
        <h2>Multiplicador geral</h2>
        <span className="muted">
          Aplicado ao fim do cálculo de preço de todos os planos e cotações — use para tornar os
          preços proporcionais ao desempenho do Daqui (ex.: 1.1 = +10% em cima de tudo, 0.9 = -10%).
        </span>
      </header>

      <div className="stack">
        <Field label="Multiplicador">
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
          />
        </Field>
        <button type="button" className="btn primary lg block" disabled={busy} onClick={save}>
          Salvar
        </button>
        {(error || saveError) && <div className="err">{error || saveError}</div>}
        {saved && <div className="ok-text">Salvo.</div>}
      </div>
    </div>
  );
}
