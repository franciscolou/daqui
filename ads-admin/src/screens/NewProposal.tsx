import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import NeighborhoodPicker from '@daqui/components/NeighborhoodPicker';
import CityPicker from '@daqui/components/CityPicker';
import AdAdvancedSelectors from '@daqui/components/AdAdvancedSelectors';
import StartDatePicker from '@daqui/components/StartDatePicker';
import { api, errorMessage } from '../lib/api';
import { APP_URL } from '../lib/config';
import { fmtMoney, maskDocument } from '../lib/format';
import { ALL_FORMATS, FORMAT_LABEL, GEO_SCOPES, GeoScope, OBJECTIVE_LABEL } from '../lib/labels';
import { CheckPill, CollapseSection, CopyButton, Field } from '../ui/primitives';

// Proposta manual: campanha negociada por fora (Instagram/WhatsApp/Gmail) que
// nasce "aguardando conteúdo" — o moderador define só a parte comercial; o
// conteúdo criativo é preenchido depois pelo próprio anunciante, através do
// link do painel dele (mesmo link de "Copiar link do anunciante" em
// Campaigns.tsx).

interface AdvancedState {
  objective: string;
  priority: string;
  rotationWeight: string;
  perUserCap: string;
  audience: string;
  recency: string;
  includeNearby: boolean;
  engagementActive: boolean;
  categories: string[];
  hours: number[] | null;
  daysOfWeek: number[] | null;
  specialDates: string[];
}

const INITIAL_ADVANCED: AdvancedState = {
  objective: 'clicks',
  priority: '3',
  rotationWeight: '1.0',
  perUserCap: '',
  audience: 'all',
  recency: 'all',
  includeNearby: false,
  engagementActive: false,
  categories: [],
  hours: null,
  daysOfWeek: null,
  specialDates: [],
};

function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + days);
  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('-');
}

