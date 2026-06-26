"""
Camada de regras de negócio para o recurso Planos.
Lida com validação, normalização e persistência no arquivo data/planos.json.

Um Plano representa uma combinação específica de CNAEs e Municípios,
que será usada pelo pipeline de filtragem para gerar os resultados.
"""
import os
import re

from services.storage import read_json, write_json

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "planos.json")

CNAE_RE = re.compile(r"^\d{7}$")
IBGE_RE = re.compile(r"^\d{6}$")

REGIOES_VALIDAS = {"Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"}
STATUS_VALIDOS = {"idle", "running", "done", "error"}


class PlanoValidationError(Exception):
    """Erro de validação de dados de um Plano."""
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def _normalize_codigo(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


def _normalize_lista_codigos(raw_list, pattern: re.Pattern, label: str) -> list:
    """
    Normaliza e valida uma lista de códigos (CNAEs ou municípios).
    Remove duplicados preservando a ordem de inserção.
    Lança PlanoValidationError se algum código não bater com o padrão.
    """
    if raw_list is None:
        return []
    if not isinstance(raw_list, list):
        raise PlanoValidationError(f"{label} deve ser uma lista de códigos.")

    seen = set()
    result = []
    for raw in raw_list:
        codigo = _normalize_codigo(raw)
        if not pattern.match(codigo):
            raise PlanoValidationError(f"Código de {label} inválido: '{raw}'.")
        if codigo not in seen:
            seen.add(codigo)
            result.append(codigo)
    return result


def _next_id(items: list) -> int:
    return max([item.get("id", 0) for item in items], default=0) + 1


def list_planos() -> list:
    return read_json(DATA_PATH, default=[])


def get_plano(plano_id: int):
    items = list_planos()
    return next((p for p in items if p["id"] == plano_id), None)


def _validate_payload(payload: dict, items: list, ignore_id: int = None) -> dict:
    nome = str(payload.get("nome", "")).strip()
    regiao = str(payload.get("regiao", "") or "").strip()
    estado = str(payload.get("estado", "") or "").strip().upper()
    status = str(payload.get("status", "idle") or "idle").strip().lower()

    if not nome:
        raise PlanoValidationError("Nome do plano é obrigatório.")

    if not regiao:
        raise PlanoValidationError("Região é obrigatória — o pipeline precisa dela para localizar a fonte de dados.")

    if regiao not in REGIOES_VALIDAS:
        raise PlanoValidationError(f"Região '{regiao}' inválida.")

    if estado and not re.match(r"^[A-Z]{2}$", estado):
        raise PlanoValidationError(f"Estado (UF) '{estado}' inválido. Use a sigla com 2 letras.")

    if status not in STATUS_VALIDOS:
        raise PlanoValidationError(f"Status '{status}' inválido.")

    cnaes = _normalize_lista_codigos(payload.get("cnaes", []), CNAE_RE, "CNAE")
    municipios = _normalize_lista_codigos(payload.get("municipios", []), IBGE_RE, "município")

    duplicate = next(
        (p for p in items if p["nome"].lower() == nome.lower() and p.get("id") != ignore_id),
        None,
    )
    if duplicate:
        raise PlanoValidationError(f"Já existe um plano chamado '{nome}'.")

    return {
        "nome": nome,
        "regiao": regiao,
        "estado": estado,
        "cnaes": cnaes,
        "municipios": municipios,
        "status": status,
    }


def create_plano(payload: dict) -> dict:
    items = list_planos()
    clean = _validate_payload(payload, items)
    new_item = {"id": _next_id(items), "etapa_atual": None, **clean}
    items.append(new_item)
    write_json(DATA_PATH, items)
    return new_item


def update_plano(plano_id: int, payload: dict) -> dict:
    items = list_planos()
    existing = next((p for p in items if p["id"] == plano_id), None)
    if existing is None:
        raise PlanoValidationError("Plano não encontrado.")

    clean = _validate_payload(payload, items, ignore_id=plano_id)
    existing.update(clean)
    write_json(DATA_PATH, items)
    return existing


def delete_plano(plano_id: int) -> bool:
    items = list_planos()
    filtered = [p for p in items if p["id"] != plano_id]
    if len(filtered) == len(items):
        return False
    write_json(DATA_PATH, filtered)
    return True


def update_status(plano_id: int, status: str, etapa_atual: str = None) -> dict:
    """
    Atualiza apenas o status (e opcionalmente a etapa atual) de um plano —
    usado pelo orquestrador para refletir o progresso da execução sem passar
    pelas validações completas do payload.

    etapa_atual é uma string livre descrevendo a etapa em andamento
    (ex: "RAIS 2022", "CAGED 2026", "Validação", "Consolidação").
    Quando status não é "running", etapa_atual é limpa automaticamente.
    """
    status = str(status or "").strip().lower()
    if status not in STATUS_VALIDOS:
        raise PlanoValidationError(f"Status '{status}' inválido.")

    items = list_planos()
    existing = next((p for p in items if p["id"] == plano_id), None)
    if existing is None:
        raise PlanoValidationError("Plano não encontrado.")

    existing["status"] = status
    existing["etapa_atual"] = etapa_atual if status == "running" else None
    write_json(DATA_PATH, items)
    return existing