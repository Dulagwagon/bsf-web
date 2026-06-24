"""
Camada de regras de negócio para o recurso CNAEs.
Lida com validação, normalização e persistência no arquivo data/cnaes.json.
"""
import os
import re

from services.storage import read_json, write_json

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "cnaes.json")

CODIGO_RE = re.compile(r"^\d{7}$")
SECOES_VALIDAS = set("ABCDEFGHIJKLMNOPQRS")


class CnaeValidationError(Exception):
    """Erro de validação de dados de um CNAE."""
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def _normalize_codigo(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


def _next_id(items: list) -> int:
    return max([item.get("id", 0) for item in items], default=0) + 1


def list_cnaes() -> list:
    return read_json(DATA_PATH, default=[])


def get_cnae(cnae_id: int):
    items = list_cnaes()
    return next((c for c in items if c["id"] == cnae_id), None)


def _validate_payload(payload: dict, items: list, ignore_id: int = None) -> dict:
    codigo = _normalize_codigo(payload.get("codigo", ""))
    descricao = str(payload.get("descricao", "")).strip()
    secao = str(payload.get("secao", "") or "").strip().upper()

    if not CODIGO_RE.match(codigo):
        raise CnaeValidationError("Código inválido. Use 7 dígitos numéricos, sem máscara (ex: 6201501).")

    if not descricao:
        raise CnaeValidationError("Descrição é obrigatória.")

    if secao and secao not in SECOES_VALIDAS:
        raise CnaeValidationError(f"Seção '{secao}' inválida.")

    duplicate = next(
        (c for c in items if c["codigo"] == codigo and c.get("id") != ignore_id),
        None,
    )
    if duplicate:
        raise CnaeValidationError(f"O código {codigo} já está cadastrado.")

    return {"codigo": codigo, "descricao": descricao, "secao": secao}


def create_cnae(payload: dict) -> dict:
    items = list_cnaes()
    clean = _validate_payload(payload, items)
    new_item = {"id": _next_id(items), **clean}
    items.append(new_item)
    write_json(DATA_PATH, items)
    return new_item


def update_cnae(cnae_id: int, payload: dict) -> dict:
    items = list_cnaes()
    existing = next((c for c in items if c["id"] == cnae_id), None)
    if existing is None:
        raise CnaeValidationError("CNAE não encontrado.")

    clean = _validate_payload(payload, items, ignore_id=cnae_id)
    existing.update(clean)
    write_json(DATA_PATH, items)
    return existing


def delete_cnae(cnae_id: int) -> bool:
    items = list_cnaes()
    filtered = [c for c in items if c["id"] != cnae_id]
    if len(filtered) == len(items):
        return False
    write_json(DATA_PATH, filtered)
    return True


def import_cnaes(payload_list: list) -> dict:
    """
    Importa uma lista de CNAEs, ignorando códigos já existentes.
    Retorna um resumo: {"added": N, "skipped": M}
    """
    items = list_cnaes()
    existing_codes = {c["codigo"] for c in items}
    added = 0
    skipped = 0

    for raw in payload_list:
        try:
            codigo = _normalize_codigo(raw.get("codigo", ""))
            descricao = str(raw.get("descricao", "")).strip()
            secao = str(raw.get("secao", "") or "").strip().upper()

            if not CODIGO_RE.match(codigo) or not descricao:
                skipped += 1
                continue
            if codigo in existing_codes:
                skipped += 1
                continue

            items.append({"id": _next_id(items), "codigo": codigo, "descricao": descricao, "secao": secao})
            existing_codes.add(codigo)
            added += 1
        except (AttributeError, TypeError):
            skipped += 1

    if added:
        write_json(DATA_PATH, items)

    return {"added": added, "skipped": skipped}
