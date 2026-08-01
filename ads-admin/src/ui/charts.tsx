import { fmtNumber, fmtPercent } from '../lib/format';
import { Bucket } from '../lib/types';

// Gráficos do painel em HTML/CSS puro: são poucos e simples (barras
// horizontais e um par de colunas por dia), então uma lib de charts só
// traria peso e um visual fora do design system.

/** Barras horizontais — uma linha por bucket, ordenadas por impressões. */
export function BarRows({
  buckets,
  labelFor = (k: string) => k,
  labelWidth = 116,
  sort = false,
}: {
  buckets: Bucket[];
  labelFor?: (key: string) => string;
  labelWidth?: number;
  sort?: boolean;
}) {
  if (!buckets.length) return <div className="muted">Sem dados.</div>;

  const rows = sort ? [...buckets].sort((a, b) => b.impressions - a.impressions) : buckets;
  const max = Math.max(1, ...rows.map((b) => b.impressions));

  return (
    <>
      {rows.map((b) => (
        <div key={b.key} className="bar-row">
          <span className="bar-label" style={{ width: labelWidth }} title={labelFor(b.key)}>
            {labelFor(b.key)}
          </span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: `${Math.round((b.impressions / max) * 100)}%` }}
            />
          </span>
          <span className="bar-value">
            {fmtNumber(b.impressions)} imp · {fmtPercent(b.ctr)} CTR
          </span>
        </div>
      ))}
    </>
  );
}

export function BarCard({
  title,
  buckets,
  labelFor,
}: {
  title: string;
  buckets: Bucket[];
  labelFor?: (key: string) => string;
}) {
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <BarRows buckets={buckets} labelFor={labelFor} sort />
    </div>
  );
}

/** Colunas por dia: impressões e cliques lado a lado. */
export function TimeseriesChart({ buckets }: { buckets: Bucket[] }) {
  if (!buckets.length) return <div className="muted">Sem eventos no período.</div>;

  const max = Math.max(1, ...buckets.map((b) => Math.max(b.impressions, b.clicks)));
  const height = (v: number) => Math.max(2, Math.round((v / max) * 112));

  return (
    <>
      <div className="legend">
        <span>
          <span className="dot dot-imp" />
          Impressões
        </span>
        <span>
          <span className="dot dot-clk" />
          Cliques
        </span>
      </div>
      <div className="vchart">
        {buckets.map((b) => (
          <div
            key={b.key}
            className="vcol"
            title={`${b.key}: ${fmtNumber(b.impressions)} impressões, ${fmtNumber(b.clicks)} cliques (${fmtPercent(b.ctr)} CTR)`}
          >
            <div className="vbars">
              <div className="vbar" style={{ height: height(b.impressions) }} />
              <div className="vbar clk" style={{ height: height(b.clicks) }} />
            </div>
            <div className="vlabel">{b.key.length === 10 ? b.key.slice(5) : b.key}</div>
          </div>
        ))}
      </div>
    </>
  );
}
