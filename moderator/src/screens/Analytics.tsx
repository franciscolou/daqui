import { useState } from 'react';
import { api } from '../lib/api';
import { CLICK_LABEL, PLATFORM_FILTERS, PLATFORM_LABEL, SCREEN_LABEL } from '../lib/labels';
import { AnalyticsOverview } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import {
  BarItem,
  BarList,
  deltaPct,
  fmtCompact,
  fmtDuration,
  HourlyBars,
  PlatformBars,
  SplitBar,
  TrendLine,
  TrendPoint,
} from '../ui/charts';
import { EmptyState, Field, LoadingState, Stat, Tabs } from '../ui/primitives';
import { Icon } from '../ui/Icon';

// Uso do app principal (Daqui): frequência, permanência por tela, onde o app
// mais fecha, ações mais clicadas e buscas mais feitas. Alimentado por
// POST /analytics/events (ver frontend/lib/analytics.ts) e agregado em
// GET /admin/analytics/overview — restrito ao Owner (a aba já só aparece
// pra Owner em Shell.tsx, e o backend barra o resto com 403).
//
// Comparação de período é sobreposta (não uma tela separada): busca o mesmo
// overview de novo pro período anterior e passa como 2ª série pra cada
// gráfico/KPI — ver ui/charts.tsx pro porquê disso ser "emphasis" (atual em
// destaque, anterior em cinza/tracejado) e não paleta categórica.

const PRESETS = [7, 30, 90] as const;
const TOP_N_OPTIONS = [5, 10, 20] as const;

interface Range {
  from: string;
  to: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

function presetRange(days: number): Range {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: isoDate(from), to: isoDate(to) };
}

function defaultCompareRange(current: Range): Range {
  const days = daysBetween(current.from, current.to);
  const to = addDays(current.from, -1);
  const from = addDays(to, -(days - 1));
  return { from, to };
}

