import { useMemo, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { APP_URL } from '../lib/config';
import { fmtDate, fmtMoney, fmtNumber } from '../lib/format';
import {
  CAMPAIGN_STATUS_FILTERS,
  CAMPAIGN_STATUS_LABEL,
  FORMAT_LABEL,
  OBJECTIVE_LABEL,
  describeGeo,
  statusTone,
} from '../lib/labels';
import { Campaign } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useDialogs } from '../ui/dialogs';
import { Badge, CopyButton, EmptyState, LoadingState, Stat, Tabs } from '../ui/primitives';
import { CampaignDetails } from './CampaignDetails';

export function Campaigns() {
  const dialogs = useDialogs();
  const [status, setStatus] = useState('');
  const [advertiserQuery, setAdvertiserQuery] = useState('');
  const [titleQuery, setTitleQuery] = useState('');

  const { data, loading, error, reload } = useAsync<Campaign[]>(
    () => api.get<Campaign[]>(`/admin/ads/campaigns${status ? `?status=${status}` : ''}`),
    [status],
  );

  const all = useMemo(() => data ?? [], [data]);

  // Busca por anunciante e por título filtra em memória a lista já carregada
  // (não paginada), sem ida ao servidor a cada tecla.
  const filtered = useMemo(() => {
    const adv = advertiserQuery.trim().toLowerCase();
    const title = titleQuery.trim().toLowerCase();
    return all.filter((c) => {
      if (adv && !`${c.advertiser_name} ${c.advertiser_email}`.toLowerCase().includes(adv)) {
        return false;
      }
      if (
        title &&
        !(c.creatives || [])
          .map((cr) => cr.title || '')
          .join(' ')
          .toLowerCase()
          .includes(title)
      ) {
        return false;
      }
      return true;
    });
  }, [all, advertiserQuery, titleQuery]);

  const act = async (run: () => Promise<unknown>) => {
    try {
      await run();
      await reload();
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  return (
    <div>
      <div className="stats">
        <Stat value={fmtNumber(all.filter((c) => c.status === 'active').length)} label="ativas" />
        <Stat
          value={fmtNumber(all.reduce((sum, c) => sum + c.impressions_count, 0))}
          label="impressões"
        />
        <Stat value={fmtNumber(all.reduce((sum, c) => sum + c.clicks_count, 0))} label="cliques" />
      </div>

      <div className="row-2" style={{ marginBottom: 14 }}>
        <input
          placeholder="Buscar por anunciante (nome ou e-mail)..."
          value={advertiserQuery}
          onChange={(e) => setAdvertiserQuery(e.target.value)}
        />
        <input
          placeholder="Buscar por título da campanha..."
          value={titleQuery}
          onChange={(e) => setTitleQuery(e.target.value)}
        />
      </div>

      <Tabs value={status} options={CAMPAIGN_STATUS_FILTERS} onChange={setStatus} />

      {loading && <LoadingState />}
      {!loading && error && <EmptyState>{error}</EmptyState>}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState>Nenhuma campanha encontrada.</EmptyState>
      )}

      {!loading &&
        !error &&
        filtered.map((c) => (
          <CampaignCard
            key={c.id}
            campaign={c}
            onPause={() => act(() => api.patch(`/admin/ads/campaigns/${c.id}`, { status: 'paused' }))}
            onActivate={() =>
              act(() => api.patch(`/admin/ads/campaigns/${c.id}`, { status: 'active' }))
            }
            onMarkPaid={() => act(() => api.post(`/admin/ads/campaigns/${c.id}/mark-paid`))}
          />
        ))}
    </div>
  );
}

function CampaignCard({
  campaign: c,
  onPause,
  onActivate,
  onMarkPaid,
}: {
  campaign: Campaign;
  onPause: () => void;
  onActivate: () => void;
  onMarkPaid: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const primary = c.creatives?.[0];

  return (
    <div className="card hoverable">
      <div className="card-head">
        <div className="grow">
          <div className="card-title">{primary ? primary.title : '(sem criativo)'}</div>
          <div className="card-sub">
            {c.advertiser_name} · {c.advertiser_email}
          </div>
        </div>
        <Badge tone={statusTone(c.status)}>{CAMPAIGN_STATUS_LABEL[c.status] || c.status}</Badge>
      </div>

      <div className="tag-row">
        {c.formats.map((f) => (
          <span key={f} className="tag">
            {FORMAT_LABEL[f] || f}
          </span>
        ))}
        <span className="tag">{OBJECTIVE_LABEL[c.objective] || c.objective}</span>
        <span className="tag">prioridade {c.priority}</span>
      </div>

      {primary?.content && <div className="card-text">{primary.content}</div>}

      <div className="meta-row">
        <span>{describeGeo(c.targeting)}</span>
        <span>·</span>
        <span>{fmtMoney(c.price_cents)}</span>
        <span>·</span>
        <span>
          {fmtDate(c.starts_at)} → {fmtDate(c.ends_at)}
        </span>
      </div>
      <div className="meta-row">
        <span>{fmtNumber(c.impressions_count)} impressões</span>
        <span>·</span>
        <span>{fmtNumber(c.clicks_count)} cliques</span>
      </div>
      {c.renewed_from_id && (
        <div className="meta-row">↻ Renovação da campanha #{c.renewed_from_id}</div>
      )}

      <div className="actions" style={{ marginTop: 14 }}>
        {c.status === 'active' && (
          <button type="button" className="btn warn" onClick={onPause}>
            Pausar
          </button>
        )}
        {c.status === 'paused' && (
          <button type="button" className="btn primary" onClick={onActivate}>
            Reativar
          </button>
        )}
        {c.status === 'pending_payment' && (
          <button type="button" className="btn primary" onClick={onMarkPaid}>
            Marcar como paga
          </button>
        )}
        <CopyButton
          text={`${APP_URL}/advertise/dashboard/${c.access_token}`}
          label="Copiar link do anunciante"
          icon
        />
        <button
          type="button"
          className="btn ghost"
          onClick={() => setDetailsOpen((v) => !v)}
          style={{ marginLeft: 'auto' }}
        >
          {detailsOpen ? 'Ocultar detalhes' : 'Detalhes'}
        </button>
      </div>

      {detailsOpen && <CampaignDetails campaignId={c.id} />}
    </div>
  );
}
