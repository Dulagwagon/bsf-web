"""
Rotas REST para o recurso Planos.

  GET    /api/planos              -> lista todos
  POST   /api/planos              -> cria um novo
  PUT    /api/planos/<id>         -> atualiza um existente
  DELETE /api/planos/<id>         -> remove um existente
  PATCH  /api/planos/<id>/status  -> atualiza apenas o status (ex: pipeline)
"""
from flask import Blueprint, jsonify, request

from services.plano_service import (
    PlanoValidationError,
    create_plano,
    delete_plano,
    list_planos,
    update_plano,
    update_status,
)

planos_bp = Blueprint("planos", __name__)


@planos_bp.get("")
def get_all():
    return jsonify(list_planos())


@planos_bp.post("")
def create():
    payload = request.get_json(silent=True) or {}
    try:
        item = create_plano(payload)
        return jsonify(item), 201
    except PlanoValidationError as e:
        return jsonify({"error": e.message}), 400


@planos_bp.put("/<int:plano_id>")
def update(plano_id):
    payload = request.get_json(silent=True) or {}
    try:
        item = update_plano(plano_id, payload)
        return jsonify(item)
    except PlanoValidationError as e:
        status = 404 if e.message == "Plano não encontrado." else 400
        return jsonify({"error": e.message}), status


@planos_bp.delete("/<int:plano_id>")
def delete(plano_id):
    ok = delete_plano(plano_id)
    if not ok:
        return jsonify({"error": "Plano não encontrado."}), 404
    return jsonify({"deleted": plano_id})


@planos_bp.patch("/<int:plano_id>/status")
def patch_status(plano_id):
    payload = request.get_json(silent=True) or {}
    try:
        item = update_status(plano_id, payload.get("status"))
        return jsonify(item)
    except PlanoValidationError as e:
        status = 404 if e.message == "Plano não encontrado." else 400
        return jsonify({"error": e.message}), status