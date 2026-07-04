# Daqui · App de Moderação

Frontend **separado** (independente do app Daqui) para moderar as avaliações do app.
Compartilha o mesmo backend FastAPI — consome as rotas `/admin/reviews` (restritas a moderadores).

É um único `index.html` estático, sem build.

## Como rodar

1. Suba o backend do Daqui (porta 8000).
2. Garanta uma conta de moderador:
   ```bash
   cd ../backend && .venv/bin/python -m app.seed_moderator
   # login: moderador@daqui.com / senha123
   ```
3. Abra o painel. Ou abra `index.html` direto no navegador, ou sirva estático:
   ```bash
   cd moderator && python3 -m http.server 8090
   # depois acesse http://localhost:8090
   ```
4. No painel, confirme o "Servidor da API" (padrão `http://localhost:8000/api/v1`) e faça login com a conta de moderador.

## O que dá pra fazer
- Ver estatísticas (total, nota média, pendentes).
- Filtrar por status (todas / pendentes / aprovadas / rejeitadas).
- Aprovar, rejeitar ou excluir cada avaliação.

Só contas com `is_moderator = true` conseguem acessar; as demais recebem 403.
