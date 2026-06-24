"""
Rotas REST para o recurso CNAEs.

  GET    /api/cnaes          -> lista todos
  POST   /api/cnaes          -> cria um novo
  PUT    /api/cnaes/<id>     -> atualiza um existente
  DELETE /api/cnaes/<id>     -> remove um existente
  POST   /api/cnaes/import   -> importa uma lista em lote
"""
from flask import Blueprint, jsonify, request

from services.cnae_service import (
    CnaeValidationError,
    create_cnae,
    delete_cnae,
    import_cnaes,
    list_cnaes,
    update_cnae,
)

cnaes_bp = Blueprint("cnaes", __name__)


@cnaes_bp.get("")
def get_all():
    return jsonify(list_cnaes())


@cnaes_bp.post("")
def create():
    payload = request.get_json(silent=True) or {}
    try:
        item = create_cnae(payload)
        return jsonify(item), 201
    except CnaeValidationError as e:
        return jsonify({"error": e.message}), 400


@cnaes_bp.put("/<int:cnae_id>")
def update(cnae_id):
    payload = request.get_json(silent=True) or {}
    try:
        item = update_cnae(cnae_id, payload)
        return jsonify(item)
    except CnaeValidationError as e:
        status = 404 if e.message == "CNAE não encontrado." else 400
        return jsonify({"error": e.message}), status


@cnaes_bp.delete("/<int:cnae_id>")
def delete(cnae_id):
    ok = delete_cnae(cnae_id)
    if not ok:
        return jsonify({"error": "CNAE não encontrado."}), 404
    return jsonify({"deleted": cnae_id})


@cnaes_bp.post("/import")
def import_batch():
    payload = request.get_json(silent=True)
    if not isinstance(payload, list):
        return jsonify({"error": "Envie uma lista de CNAEs."}), 400
    summary = import_cnaes(payload)
    return jsonify(summary)
