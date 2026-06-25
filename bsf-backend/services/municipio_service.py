"""
Camada de regras de negócio para o recurso Municípios.
Lida com validação, normalização e persistência no arquivo data/municipios.json.

Cada município pertence a um estado (UF) e é identificado pelo código IBGE
de 6 dígitos (sem o dígito verificador), seguindo o mesmo padrão usado nos
Planos.
"""
import os
import re

from services.storage import read_json, write_json

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "municipios.json")

CODIGO_RE = re.compile(r"^\d{6}$")
UF_RE = re.compile(r"^[A-Z]{2}$")

UFS_VALIDAS = {
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO",
}


class MunicipioValidationError(Exception):
    """Erro de validação de dados de um Município."""
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def _normalize_codigo(raw: str) -> str:
    d = re.sub(r"\D", "", str(raw or ""))
    # aceita 7 dígitos (com dígito verificador) e descarta o último
    if len(d) == 7:
        return d[:6]
    return d


def _next_id(items: list) -> int:
    return max([item.get("id", 0) for item in items], default=0) + 1


def list_municipios(estado: str = None) -> list:
    items = read_json(DATA_PATH, default=[])
    if estado:
        estado = estado.strip().upper()
        items = [m for m in items if m["estado"] == estado]
    return items


def get_municipio(municipio_id: int):
    items = list_municipios()
    return next((m for m in items if m["id"] == municipio_id), None)


def _validate_payload(payload: dict, items: list, ignore_id: int = None) -> dict:
    estado = str(payload.get("estado", "") or "").strip().upper()
    nome = str(payload.get("nome", "")).strip()
    codigo = _normalize_codigo(payload.get("codigo", ""))

    if not UF_RE.match(estado) or estado not in UFS_VALIDAS:
        raise MunicipioValidationError(f"Estado (UF) '{estado}' inválido. Use a sigla com 2 letras.")

    if not nome:
        raise MunicipioValidationError("Nome do município é obrigatório.")

    if not CODIGO_RE.match(codigo):
        raise MunicipioValidationError("Código IBGE inválido. Use 6 dígitos numéricos, sem o dígito verificador (ex: 355030).")

    duplicate = next(
        (m for m in items if m["codigo"] == codigo and m.get("id") != ignore_id),
        None,
    )
    if duplicate:
        raise MunicipioValidationError(f"O código {codigo} já está cadastrado.")

    return {"estado": estado, "nome": nome, "codigo": codigo}


def create_municipio(payload: dict) -> dict:
    items = list_municipios()
    clean = _validate_payload(payload, items)
    new_item = {"id": _next_id(items), **clean}
    items.append(new_item)
    write_json(DATA_PATH, items)
    return new_item


def update_municipio(municipio_id: int, payload: dict) -> dict:
    items = list_municipios()
    existing = next((m for m in items if m["id"] == municipio_id), None)
    if existing is None:
        raise MunicipioValidationError("Município não encontrado.")

    clean = _validate_payload(payload, items, ignore_id=municipio_id)
    existing.update(clean)
    write_json(DATA_PATH, items)
    return existing


def delete_municipio(municipio_id: int) -> bool:
    items = list_municipios()
    filtered = [m for m in items if m["id"] != municipio_id]
    if len(filtered) == len(items):
        return False
    write_json(DATA_PATH, filtered)
    return True


def import_municipios(payload_list: list) -> dict:
    """
    Importa uma lista de municípios, ignorando códigos já existentes.
    Retorna um resumo: {"added": N, "skipped": M}
    """
    items = list_municipios()
    existing_codes = {m["codigo"] for m in items}
    added = 0
    skipped = 0

    for raw in payload_list:
        try:
            estado = str(raw.get("estado", "") or "").strip().upper()
            nome = str(raw.get("nome", "")).strip()
            codigo = _normalize_codigo(raw.get("codigo", ""))

            if not UF_RE.match(estado) or estado not in UFS_VALIDAS:
                skipped += 1
                continue
            if not CODIGO_RE.match(codigo) or not nome:
                skipped += 1
                continue
            if codigo in existing_codes:
                skipped += 1
                continue

            items.append({"id": _next_id(items), "estado": estado, "nome": nome, "codigo": codigo})
            existing_codes.add(codigo)
            added += 1
        except (AttributeError, TypeError):
            skipped += 1

    if added:
        write_json(DATA_PATH, items)

    return {"added": added, "skipped": skipped}