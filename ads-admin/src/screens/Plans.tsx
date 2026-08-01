import { useMemo, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { fmtMoney } from '../lib/format';
import { ALL_FORMATS, FORMAT_LABEL, PLAN_CATEGORIES } from '../lib/labels';
import { Plan } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useDialogs } from '../ui/dialogs';
import { Icon } from '../ui/Icon';
import { Badge, CheckPill, EmptyState, Field, LoadingState, Tabs } from '../ui/primitives';

// Planos são o que o anunciante vê em "Anuncie no Daqui": a coluna da
// esquerda mostra o que está publicado, a da direita cria um novo.

function describePlanGeo(p: Plan): string {
  if (p.geo_scope === 'country') return 'Brasil todo';
  if (p.geo_scope === 'cities') {
    return p.max_cities ? `até ${p.max_cities} cidades` : 'várias cidades';
  }
  if (p.geo_scope === 'citywide') return 'cidade toda';
  return p.max_neighborhoods ? `${p.max_neighborhoods} bairro(s)` : 'cidade toda';
}

export function Plans() {
  const dialogs = useDialogs();
  const { data, loading, error, reload } = useAsync<Plan[]>(() => api.get<Plan[]>('/admin/ads/plans'));
  const plans = useMemo(() => data ?? [], [data]);

  const tabs = useMemo(() => {
    const hasOther = plans.some((p) => !PLAN_CATEGORIES.some((c) => c.key === p.category));
    return hasOther ? [...PLAN_CATEGORIES, { key: '__other', label: 'Outros' }] : PLAN_CATEGORIES;
  }, [plans]);

  const [category, setCategory] = useState(PLAN_CATEGORIES[0].key);
  const activeCategory = tabs.some((t) => t.key === category) ? category : tabs[0].key;

  const visible = plans.filter((p) =>
    activeCategory === '__other'
      ? !PLAN_CATEGORIES.some((c) => c.key === p.category)
      : p.category === activeCategory,
  );

  const toggleVisibility = async (p: Plan) => {
    try {
      await api.patch(`/admin/ads/plans/${p.id}`, { is_public: !p.is_public });
      await reload();
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  const remove = async (p: Plan) => {
    const ok = await dialogs.confirm(
      `Excluir o plano "${p.name}"? Essa ação não pode ser desfeita.`,
      { title: 'Excluir plano', confirmLabel: 'Excluir' },
    );
    if (!ok) return;
    try {
      await api.del(`/admin/ads/plans/${p.id}`);
      await reload();
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  return (
    <div className="charts-grid" style={{ alignItems: 'start', marginTop: 0 }}>
      <div className="form-card">
        <header>
          <h2>Planos exibidos atualmente</h2>
          <span className="muted">
            Como aparecem para o anunciante em &quot;Anuncie no Daqui&quot;, por categoria.
          </span>
        </header>

        <Tabs value={activeCategory} options={tabs} onChange={setCategory} />

        {loading && <LoadingState />}
        {!loading && error && <EmptyState>{error}</EmptyState>}
        {!loading && !error && visible.length === 0 && (
          <EmptyState>Nenhum plano nesta categoria.</EmptyState>
        )}

        {!loading &&
          visible.map((p) => (
            <div key={p.id} className="card" style={{ opacity: p.is_public ? 1 : 0.65 }}>
              <div className="card-head">
                <div className="grow">
                  <div className="card-title">{p.name}</div>
                  <div className="card-sub">{p.slug}</div>
                </div>
                {p.badge && <Badge tone="green">{p.badge}</Badge>}
                {!p.is_public && <Badge>Oculto</Badge>}
                <div className="card-when">{fmtMoney(p.price_cents)}</div>
              </div>

              <div className="tag-row">
                {p.formats.map((f) => (
                  <span key={f} className="tag">
                    {FORMAT_LABEL[f] || f}
                  </span>
                ))}
              </div>

              <div className="card-text">{p.description}</div>

              <div className="meta-row">
                <span>
                  {p.duration_days} dias · {describePlanGeo(p)}
                </span>
                <span className="spacer" />
                <button
                  type="button"
                  className="icon-btn bare"
                  title={p.is_public ? 'Ocultar' : 'Tornar visível'}
                  aria-label={p.is_public ? 'Ocultar' : 'Tornar visível'}
                  onClick={() => toggleVisibility(p)}
                >
                  <Icon name={p.is_public ? 'eyeOff' : 'eye'} size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn bare danger"
                  title="Excluir"
                  aria-label="Excluir"
                  onClick={() => remove(p)}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
      </div>

      <NewPlanForm onCreated={reload} />
    </div>
  );
}

const EMPTY_PLAN = {
  name: '',
  slug: '',
  description: '',
  price: '',
  duration: '15',
  geoScope: 'neighborhood',
  maxNeighborhoods: '',
  maxCities: '',
  sortOrder: '0',
  category: '',
  badge: '',
};

function NewPlanForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [draft, setDraft] = useState(EMPTY_PLAN);
  const [formats, setFormats] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof EMPTY_PLAN, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await api.post('/admin/ads/plans', {
        name: draft.name.trim(),
        slug: draft.slug.trim(),
        description: draft.description.trim(),
        price_cents: Math.round(parseFloat(draft.price || '0') * 100),
        duration_days: parseInt(draft.duration, 10),
        formats,
        geo_scope: draft.geoScope,
        max_neighborhoods:
          draft.geoScope === 'neighborhood' && draft.maxNeighborhoods
            ? parseInt(draft.maxNeighborhoods, 10)
            : null,
        max_cities:
          draft.geoScope === 'cities' && draft.maxCities ? parseInt(draft.maxCities, 10) : null,
        sort_order: parseInt(draft.sortOrder || '0', 10),
        category: draft.category || null,
        badge: draft.badge.trim() || null,
      });
      setDraft(EMPTY_PLAN);
      setFormats([]);
      await onCreated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-card">
      <header>
        <h2>Novo plano</h2>
      </header>

      <div className="stack">
        <div className="row-2">
          <Field label="Nome">
            <input value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Slug">
            <input
              placeholder="ex.: bairro-basico"
              value={draft.slug}
              onChange={(e) => set('slug', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Descrição">
          <textarea value={draft.description} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <div className="row-2">
          <Field label="Preço (R$)">
            <input
              type="number"
              step="0.01"
              min={0}
              value={draft.price}
              onChange={(e) => set('price', e.target.value)}
            />
          </Field>
          <Field label="Duração (dias)">
            <input
              type="number"
              min={1}
              value={draft.duration}
              onChange={(e) => set('duration', e.target.value)}
            />
          </Field>
        </div>

        <Field label="Formatos">
          <div className="checks">
            {ALL_FORMATS.map((f) => (
              <CheckPill
                key={f}
                checked={formats.includes(f)}
                onChange={(on) =>
                  setFormats((prev) => (on ? [...prev, f] : prev.filter((x) => x !== f)))
                }
              >
                {FORMAT_LABEL[f]}
              </CheckPill>
            ))}
          </div>
        </Field>

        <Field label="Escopo geográfico">
          <select value={draft.geoScope} onChange={(e) => set('geoScope', e.target.value)}>
            <option value="neighborhood">Bairros (limitado por &quot;Máx. de bairros&quot;)</option>
            <option value="citywide">Cidade toda</option>
            <option value="cities">
              Várias cidades (limitado por &quot;Máx. de cidades&quot;)
            </option>
            <option value="country">Brasil todo</option>
          </select>
        </Field>

        <div className="row-2">
          {draft.geoScope === 'neighborhood' && (
            <Field label="Máx. de bairros">
              <input
                type="number"
                min={1}
                value={draft.maxNeighborhoods}
                onChange={(e) => set('maxNeighborhoods', e.target.value)}
              />
            </Field>
          )}
          {draft.geoScope === 'cities' && (
            <Field label="Máx. de cidades">
              <input
                type="number"
                min={1}
                value={draft.maxCities}
                onChange={(e) => set('maxCities', e.target.value)}
              />
            </Field>
          )}
          <Field label="Ordem de exibição">
            <input
              type="number"
              value={draft.sortOrder}
              onChange={(e) => set('sortOrder', e.target.value)}
            />
          </Field>
        </div>

        <div className="row-2">
          <Field label="Categoria (tela de anúncios)">
            <select value={draft.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">Sem categoria</option>
              {PLAN_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Selo (opcional)">
            <input
              placeholder="Mais popular"
              value={draft.badge}
              onChange={(e) => set('badge', e.target.value)}
            />
          </Field>
        </div>

        <button type="button" className="btn primary lg block" disabled={busy} onClick={submit}>
          Criar plano
        </button>

        {error && <div className="err">{error}</div>}
      </div>
    </div>
  );
}