function fmtDay(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

function fmtFullDate(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function screenLabel(screen: string): string {
  return SCREEN_LABEL[screen] ?? screen;
}

function denseDailySeries(range: Range, sparse: { date: string; count: number }[]): TrendPoint[] {
  const map = new Map(sparse.map((d) => [d.date, d.count]));
  const points: TrendPoint[] = [];
  const end = new Date(`${range.to}T00:00:00`);
  for (let d = new Date(`${range.from}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = isoDate(d);
    points.push({ label: fmtDay(iso), value: map.get(iso) ?? 0 });
  }
  return points;
}

function fetchOverview(range: Range, platform: string, limit: number): Promise<AnalyticsOverview> {
  const qs = new URLSearchParams({ date_from: range.from, date_to: range.to, limit: String(limit) });
  if (platform) qs.set('platform', platform);
  return api.get<AnalyticsOverview>(`/admin/analytics/overview?${qs.toString()}`);
}

function statDelta(current: number, previous: number | undefined) {
  const pct = deltaPct(current, previous);
  return pct == null ? undefined : { pct };
}

/** Casa itens do período atual com o mesmo item (por chave) no período
 * anterior, pra desenhar o selo de variação nas listas — item que só existe
 * num dos dois períodos simplesmente não ganha selo. */
function withCompare<T extends { key: string; label: string; value: number; display: string }>(
  items: T[],
  compareByKey: Map<string, number>,
): BarItem[] {
  return items.map((item) => ({ ...item, compareValue: compareByKey.get(item.key) }));
}

export function Analytics() {
  const [range, setRange] = useState(() => presetRange(30));
  const [activePreset, setActivePreset] = useState<number | null>(30);
  const [platform, setPlatform] = useState('');
  const [topN, setTopN] = useState<number>(10);
  const [filterText, setFilterText] = useState('');
  const [sortScreensBy, setSortScreensBy] = useState<'time' | 'views'>('time');

  const [compareOpen, setCompareOpen] = useState(false);
  const [compareStart, setCompareStart] = useState<string | null>(null);
  const [compareDays, setCompareDays] = useState<number | null>(null);

  const compareRange: Range | null =
    compareOpen && compareStart && compareDays ? { from: compareStart, to: addDays(compareStart, compareDays - 1) } : null;
  const previousRange = defaultCompareRange(range);
  const isComparingPreviousPeriod =
    compareRange?.from === previousRange.from && compareRange?.to === previousRange.to;

  // O período de comparação sempre acompanha o período selecionado acima
  // (7d/30d/90d ou intervalo customizado) — recalcula início e duração pro
  // padrão "imediatamente anterior, mesma duração" a cada mudança; só faz
  // sentido sincronizar se a comparação já foi aberta alguma vez (compareStart
  // definido). Uma customização manual do usuário no compare-panel dura até a
  // próxima mudança do período principal, que sempre volta a sincronizar.
  const syncCompareTo = (next: Range) => {
    if (compareStart == null) return;
    const def = defaultCompareRange(next);
    setCompareStart(def.from);
    setCompareDays(daysBetween(def.from, def.to));
  };
  const applyPreset = (days: number) => {
    setActivePreset(days);
    const next = presetRange(days);
    setRange(next);
    syncCompareTo(next);
  };
  const setFrom = (value: string) => {
    setActivePreset(null);
    setRange((prev) => {
      const next = { ...prev, from: value };
      syncCompareTo(next);
      return next;
    });
  };
  const setTo = (value: string) => {
    setActivePreset(null);
    setRange((prev) => {
      const next = { ...prev, to: value };
      syncCompareTo(next);
      return next;
    });
  };

  const seedCompareDefault = () => {
    const def = defaultCompareRange(range);
    setCompareStart(def.from);
    setCompareDays(daysBetween(def.from, def.to));
  };
  const toggleCompare = () => {
    if (!compareOpen && (compareStart == null || compareDays == null)) seedCompareDefault();
    setCompareOpen((v) => !v);
  };

  const { data, loading, error } = useAsync<AnalyticsOverview>(
    () => fetchOverview(range, platform, topN),
    [range.from, range.to, platform, topN],
  );
  const { data: compareData, loading: compareLoading } = useAsync<AnalyticsOverview | null>(
    () => (compareRange ? fetchOverview(compareRange, platform, topN) : Promise.resolve(null)),
    [compareRange?.from, compareRange?.to, platform, topN],
  );

  const showFullLoading = loading && !data;
  const isRefetching = (loading || compareLoading) && !!data;
  const chartKey = data
    ? `${data.date_from}_${data.date_to}_${platform}_${topN}_${compareData ? `${compareData.date_from}_${compareData.date_to}` : 'none'}`
    : 'loading';

  const q = filterText.trim().toLowerCase();
  const matches = (label: string) => !q || label.toLowerCase().includes(q);

  const screenRows = data
    ? [...data.top_screens]
        .sort((a, b) => (sortScreensBy === 'time' ? b.avg_duration_seconds - a.avg_duration_seconds : b.views - a.views))
        .filter((s) => matches(screenLabel(s.screen)))
    : [];
  const compareScreens = new Map((compareData?.top_screens ?? []).map((s) => [s.screen, s.avg_duration_seconds]));
  const screenItems: BarItem[] = withCompare(
    screenRows.map((s) => ({
      key: s.screen,
      label: screenLabel(s.screen),
      value: sortScreensBy === 'time' ? s.avg_duration_seconds : s.views,
      display: `${fmtDuration(s.avg_duration_seconds)} · ${s.views}x`,
    })),
    sortScreensBy === 'time' ? compareScreens : new Map(),
  );

  const compareExits = new Map((compareData?.top_exit_screens ?? []).map((s) => [s.screen, s.exits]));
  const exitItems: BarItem[] = data
    ? withCompare(
        data.top_exit_screens
          .filter((s) => matches(screenLabel(s.screen)))
          .map((s) => ({ key: s.screen, label: screenLabel(s.screen), value: s.exits, display: `${s.exits}x` })),
        compareExits,
      )
    : [];

  const compareClicks = new Map((compareData?.top_clicks ?? []).map((c) => [`${c.label}-${c.screen ?? ''}`, c.count]));
  const clickItems: BarItem[] = data
    ? withCompare(
        data.top_clicks
          .map((c, i) => ({
            key: `${c.label}-${c.screen ?? ''}-${i}`,
            matchKey: `${c.label}-${c.screen ?? ''}`,
            label: [CLICK_LABEL[c.label] ?? c.label, c.screen ? screenLabel(c.screen) : null].filter(Boolean).join(' · '),
            value: c.count,
            display: `${c.count}x`,
          }))
          .filter((c) => matches(c.label))
          .map(({ matchKey, ...rest }) => ({ ...rest, compareValue: compareClicks.get(matchKey) })),
        new Map(),
      )
    : [];

  const compareSearches = new Map((compareData?.top_searches ?? []).map((s) => [s.query, s.count]));
  const searchItems: BarItem[] = data
    ? withCompare(
        data.top_searches
          .filter((s) => matches(s.query))
          .map((s, i) => ({ key: `${s.query}-${i}`, label: s.query, value: s.count, display: `${s.count}x` })),
        compareSearches,
      )
    : [];

  const insights: string[] = [];
  if (data) {
    const activeDelta = deltaPct(data.active_users, compareData?.active_users);
    insights.push(
      `Usuários ativos: ${data.active_users}${activeDelta != null ? ` (${activeDelta >= 0 ? '+' : ''}${Math.round(activeDelta)}% vs período anterior)` : ''}.`,
    );
    if (data.new_users + data.returning_users > 0) {
      const newPct = Math.round((data.new_users / (data.new_users + data.returning_users)) * 100);
      insights.push(`${newPct}% dos usuários ativos são novos (primeira vez no período).`);
    }
    const [topScreen] = [...data.top_screens].sort((a, b) => b.avg_duration_seconds - a.avg_duration_seconds);
    if (topScreen) {
      insights.push(`Onde os vizinhos mais ficam: ${screenLabel(topScreen.screen)}, em média ${fmtDuration(topScreen.avg_duration_seconds)} por visita.`);
    }
    const [topExit] = data.top_exit_screens;
    if (topExit) insights.push(`Tela onde o app mais fecha: ${screenLabel(topExit.screen)}, ${topExit.exits}x no período.`);
    const [topClick] = data.top_clicks;
    if (topClick) insights.push(`Ação mais feita: ${CLICK_LABEL[topClick.label] ?? topClick.label}, ${topClick.count}x.`);
    const [topSearch] = data.top_searches;
    if (topSearch) insights.push(`Busca mais frequente: "${topSearch.query}", ${topSearch.count}x.`);
  }

  return (
    <div>
      <div className="filters">
        <Field label="De">
          <input type="date" value={range.from} max={range.to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Até">
          <input type="date" value={range.to} min={range.from} max={isoDate(new Date())} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div className="presets">
          {PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              className={`preset${activePreset === days ? ' active' : ''}`}
              onClick={() => applyPreset(days)}
            >
              {days}d
            </button>
          ))}
        </div>
        <Field label="Plataforma">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORM_FILTERS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Top">
          <select value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
            {TOP_N_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Filtrar listas">
          <input placeholder="Nome da tela, ação, busca..." value={filterText} onChange={(e) => setFilterText(e.target.value)} />
        </Field>
        <button type="button" className={`btn compare-toggle${compareOpen ? ' active' : ''}`} onClick={toggleCompare}>
          {compareOpen ? 'Comparando período' : 'Comparar período'}
        </button>
      </div>

      {compareOpen && compareStart && compareDays && (
        <div className="compare-panel">
          <div className="compare-panel-head">
            <div className="compare-panel-icon">
              <Icon name="barChart" size={18} />
            </div>
            <div>
              <strong>Período de comparação</strong>
              <span>Compare os resultados com outro intervalo.</span>
            </div>
          </div>

          <div className={`compare-panel-controls${isComparingPreviousPeriod ? '' : ' has-reset'}`}>
            <Field label="Data inicial">
              <input type="date" value={compareStart} onChange={(e) => setCompareStart(e.target.value)} />
            </Field>
            <Field label="Duração">
              <div className="compare-duration-input">
                <input
                  type="number"
                  min={1}
                  max={365}
                  aria-label="Duração da comparação em dias"
                  value={compareDays}
                  onChange={(e) => setCompareDays(Math.max(1, Number(e.target.value) || 1))}
                />
                <span>dias</span>
              </div>
            </Field>
            <div className="compare-range-summary" aria-live="polite">
              <span>Intervalo selecionado</span>
              <strong>
                {fmtFullDate(compareStart)} – {fmtFullDate(addDays(compareStart, compareDays - 1))}
              </strong>
            </div>
            {!isComparingPreviousPeriod && (
              <button type="button" className="btn compare-reset" onClick={seedCompareDefault}>
                <Icon name="clock" size={15} />
                Usar período anterior
              </button>
            )}
          </div>
        </div>
      )}

      {showFullLoading && <LoadingState />}
      {!showFullLoading && error && <EmptyState>{error}</EmptyState>}

      {!showFullLoading && !error && data && (
        <div className={`analytics-body${isRefetching ? ' is-refetching' : ''}`}>
          {insights.length > 0 && (
            <div className="insights" key={`insights-${chartKey}`}>
              <h3>Insights do período</h3>
              <ul>
                {insights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="stats">
            <Stat value={fmtCompact(data.active_users)} label="Usuários ativos" delta={statDelta(data.active_users, compareData?.active_users)} />
            <Stat value={fmtCompact(data.total_sessions)} label="Sessões" delta={statDelta(data.total_sessions, compareData?.total_sessions)} />
            <Stat
              value={fmtDuration(data.avg_session_duration_seconds)}
              label="Duração média de sessão"
              delta={statDelta(data.avg_session_duration_seconds, compareData?.avg_session_duration_seconds)}
            />
            <Stat
              value={data.avg_screens_per_session.toFixed(1)}
              label="Telas por sessão"
              delta={statDelta(data.avg_screens_per_session, compareData?.avg_screens_per_session)}
            />
            <Stat value={fmtCompact(data.total_searches)} label="Buscas realizadas" delta={statDelta(data.total_searches, compareData?.total_searches)} />
            <Stat value={fmtCompact(data.total_clicks)} label="Cliques totais" delta={statDelta(data.total_clicks, compareData?.total_clicks)} />
          </div>

          <div className="chart-card">
            <h3>Usuários ativos por dia</h3>
            <TrendLine
              key={chartKey}
              points={denseDailySeries(range, data.daily_active_users)}
              comparePoints={compareData && compareRange ? denseDailySeries(compareRange, compareData.daily_active_users) : undefined}
              valueSuffix=" usuários"
            />
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <h3>Atividade por hora do dia</h3>
              <HourlyBars key={chartKey} data={data.hourly_activity} compareData={compareData?.hourly_activity} />
            </div>

            <div className="chart-card">
              <h3>Por plataforma</h3>
              <PlatformBars
                key={chartKey}
                data={data.platform_breakdown}
                compareData={compareData?.platform_breakdown}
                labelFor={(p) => PLATFORM_LABEL[p] ?? p}
              />
            </div>

            <div className="chart-card">
              <h3>Novos vs recorrentes</h3>
              <SplitBar
                key={chartKey}
                newCount={data.new_users}
                returningCount={data.returning_users}
                compareNewCount={compareData?.new_users}
                compareReturningCount={compareData?.returning_users}
              />
            </div>

            <div className="chart-card">
              <div className="card-head" style={{ marginBottom: 14 }}>
                <h3 className="grow" style={{ marginBottom: 0 }}>
                  Telas mais visitadas
                </h3>
                <Tabs
                  value={sortScreensBy}
                  options={[
                    { key: 'time', label: 'Por tempo' },
                    { key: 'views', label: 'Por visitas' },
                  ]}
                  onChange={setSortScreensBy}
                />
              </div>
              <BarList key={chartKey} empty="Sem dados no período." items={screenItems} />
            </div>

            <div className="chart-card">
              <h3>Onde o app mais fecha</h3>
              <BarList key={chartKey} empty="Sem dados no período." items={exitItems} />
            </div>

            <div className="chart-card">
              <h3>Ações mais clicadas</h3>
              <BarList key={chartKey} empty="Sem dados no período." items={clickItems} />
            </div>

            <div className="chart-card">
              <h3>Buscas mais frequentes</h3>
              <BarList key={chartKey} empty="Sem dados no período." items={searchItems} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
