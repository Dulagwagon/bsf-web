"""
Rotas REST para o recurso Municípios.

  GET    /api/municipios              -> lista todos
  GET    /api/municipios?estado=SP    -> lista apenas os do estado informado
  POST   /api/municipios              -> cria um novo
  PUT    /api/municipios/<id>         -> atualiza um existente
  DELETE /api/municipios/<id>         -> remove um existente
  POST   /api/municipios/import       -> importa uma lista em lote
"""
from flask import Blueprint, jsonify, request

from services.municipio_service import (
    MunicipioValidationError,
    create_municipio,
    delete_municipio,
    import_municipios,
    list_municipios,
    update_municipio,
)

municipios_bp = Blueprint("municipios", __name__)


@municipios_bp.get("")
def get_all():
    estado = request.args.get("estado")
    return jsonify(list_municipios(estado))


@municipios_bp.post("")
def create():
    payload = request.get_json(silent=True) or {}
    try:
        item = create_municipio(payload)
        return jsonify(item), 201
    except MunicipioValidationError as e:
        return jsonify({"error": e.message}), 400


@municipios_bp.put("/<int:municipio_id>")
def update(municipio_id):
    payload = request.get_json(silent=True) or {}
    try:
        item = update_municipio(municipio_id, payload)
        return jsonify(item)
    except MunicipioValidationError as e:
        status = 404 if e.message == "Município não encontrado." else 400
        return jsonify({"error": e.message}), status


@municipios_bp.delete("/<int:municipio_id>")
def delete(municipio_id):
    ok = delete_municipio(municipio_id)
    if not ok:
        return jsonify({"error": "Município não encontrado."}), 404
    return jsonify({"deleted": municipio_id})


@municipios_bp.post("/import")
def import_batch():
    payload = request.get_json(silent=True)
    if not isinstance(payload, list):
        return jsonify({"error": "Envie uma lista de municípios."}), 400
    summary = import_municipios(payload)
    return jsonify(summary)