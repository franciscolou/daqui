import { api } from '../lib/api';
import { fmtMoney, fmtNumber, fmtPercent } from '../lib/format';
import { FORMAT_LABEL } from '../lib/labels';
import { CampaignAnalytics, Creative } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { BarRows } from '../ui/charts';
import { EmptyState, LoadingState } from '../ui/primitives';

// Painel de detalhes de uma campanha: números por horário + o(s) criativo(s)
// atuais (só leitura — o conteúdo é responsabilidade do próprio anunciante,
// ver /advertise/dashboard/edit/[token] no app).

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

      <div className="details-panel">
        <h3>Criativos</h3>
        {(creatives.data ?? []).length === 0 && <EmptyState>Nenhum criativo.</EmptyState>}
        {(creatives.data ?? []).map((cr) => (
          <div key={cr.id} className="list-item">
            <div className="top">
              <b>{cr.title}</b>
            </div>
            <div className="sub">
              {cr.video_url ? 'Vídeo · ' : cr.image_url ? 'Imagem · ' : ''}
              {cr.format ? FORMAT_LABEL[cr.format] || cr.format : 'todos os formatos'} ·{' '}
              {fmtNumber(cr.impressions_count)} imp · {fmtNumber(cr.clicks_count)} cliques
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
