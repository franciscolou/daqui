import { useRef, useState } from 'react';

// Primitivas de gráfico do painel — sem biblioteca externa (mesmo espírito
// minimalista do resto do moderator: só react/react-dom). Cada uma já nasce
// com animação de entrada (CSS puro, via @keyframes em styles.css — dispara
// sozinha quando o componente monta, então quem chama re-monta com `key`
// quando o filtro/período muda pra "replay" a animação) e tooltip (CSS-only
// pra marcas discretas — barra/coluna/segmento —, crosshair via JS só no
// TrendLine, que é contínuo). `prefers-reduced-motion` é tratado 1x em
// styles.css, não aqui.
//
// "Atual vs período anterior" segue a forma "emphasis" do método de dataviz:
// a série atual usa a cor de destaque (--primary) e a de comparação fica
// cinza/tracejada — nunca uma 2ª cor competindo. "Plataforma" é identidade
// categórica de verdade (3 séries fixas), cores validadas à parte (ver
// PLATFORM_COLOR abaixo) contra as superfícies reais do painel.

export function fmtDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}m ${rest}s` : `${m}m`;
}

export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

/** Variação percentual de `current` vs `previous` — null quando não há base
 * de comparação válida (sem período anterior, ou período anterior zerado). */
export function deltaPct(current: number, previous: number | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function DeltaBadge({ pct, goodDirection = 'up' }: { pct: number; goodDirection?: 'up' | 'down' }) {
  const good = goodDirection === (pct >= 0 ? 'up' : 'down');
  return (
    <span className={`bar-delta ${good ? 'good' : 'bad'}`}>
      {pct >= 0 ? '▲' : '▼'}
      {Math.abs(Math.round(pct))}%
    </span>
  );
}

// ── Lista de barras horizontais (telas, saídas, cliques, buscas) ─────────

export interface BarItem {
  key: string;
  label: string;
  value: number;
  display: string;
  compareValue?: number;
}

export function BarList({ items, empty }: { items: BarItem[]; empty: string }) {
  if (items.length === 0) return <div className="empty-state">{empty}</div>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <>
      {items.map((i) => {
        const pct = deltaPct(i.value, i.compareValue);
        return (
          <div className="bar-row" key={i.key} tabIndex={0}>
            <span className="bar-label" title={i.label}>
              {i.label}
            </span>
            <div className="bar-track">
              <div
                className="bar-fill analytics-grow-x"
                style={{ width: `${Math.max(4, (i.value / max) * 100)}%` }}
              />
            </div>
            <span className="bar-value">{i.display}</span>
            {pct != null && <DeltaBadge pct={pct} />}
            <div className="chart-tooltip chart-tooltip-row">
              <strong>{i.display}</strong>
              {pct != null && <span> · {pct >= 0 ? '+' : ''}{Math.round(pct)}% vs anterior</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Linha de tendência (usuários ativos por dia) ──────────────────────────

export interface TrendPoint {
  label: string;
  value: number;
}

const VB_W = 600;
const VB_TOP_PAD = 10;

function linePath(values: number[], maxLen: number, maxValue: number, h: number): string {
  if (values.length === 0) return '';
  const step = maxLen > 1 ? VB_W / (maxLen - 1) : 0;
  return values
    .map((v, i) => {
      const x = i * step;
      const y = VB_TOP_PAD + (h - VB_TOP_PAD) * (1 - v / maxValue);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function TrendLine({
  points,
  comparePoints,
  height = 180,
  valueSuffix = '',
}: {
  points: TrendPoint[];
  comparePoints?: TrendPoint[];
  height?: number;
  valueSuffix?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltipX, setTooltipX] = useState(0);

  const maxLen = Math.max(points.length, comparePoints?.length ?? 0, 1);
  const maxValue = Math.max(1, ...points.map((p) => p.value), ...(comparePoints ?? []).map((p) => p.value));
  const step = maxLen > 1 ? VB_W / (maxLen - 1) : 0;

  const currentPath = linePath(
    points.map((p) => p.value),
    maxLen,
    maxValue,
    height,
  );
  const areaPath = currentPath ? `${currentPath} L${(points.length - 1) * step},${height} L0,${height} Z` : '';
  const comparePath = comparePoints
    ? linePath(
        comparePoints.map((p) => p.value),
        maxLen,
        maxValue,
        height,
      )
    : '';

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverIdx(Math.round(ratio * (maxLen - 1)));
    if (containerRef.current) {
      const crect = containerRef.current.getBoundingClientRect();
      setTooltipX(Math.min(crect.width - 70, Math.max(70, e.clientX - crect.left)));
    }
  };

  const hoverX = hoverIdx != null ? hoverIdx * step : 0;
  const hoverCurrent = hoverIdx != null ? points[hoverIdx] : undefined;
  const hoverCompare = hoverIdx != null ? comparePoints?.[hoverIdx] : undefined;

  return (
    <div className="trend-chart" ref={containerRef}>
      {comparePoints && (
        <div className="legend">
          <span>
            <span className="dot dot-current" /> Período atual
          </span>
          <span>
            <span className="dash dash-compare" /> Período anterior
          </span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${VB_W} ${height}`}
        preserveAspectRatio="none"
        className="trend-svg"
        onPointerMove={onMove}
        onPointerLeave={() => setHoverIdx(null)}
      >
        <line x1={0} y1={height} x2={VB_W} y2={height} className="trend-baseline" />
        {areaPath && <path d={areaPath} className="trend-area analytics-fade-in" />}
        {comparePath && (
          <path d={comparePath} className="trend-line trend-line-compare analytics-draw-line" pathLength={100} />
        )}
        {currentPath && (
          <path d={currentPath} className="trend-line trend-line-current analytics-draw-line" pathLength={100} />
        )}
        {hoverIdx != null && (
          <>
            <line x1={hoverX} x2={hoverX} y1={VB_TOP_PAD} y2={height} className="trend-crosshair" />
            {hoverCurrent && (
              <circle
                cx={hoverX}
                cy={VB_TOP_PAD + (height - VB_TOP_PAD) * (1 - hoverCurrent.value / maxValue)}
                r={4.5}
                className="trend-dot trend-dot-current"
              />
            )}
            {hoverCompare && (
              <circle
                cx={hoverX}
                cy={VB_TOP_PAD + (height - VB_TOP_PAD) * (1 - hoverCompare.value / maxValue)}
                r={4.5}
                className="trend-dot trend-dot-compare"
              />
            )}
          </>
        )}
      </svg>
      {hoverIdx != null && hoverCurrent && (
        <div className="chart-floating-tooltip" style={{ left: tooltipX }}>
          <div className="tt-date">{hoverCurrent.label}</div>
          <div className="tt-row">
            <span className="dot dot-current" /> {hoverCurrent.value}
            {valueSuffix}
          </div>
          {hoverCompare && (
            <div className="tt-row muted">
              <span className="dash dash-compare" /> {hoverCompare.label}: {hoverCompare.value}
              {valueSuffix}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Atividade por hora do dia ──────────────────────────────────────────

export function HourlyBars({
  data,
  compareData,
}: {
  data: { hour: string; count: number }[];
  compareData?: { hour: string; count: number }[];
}) {
  const byHour = new Map(data.map((d) => [d.hour, d.count]));
  const compareByHour = new Map((compareData ?? []).map((d) => [d.hour, d.count]));
  const hours = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
  const max = Math.max(1, ...hours.map((h) => byHour.get(h) ?? 0), ...hours.map((h) => compareByHour.get(h) ?? 0));

  return (
    <div className="hbars">
      {hours.map((h) => {
        const value = byHour.get(h) ?? 0;
        const compareValue = compareData ? compareByHour.get(h) ?? 0 : undefined;
        return (
          <div className="hbar-col" key={h} tabIndex={0}>
            <div className="hbar-bars">
              {compareData !== undefined && (
                <div
                  className="hbar hbar-compare analytics-grow-y"
                  style={{ height: `${Math.max(2, ((compareValue ?? 0) / max) * 100)}%` }}
                />
              )}
              <div
                className="hbar hbar-current analytics-grow-y"
                style={{ height: `${Math.max(2, (value / max) * 100)}%` }}
              />
            </div>
            {Number(h) % 3 === 0 && <div className="hbar-label">{h}h</div>}
            <div className="chart-tooltip">
              {h}h: <strong>{value}</strong>
              {compareData !== undefined && <span className="muted"> (ant.: {compareValue})</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Plataforma (web/iOS/Android) ──────────────────────────────────────

// Trio validado (scripts/validate_palette.js) contra as superfícies reais
// do moderator (#ffffff claro / #0f172a escuro) — todos os checks passam;
// o aqua fica abaixo de 3:1 no claro, por isso todo valor aqui também tem
// rótulo direto (nunca só a cor).
const PLATFORM_ORDER = ['web', 'ios', 'android'] as const;
const PLATFORM_COLOR: Record<string, string> = {
  web: 'var(--platform-web)',
  ios: 'var(--platform-ios)',
  android: 'var(--platform-android)',
};

export function PlatformBars({
  data,
  compareData,
  labelFor,
}: {
  data: { platform: string; active_users: number }[];
  compareData?: { platform: string; active_users: number }[];
  labelFor: (platform: string) => string;
}) {
  const byPlatform = new Map(data.map((d) => [d.platform, d.active_users]));
  const compareByPlatform = new Map((compareData ?? []).map((d) => [d.platform, d.active_users]));
  const platforms = PLATFORM_ORDER.filter((p) => (byPlatform.get(p) ?? 0) > 0 || (compareByPlatform.get(p) ?? 0) > 0);
  if (platforms.length === 0) return <div className="empty-state">Sem dados no período.</div>;
  const max = Math.max(1, ...platforms.map((p) => byPlatform.get(p) ?? 0), ...platforms.map((p) => compareByPlatform.get(p) ?? 0));

  return (
    <div className="platform-bars">
      {platforms.map((p) => {
        const value = byPlatform.get(p) ?? 0;
        const compareValue = compareData ? compareByPlatform.get(p) ?? 0 : undefined;
        const pct = deltaPct(value, compareValue);
        return (
          <div className="platform-col" key={p} tabIndex={0}>
            <div className="platform-bar-track">
              {compareData !== undefined && (
                <div
                  className="platform-bar platform-bar-compare analytics-grow-y"
                  style={{ height: `${Math.max(3, ((compareValue ?? 0) / max) * 100)}%`, background: PLATFORM_COLOR[p] }}
                />
              )}
              <div
                className="platform-bar analytics-grow-y"
                style={{ height: `${Math.max(3, (value / max) * 100)}%`, background: PLATFORM_COLOR[p] }}
              />
            </div>
            <div className="platform-value">{value}</div>
            <div className="platform-label">
              <span className="dot" style={{ background: PLATFORM_COLOR[p] }} />
              {labelFor(p)}
            </div>
            {pct != null && <DeltaBadge pct={pct} />}
            <div className="chart-tooltip">
              {labelFor(p)}: <strong>{value}</strong> usuários
              {compareData !== undefined && <span className="muted"> (ant.: {compareValue})</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Novos vs recorrentes ──────────────────────────────────────────────

export function SplitBar({
  newCount,
  returningCount,
  compareNewCount,
  compareReturningCount,
}: {
  newCount: number;
  returningCount: number;
  compareNewCount?: number;
  compareReturningCount?: number;
}) {
  const total = Math.max(1, newCount + returningCount);
  const newPct = (newCount / total) * 100;
  const compareTotal =
    compareNewCount != null && compareReturningCount != null
      ? Math.max(1, compareNewCount + compareReturningCount)
      : null;

  return (
    <div className="split-bar-wrap">
      <div className="split-bar analytics-fade-in">
        <div className="split-seg split-seg-new" style={{ width: `${newPct}%` }} tabIndex={0}>
          {newPct > 18 && <span className="split-label">Novos · {newCount}</span>}
          <div className="chart-tooltip">
            Novos: <strong>{newCount}</strong> ({Math.round(newPct)}%)
          </div>
        </div>
        <div className="split-seg split-seg-returning" style={{ width: `${100 - newPct}%` }} tabIndex={0}>
          {100 - newPct > 18 && <span className="split-label">Recorrentes · {returningCount}</span>}
          <div className="chart-tooltip">
            Recorrentes: <strong>{returningCount}</strong> ({Math.round(100 - newPct)}%)
          </div>
        </div>
      </div>
      {compareTotal != null && (
        <div className="split-bar split-bar-compare">
          <div className="split-seg split-seg-new" style={{ width: `${((compareNewCount ?? 0) / compareTotal) * 100}%` }} />
          <div
            className="split-seg split-seg-returning"
            style={{ width: `${((compareReturningCount ?? 0) / compareTotal) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
