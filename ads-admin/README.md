# Daqui · Painel de Anúncios

Painel interno do time de anúncios. Fala com o **backend do Daqui** (porta 8000, rotas
`/ads-admin/*`), com login próprio de `AdAdmin` — separado das contas do app Daqui (`User`).

App React + TypeScript, build com Vite.

## Como rodar

1. Suba o backend (porta 8000). Seed inicial, se ainda não fez:
   ```bash
   cd ../backend
   .venv/bin/python -m app.seed_ads_admin   # login: ads@daqui.com / senha123
   .venv/bin/python -m app.seed_ads_plans
   ```
2. Instale e suba o painel:
   ```bash
   npm install
   npm run dev     # http://localhost:8091
   ```
3. No painel, confirme o "Servidor" (padrão `http://localhost:8000/api/v1`) e faça login.

`./dev.sh` na raiz do repositório sobe tudo de uma vez.

## Build de produção

```bash
npm run build     # typecheck + bundle em dist/
npm run preview   # serve o dist/ localmente
```

Para apontar um `dist/` já publicado pra outro ambiente sem recompilar, copie
`config.example.js` para `public/config.js` (gitignored) e ajuste `API_URL`/`APP_URL`.

## Componentes de local vindos do app Daqui

Os campos de local **não são reimplementados aqui**: o painel importa os componentes que já
funcionam no app (aba "Novo post"), via `react-native-web`.

| Campo | Componente | Fonte de dados |
| --- | --- | --- |
| Localização do pin do anúncio | `LocationAutocompleteInput` + `LocationPickerModal` | `/ads-admin/geo/search` (Nominatim + HERE, com cache) |
| Bairros da segmentação | `NeighborhoodPicker` + `NeighborhoodMapPickerModal` | Nominatim puro (busca e reverso) |
| Cidade / cidades | `CityPicker` | Nominatim puro |

O que faz isso funcionar (ver `vite.config.ts`):

- alias `react-native` → `react-native-web`, e `@daqui` → `../frontend`;
- `resolve.extensions` com `.web.tsx`/`.web.ts` na frente, como o Metro faz no `expo start --web`;
- `@expo/vector-icons` apontado para `src/daqui/vectorIcons.tsx` — os mesmos Ionicons (fonte e
  glyphmap saem do pacote original), sem arrastar o runtime do Expo pro bundle.

Os componentes pedem o backend de geocodificação a um contexto (`frontend/lib/geoProvider.tsx`)
em vez de importarem o cliente do app: aqui o `DaquiProviders` liga esse contexto a
`/ads-admin/geo/search` e libera o pin em qualquer ponto do país (no app, o local fica restrito
ao bairro do usuário).

## Seções

- **Campanhas** — lista com busca por anunciante/título, filtro por status, pausar/reativar,
  marcar como paga, copiar o link do painel do anunciante e abrir detalhes (analytics por
  horário + gestão de criativos/teste A-B).
- **Analytics** — visão agregada com filtros de período/anunciante/status, insights, séries
  por dia e quebras por formato, objetivo, categoria e bairro.
- **Nova proposta** — proposta manual (negociada por fora) com cotação em tempo real da engine
  de preços; nasce "aguardando pagamento" com link de pagamento na hora.
- **Planos** — o que o anunciante vê em "Anuncie no Daqui", por categoria; criar, ocultar e excluir.
- **Equipe** (Administrador/Owner) — contas de staff do painel.
- **Segurança** — A2F da própria conta.
- **Configurações** — multiplicador geral de preço.
