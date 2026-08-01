import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fmtDate, fmtMoney, fmtNumber, fmtPercent, isoDate } from '../lib/format';
import {
  CAMPAIGN_STATUS_FILTERS,
  CAMPAIGN_STATUS_LABEL,
  CATEGORY_LABEL,
  FORMAT_LABEL,
  OBJECTIVE_LABEL,
  statusTone,
} from '../lib/labels';
import { AnalyticsOverview } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { BarCard, TimeseriesChart } from '../ui/charts';
import { Badge, EmptyState, Field, LoadingState, Stat } from '../ui/primitives';

const PRESETS = [
  { key: '7', label: '7 dias', days: 7 },
  { key: '30', label: '30 dias', days: 30 },
  { key: '90', label: '90 dias', days: 90 },
  { key: 'all', label: 'Tudo', days: null },
] as const;

function rangeFor(days: number | null): { from: string; to: string } {
  if (days == null) return { from: '', to: '' };
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: isoDate(from), to: isoDate(to) };
}

export function Analytics() {
  // Os filtros só valem quando "Aplicar" é clicado — `applied` é o que vai
  // pra query, `draft` é o que está na tela.
  const [preset, setPreset] = useState<string>('30');
  const [draft, setDraft] = useState({ ...rangeFor(30), advertiser: '', status: '' });
  const [applied, setApplied] = useState(draft);
  // A lista de anunciantes vem na primeira resposta e não muda com os
  // filtros — congelamos pra opção selecionada não sumir do <select>.
  const [advertisers, setAdvertisers] = useState<string[]>([]);

  const { data, loading, error } = useAsync<AnalyticsOverview>(() => {
    const qs = new URLSearchParams();
    if (applied.from) qs.set('date_from', applied.from);
    if (applied.to) qs.set('date_to', applied.to);
    if (applied.advertiser) qs.set('advertiser', applied.advertiser);
    if (applied.status) qs.set('status', applied.status);
    return api.get<AnalyticsOverview>(`/admin/ads/analytics?${qs.toString()}`);
  }, [applied]);

  useEffect(() => {
    if (data && advertisers.length === 0) setAdvertisers(data.advertisers);
  }, [data, advertisers.length]);

  const applyPreset = (key: string) => {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setPreset(key);
    const next = { ...draft, ...rangeFor(p.days) };
    setDraft(next);
    setApplied(next);
  };

  const clear = () => {
    const next = { from: '', to: '', advertiser: '', status: '' };
    setPreset('all');
    setDraft(next);
    setApplied(next);
  };

  return (
    <div>
      <div className="filters">
        <Field label="De">
          <input
            type="date"
            value={draft.from}
            onChange={(e) => {
              setPreset('');
              setDraft({ ...draft, from: e.target.value });
            }}
          />
        </Field>
        <Field label="Até">
          <input
            type="date"
            value={draft.to}
            onChange={(e) => {
              setPreset('');
              setDraft({ ...draft, to: e.target.value });
            }}
          />
        </Field>
        <Field label="Anunciante">
          <select
            value={draft.advertiser}
            onChange={(e) => setDraft({ ...draft, advertiser: e.target.value })}
          >
            <option value="">Todos</option>
            {advertisers.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          >
            {CAMPAIGN_STATUS_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Períodos rápidos">
          <div className="presets">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`preset${p.key === preset ? ' active' : ''}`}
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => setApplied(draft)}>
            Aplicar filtros
          </button>
          <button type="button" className="btn" onClick={clear}>
            Limpar
          </button>
        </div>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <EmptyState>{error}</EmptyState>}

      {!loading && !error && data && (
        <>
          <div className="stats">
            <Stat value={fmtMoney(data.summary.revenue_cents)} label="receita no período" />
            <Stat value={fmtNumber(data.summary.impressions)} label="impressões" />
            <Stat value={fmtNumber(data.summary.clicks)} label="cliques" />
            <Stat value={fmtPercent(data.summary.ctr)} label="CTR" />
            <Stat value={fmtMoney(data.summary.cpc_cents)} label="CPC" />
            <Stat
              value={`${data.summary.active_campaigns}/${data.summary.campaigns_count}`}
              label="campanhas ativas"
            />
          </div>

          {data.insights.length > 0 && (
            <div className="insights">
              <h3>Insights</h3>
              <ul>
                {data.insights.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="chart-card">
            <h3>Impressões e cliques por dia</h3>
            <TimeseriesChart buckets={data.timeseries} />
          </div>

          <div className="charts-grid">
            <BarCard
              title="Por formato"
              buckets={data.by_format}
              labelFor={(k) => FORMAT_LABEL[k] || k}
            />
            <BarCard
              title="Por objetivo"
              buckets={data.by_objective}
              labelFor={(k) => OBJECTIVE_LABEL[k] || k}
            />
            <BarCard
              title="Por categoria"
              buckets={data.by_category}
              labelFor={(k) => CATEGORY_LABEL[k] || k}
            />
            <BarCard title="Bairros com mais impressões" buckets={data.top_neighborhoods} />
          </div>

          <div className="chart-card" style={{ marginTop: 12 }}>
            <h3>Campanhas</h3>
            {data.campaigns.length === 0 ? (
              <EmptyState>Nenhuma campanha encontrada.</EmptyState>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Anunciante</th>
                      <th>Status</th>
                      <th>Categoria</th>
                      <th>Objetivo</th>
                      <th>Valor</th>
                      <th>Impressões</th>
                      <th>Cliques</th>
                      <th>CTR</th>
                      <th>CPC</th>
                      <th>Início</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((r, idx) => (
                      <tr key={`${r.advertiser_email}-${idx}`}>
                        <td>
                          {r.advertiser_name}
                          <br />
                          <span className="muted">{r.advertiser_email}</span>
                        </td>
                        <td>
                          <Badge tone={statusTone(r.status)}>
                            {CAMPAIGN_STATUS_LABEL[r.status] || r.status}
                          </Badge>
                        </td>
                        <td>{CATEGORY_LABEL[r.category] || r.category}</td>
                        <td>{OBJECTIVE_LABEL[r.objective] || r.objective}</td>
                        <td className="num">{fmtMoney(r.price_cents)}</td>
                        <td className="num">{fmtNumber(r.impressions)}</td>
                        <td className="num">{fmtNumber(r.clicks)}</td>
                        <td className="num">{fmtPercent(r.ctr)}</td>
                        <td className="num">{fmtMoney(r.cpc_cents)}</td>
                        <td>{fmtDate(r.starts_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
