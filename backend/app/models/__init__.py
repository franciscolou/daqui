"""Importa todo módulo de app/models/ só pelo efeito colateral de registrar
as classes no Base.registry do SQLAlchemy.

Necessário porque relationship() resolve referência entre models por nome de
classe em string (ex.: Post -> "Comment") — se o processo nunca importou o
módulo que define aquela classe, a resolução falha na primeira query,
mesmo que ninguém tenha pedido nada relacionado a ela. Descoberta automática
em vez de listar cada módulo à mão: a lista manual anterior parou em 4 dos 19
arquivos de models que existem hoje (ninguém lembrou de atualizá-la conforme
o projeto cresceu) e só quebrava um script rodado isolado — `python -m
app.seed_X` — batendo em "NameError: name 'Comment' is not defined" na
primeira query, por nada no import chain daquele script carregar
app/models/comment.py.
"""

import importlib
import pkgutil

for _module in pkgutil.iter_modules(__path__):
    importlib.import_module(f"{__name__}.{_module.name}")
