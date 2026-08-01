# Daqui · Painel de Moderação

Frontend **separado** (independente do app Daqui) para moderar a comunidade.
Compartilha o mesmo backend FastAPI — consome as rotas `/admin/*`, restritas a contas com `staff_role`.

App React + TypeScript, build com Vite.

## Como rodar

1. Suba o backend do Daqui (porta 8000).
2. Garanta uma conta de moderador:
   ```bash
   cd ../backend && .venv/bin/python -m app.seed_moderator
   # login: moderador@daqui.com / senha123
   ```
3. Instale e suba o painel:
   ```bash
   npm install
   npm run dev     # http://localhost:8090
   ```
4. No painel, confirme o "Servidor da API" (padrão `http://localhost:8000/api/v1`) e a
   "URL do app Daqui" (usada nos links "ver no app"), e faça login.

`./dev.sh` na raiz do repositório sobe backend + app + este painel de uma vez.

## Build de produção

```bash
npm run build     # typecheck + bundle em dist/
npm run preview   # serve o dist/ localmente
```

Para apontar um `dist/` já publicado pra outro ambiente sem recompilar, copie
`config.example.js` para `public/config.js` (gitignored) e ajuste `API_URL`/`APP_URL`.

## O que dá pra fazer

- **Avaliações** — estatísticas (total, nota média) e exclusão de avaliações abusivas.
- **Denúncias** — filtro por status e tipo (publicação/comentário/perfil), com o conteúdo
  denunciado e seus anexos; marcar como revisada, descartar ou excluir.
- **Chamados** — responder chamados de suporte abertos no app.
- **Usuários** — buscar contas, ver posts/comentários, excluir conteúdo e suspender/reativar contas.
- **Auditoria** — registro pesquisável de toda ação da moderação.
- **Equipe** (Administrador/Owner) — criar, suspender e excluir contas de staff.
- **Segurança** — ativar/desativar a autenticação de dois fatores da própria conta.

Qualquer @usuário clicável, em qualquer seção, abre a ficha dele na aba Usuários.

Só contas com `staff_role` conseguem acessar; as demais recebem 403.
