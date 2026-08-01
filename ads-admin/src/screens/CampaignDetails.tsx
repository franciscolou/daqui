import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { fmtMoney, fmtNumber, fmtPercent } from '../lib/format';
import { FORMAT_LABEL } from '../lib/labels';
import { CampaignAnalytics, Creative } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useDialogs } from '../ui/dialogs';
import { BarRows } from '../ui/charts';
import { MediaPicker, UploadedMedia } from '../ui/MediaPicker';
import { EmptyState, Field, LoadingState } from '../ui/primitives';

// Painel de detalhes de uma campanha: números por horário + gestão dos
// criativos (o teste A/B do anúncio).

export function CampaignDetails({ campaignId }: { campaignId: number }) {
  const analytics = useAsync<CampaignAnalytics>(
    () => api.get<CampaignAnalytics>(`/admin/ads/campaigns/${campaignId}/analytics?group_by=hour`),
    [campaignId],
  );
  const creatives = useAsync<Creative[]>(
    () => api.get<Creative[]>(`/admin/ads/campaigns/${campaignId}/creatives`),
    [campaignId],
  );

  if (analytics.loading || creatives.loading) return <LoadingState />;
  if (analytics.error) return <div className="err">{analytics.error}</div>;

  const a = analytics.data;

  return (
    <>
      {a && (
        <div className="details-panel">
          <h3>Analytics</h3>
          <div className="mini-stats">
            <div className="m">
              <b>{fmtNumber(a.summary.impressions)}</b>impressões
            </div>
            <div className="m">
              <b>{fmtNumber(a.summary.clicks)}</b>cliques
            </div>
            <div className="m">
              <b>{fmtPercent(a.summary.ctr)}</b>CTR
            </div>
            <div className="m">
              <b>{fmtMoney(a.summary.cpc_cents)}</b>CPC
            </div>
            <div className="m">
              <b>{fmtMoney(a.summary.cpm_cents)}</b>CPM
            </div>
          </div>

          <div className="muted" style={{ marginBottom: 8 }}>
            Impressões por horário
          </div>
          <BarRows buckets={a.buckets} labelWidth={40} />

          {a.actions && Object.keys(a.actions).length > 0 && (
            <div className="tag-row">
              {Object.entries(a.actions).map(([k, v]) => (
                <span key={k} className="tag">
                  {k}: {fmtNumber(v)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <CreativesPanel
        campaignId={campaignId}
        creatives={creatives.data ?? []}
        onChanged={creatives.reload}
      />
    </>
  );
}

const EMPTY_DRAFT = { title: '', content: '', target_url: '', format: '', weight: '1' };

function CreativesPanel({
  campaignId,
  creatives,
  onChanged,
}: {
  campaignId: number;
  creatives: Creative[];
  onChanged: () => Promise<void>;
}) {
  const dialogs = useDialogs();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof EMPTY_DRAFT, v: string) =>
    setDraft((prev) => ({ ...prev, [key]: v }));

  const toggleActive = async (cr: Creative) => {
    try {
      await api.patch(`/admin/ads/campaigns/${campaignId}/creatives/${cr.id}`, {
        is_active: !cr.is_active,
      });
      await onChanged();
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  const add = async () => {
    setError('');
    setBusy(true);
    try {
      await api.post(`/admin/ads/campaigns/${campaignId}/creatives`, {
        title: draft.title.trim(),
        content: draft.content.trim(),
        target_url: draft.target_url.trim(),
        format: draft.format.trim() || null,
        image_url: media?.type === 'image' ? media.url : null,
        video_url: media?.type === 'video' ? media.url : null,
        weight: parseInt(draft.weight || '1', 10),
      });
      setDraft(EMPTY_DRAFT);
      setMedia(null);
      await onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="details-panel">
      <h3>Criativos / teste A-B</h3>

      {creatives.length === 0 && <EmptyState>Nenhum criativo.</EmptyState>}
      {creatives.map((cr) => (
        <div key={cr.id} className="list-item">
          <div className="top">
            <b>{cr.title}</b>
            <button type="button" className="btn" onClick={() => toggleActive(cr)}>
              {cr.is_active ? 'Pausar' : 'Ativar'}
            </button>
          </div>
          <div className="sub">
            {cr.video_url ? 'Vídeo · ' : cr.image_url ? 'Imagem · ' : ''}
            {cr.format ? FORMAT_LABEL[cr.format] || cr.format : 'todos os formatos'} · peso{' '}
            {cr.weight} · {fmtNumber(cr.impressions_count)} imp · {fmtNumber(cr.clicks_count)} cliques
          </div>
        </div>
      ))}

      <div className="divider" />

      <div className="stack">
        <Field label="Novo criativo — título">
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Texto">
          <textarea value={draft.content} onChange={(e) => set('content', e.target.value)} />
        </Field>
        <div className="row-2">
          <Field label="Link de destino">
            <input
              placeholder="https://..."
              value={draft.target_url}
              onChange={(e) => set('target_url', e.target.value)}
            />
          </Field>
          <Field label="Formato (vazio = todos)">
            <input
              placeholder="post"
              value={draft.format}
              onChange={(e) => set('format', e.target.value)}
            />
          </Field>
        </div>
        <div className="row-2">
          <Field label="Foto ou vídeo (opcional)">
            <MediaPicker value={media} onChange={setMedia} />
          </Field>
          <Field label="Peso">
            <input
              type="number"
              min={1}
              value={draft.weight}
              onChange={(e) => set('weight', e.target.value)}
            />
          </Field>
        </div>
        <div>
          <button type="button" className="btn primary" disabled={busy} onClick={add}>
            Adicionar criativo
          </button>
        </div>
        {error && <div className="err">{error}</div>}
      </div>
    </div>
  );
}