export function NewProposal() {
  const [advertiserType, setAdvertiserType] = useState<'individual' | 'company'>('individual');
  const [document, setDocument] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [formats, setFormats] = useState<string[]>([]);
  const [duration, setDuration] = useState('15');
  // 'YYYY-MM-DD', ou null = imediatamente (assim que a proposta virar paga).
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [price, setPrice] = useState('');

  const [geoScope, setGeoScope] = useState<GeoScope>('neighborhood');
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [city, setCity] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  const [advanced, setAdvanced] = useState<AdvancedState>(INITIAL_ADVANCED);

  const [suggested, setSuggested] = useState<number | null>(null);
  const [advertiserLink, setAdvertiserLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const campaignStart = useMemo(() => startsAt ?? todayDateString(), [startsAt]);
  const campaignEnd = useMemo(() => {
    const durationDays = Math.max(1, parseInt(duration, 10) || 1);
    return addDaysToDateString(campaignStart, durationDays - 1);
  }, [campaignStart, duration]);

  // Uma mudança no início ou na duração pode invalidar datas especiais já
  // escolhidas. Mantemos somente as que ainda pertencem à janela da campanha.
  useEffect(() => {
    setAdvanced((prev) => {
      const specialDates = prev.specialDates.filter(
        (date) => date >= campaignStart && date <= campaignEnd,
      );
      return specialDates.length === prev.specialDates.length ? prev : { ...prev, specialDates };
    });
  }, [campaignStart, campaignEnd]);

  const setAdv = <K extends keyof AdvancedState>(key: K, value: AdvancedState[K]) =>
    setAdvanced((prev) => ({ ...prev, [key]: value }));

  const toggleFormat = (f: string, on: boolean) =>
    setFormats((prev) => (on ? [...prev, f] : prev.filter((x) => x !== f)));

  const payload = useMemo(() => {
    const scopedNeighborhoods = geoScope === 'neighborhood' ? neighborhoods : [];
    const scopedCity = geoScope === 'citywide' ? city[0] ?? null : null;
    const scopedCities = geoScope === 'cities' ? cities : [];
    const priceRaw = price.trim();

    return {
      formats,
      duration_days: parseInt(duration, 10),
      starts_at: startsAt || null,
      geo_scope: geoScope,
      neighborhoods: scopedNeighborhoods,
      city: scopedCity,
      cities: scopedCities,
      advertiser_name: name.trim(),
      advertiser_email: email.trim(),
      advertiser_phone: phone.trim(),
      advertiser_type: advertiserType,
      advertiser_document: document.trim(),
      // Vazio = a engine calcula (ver "Sugerido"); preenchido = admin sobrescreve.
      price_cents: priceRaw ? Math.round(parseFloat(priceRaw) * 100) : null,
      objective: advanced.objective,
      priority: parseInt(advanced.priority || '3', 10),
      rotation_weight: parseFloat(advanced.rotationWeight || '1'),
      per_user_impression_cap: advanced.perUserCap ? parseInt(advanced.perUserCap, 10) : null,
      targeting: {
        geo_scope: geoScope,
        neighborhoods: scopedNeighborhoods,
        city: scopedCity,
        cities: scopedCities,
        include_nearby: advanced.includeNearby,
        audience: advanced.audience,
        categories: advanced.categories,
        user_recency: advanced.recency,
        engagement: advanced.engagementActive ? 'active' : 'any',
      },
      schedule: {
        hours: advanced.hours,
        days_of_week: advanced.daysOfWeek,
        special_dates: advanced.specialDates,
      },
    };
  }, [
    formats, duration, startsAt, geoScope, neighborhoods, city, cities, name, email, phone,
    advertiserType, document, price, advanced,
  ]);

  // Preço sugerido pela engine, recalculado (debounced) sempre que algo que
  // entra no cálculo muda — mesmo padrão de cotação em tempo real da tela de
  // personalização do app.
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    if (!payload.formats.length || !payload.duration_days) {
      setSuggested(null);
      return;
    }
    quoteTimer.current = setTimeout(() => {
      api
        .post<{ price_cents: number }>('/ads/quote', payload)
        .then((q) => setSuggested(q.price_cents))
        .catch(() => setSuggested(null));
    }, 400);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [payload]);

  const submit = async () => {
    setError('');
    setAdvertiserLink('');
    setBusy(true);
    try {
      const res = await api.post<{ access_token: string }>('/admin/ads/campaigns', payload);
      setAdvertiserLink(`${APP_URL}/advertise/dashboard/${res.access_token}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const isPj = advertiserType === 'company';
  const suggestedText = suggested != null ? `Sugerido: ${fmtMoney(suggested)}` : '';

  return (
    <div className="form-card">
      <header>
        <h2>Inserir proposta manual</h2>
        <span className="muted">
          Para propostas negociadas por Instagram/WhatsApp/Gmail — defina aqui só a parte
          comercial (preço, duração, formatos, segmentação). A campanha nasce &quot;aguardando
          conteúdo&quot;: envie o link do anunciante pra ele preencher o criativo do próprio
          anúncio e seguir pro pagamento.
        </span>
      </header>

      <div className="stack">
        <div className="eyebrow">Anunciante</div>
        <div className="row-2">
          <Field label="Tipo">
            <select
              value={advertiserType}
              onChange={(e) => {
                const next = e.target.value as 'individual' | 'company';
                setAdvertiserType(next);
                setDocument((d) => maskDocument(next, d));
              }}
            >
              <option value="individual">Pessoa Física (CPF)</option>
              <option value="company">Pessoa Jurídica (CNPJ)</option>
            </select>
          </Field>
          <Field label={isPj ? 'CNPJ' : 'CPF'}>
            <input
              placeholder={isPj ? '00.000.000/0000-00' : '000.000.000-00'}
              value={document}
              onChange={(e) => setDocument(maskDocument(advertiserType, e.target.value))}
            />
          </Field>
        </div>
        <Field label="Nome / razão social">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="row-2">
          <Field label="E-mail">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Telefone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>

        <div className="divider" />

        <div className="eyebrow">Campanha</div>
        <Field label="Formatos">
          <div className="checks">
            {ALL_FORMATS.map((f) => (
              <CheckPill
                key={f}
                checked={formats.includes(f)}
                onChange={(on) => toggleFormat(f, on)}
              >
                {FORMAT_LABEL[f]}
              </CheckPill>
            ))}
          </div>
        </Field>
        <div className="row-2">
          <Field label="Duração (dias)">
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </Field>
          <Field
            label="Preço acordado (R$)"
            hint={suggestedText || 'Deixe em branco pra usar o sugerido pela engine.'}
          >
            <input
              type="number"
              step="0.01"
              min={0}
              placeholder={suggestedText || 'Sugerido: —'}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
        </div>

        <div className="daqui-field">
          <View>
            <StartDatePicker value={startsAt} onChange={setStartsAt} />
          </View>
        </div>

        <Field label="Onde anunciar">
          <select value={geoScope} onChange={(e) => setGeoScope(e.target.value as GeoScope)}>
            {GEO_SCOPES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        {/* Seletores de bairro/cidade: os MESMOS componentes do app Daqui
            (react-native-web). Bairros aceitam também seleção por etapas no
            mapa — ver NeighborhoodMapPickerModal. */}
        {geoScope === 'neighborhood' && (
          <Field label="Bairros">
            <div className="daqui-field">
              <View>
                <NeighborhoodPicker value={neighborhoods} onChange={setNeighborhoods} />
              </View>
            </div>
          </Field>
        )}
        {geoScope === 'citywide' && (
          <Field label="Cidade">
            <div className="daqui-field">
              <View>
                <CityPicker value={city} onChange={setCity} max={1} />
              </View>
            </div>
          </Field>
        )}
        {geoScope === 'cities' && (
          <Field label="Cidades">
            <div className="daqui-field">
              <View>
                <CityPicker value={cities} onChange={setCities} />
              </View>
            </div>
          </Field>
        )}

        <div className="divider" />

        <CollapseSection title="Configurações avançadas">
          <div className="row-2">
            <Field label="Objetivo">
              <select
                value={advanced.objective}
                onChange={(e) => setAdv('objective', e.target.value)}
              >
                {Object.entries(OBJECTIVE_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prioridade (1-5)">
              <input
                type="number"
                min={1}
                max={5}
                value={advanced.priority}
                onChange={(e) => setAdv('priority', e.target.value)}
              />
            </Field>
          </div>
          <div className="row-2">
            <Field label="Peso na rotação">
              <input
                type="number"
                step="0.1"
                value={advanced.rotationWeight}
                onChange={(e) => setAdv('rotationWeight', e.target.value)}
              />
            </Field>
            <Field label="Limite por usuário (opcional)">
              <input
                type="number"
                min={1}
                value={advanced.perUserCap}
                onChange={(e) => setAdv('perUserCap', e.target.value)}
              />
            </Field>
          </div>

          <div className="eyebrow">Segmentação extra</div>
          <div className="row-2">
            <Field label="Audiência">
              <select value={advanced.audience} onChange={(e) => setAdv('audience', e.target.value)}>
                <option value="all">Todos</option>
                <option value="residents">Só moradores</option>
                <option value="visitors">Só visitantes atuais</option>
              </select>
            </Field>
            <Field label="Usuários">
              <select value={advanced.recency} onChange={(e) => setAdv('recency', e.target.value)}>
                <option value="all">Todos</option>
                <option value="new">Só novos</option>
                <option value="returning">Só antigos</option>
              </select>
            </Field>
          </div>
          <div className="checks">
            <CheckPill
              checked={advanced.includeNearby}
              onChange={(v) => setAdv('includeNearby', v)}
            >
              Incluir bairros próximos
            </CheckPill>
            <CheckPill
              checked={advanced.engagementActive}
              onChange={(v) => setAdv('engagementActive', v)}
            >
              Só usuários ativos (engajamento)
            </CheckPill>
          </div>
          <div className="daqui-field">
            <View>
              <AdAdvancedSelectors
                value={{
                  categories: advanced.categories,
                  hours: advanced.hours,
                  daysOfWeek: advanced.daysOfWeek,
                  specialDates: advanced.specialDates,
                }}
                onChange={(next) => setAdvanced((prev) => ({ ...prev, ...next }))}
                minDate={campaignStart}
                maxDate={campaignEnd}
              />
            </View>
          </div>
        </CollapseSection>

        <button
          type="button"
          className="btn primary lg block"
          disabled={busy}
          onClick={submit}
        >
          Criar proposta
        </button>

        {error && <div className="err">{error}</div>}

        {advertiserLink && (
          <div className="insights">
            <strong>Proposta criada — aguardando conteúdo</strong>
            <div className="muted" style={{ margin: '6px 0 10px' }}>
              Envie o link do anunciante pra ele ver as condições e preencher o criativo do
              próprio anúncio. Depois disso ele segue pro pagamento — confirme manualmente em
              &quot;Campanhas&quot; se o pagamento cair combinado por fora.
            </div>
            <CopyButton text={advertiserLink} label="Copiar link do anunciante" icon />
          </div>
        )}
      </div>
    </div>
  );
}
