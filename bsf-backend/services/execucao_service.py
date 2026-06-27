"""
Camada de regras de negócio para o histórico de execuções do pipeline.

Cada vez que o orquestrador roda um plano (executar_full ou
executar_update), um registro é gravado em data/execucoes.json com:
início, fim, duração, status final (done/error/interrompido) e a
contagem de registros do resultado, quando disponível.

Não guarda o log de texto da execução — só os metadados agregados,
suficientes para alimentar o histórico exibido no Dashboard.
"""
import os
import time

import pandas as pd

from services.storage import read_json, write_json

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "execucoes.json")

# Mantém um número razoável de registros — histórico recente é o que
# importa para o Dashboard; evita o arquivo crescer indefinidamente.
MAX_REGISTROS = 500


def _next_id(items: list) -> int:
    return max([item.get("id", 0) for item in items], default=0) + 1


def listar_execucoes(plano_id: int = None, limite: int = None) -> list:
    """
    Lista o histórico de execuções, mais recente primeiro. Filtra por
    plano_id quando informado. `limite` corta a quantidade retornada
    (útil para o Dashboard, que só precisa dos últimos dias).
    """
    items = read_json(DATA_PATH, default=[])
    items = sorted(items, key=lambda e: e.get("iniciadoEm", 0), reverse=True)

    if plano_id is not None:
        items = [e for e in items if e.get("planoId") == plano_id]

    if limite is not None:
        items = items[:limite]

    return items


def _contar_registros(nome_plano: str, slugify_fn) -> int:
    """Conta as linhas do rais_caged.csv gerado, se existir."""
    try:
        outputs_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")
        caminho = os.path.join(outputs_dir, slugify_fn(nome_plano), "rais_caged.csv")
        if not os.path.isfile(caminho):
            return None
        df = pd.read_csv(caminho, sep=";", dtype=str)
        return len(df)
    except Exception:
        return None


def registrar_inicio(plano_id: int, plano_nome: str, modo: str) -> int:
    """
    Registra o início de uma execução. Retorna o id do registro, usado
    depois em registrar_fim() para completá-lo.
    """
    items = read_json(DATA_PATH, default=[])
    novo_id = _next_id(items)

    items.append({
        "id": novo_id,
        "planoId": plano_id,
        "planoNome": plano_nome,
        "modo": modo,
        "status": "running",
        "iniciadoEm": time.time(),
        "finalizadoEm": None,
        "duracaoSegundos": None,
        "registros": None,
    })

    if len(items) > MAX_REGISTROS:
        items = sorted(items, key=lambda e: e.get("iniciadoEm", 0))[-MAX_REGISTROS:]

    write_json(DATA_PATH, items)
    return novo_id


def registrar_fim(execucao_id: int, status: str, nome_plano: str = None, slugify_fn=None) -> None:
    """
    Completa um registro de execução já iniciado. status: "done",
    "error" ou "idle" (interrompido pelo usuário).
    """
    items = read_json(DATA_PATH, default=[])
    registro = next((e for e in items if e["id"] == execucao_id), None)
    if registro is None:
        return

    agora = time.time()
    registro["status"] = status
    registro["finalizadoEm"] = agora
    registro["duracaoSegundos"] = round(agora - registro["iniciadoEm"], 1)

    if status == "done" and nome_plano and slugify_fn:
        registro["registros"] = _contar_registros(nome_plano, slugify_fn)

    write_json(DATA_PATH, items)