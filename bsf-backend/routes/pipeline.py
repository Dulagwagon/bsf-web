"""
Rotas REST para execução do pipeline (orquestrador).

  POST /api/pipeline/executar/<plano_id>   -> inicia execução completa
  POST /api/pipeline/atualizar/<plano_id>  -> inicia atualização incremental
  POST /api/pipeline/parar/<plano_id>      -> solicita interrupção
  GET  /api/pipeline/logs/<plano_id>?desde=N -> logs novos desde o índice N
  GET  /api/pipeline/status/<plano_id>     -> está rodando ou não

A execução em si roda em background (thread) — estas rotas retornam
imediatamente. O acompanhamento é feito via polling em /logs e
consultando o status do Plano (GET /api/planos).
"""
from flask import Blueprint, jsonify, request

from services.orquestrador_service import (
    esta_rodando,
    iniciar_execucao,
    obter_logs,
    solicitar_parada,
)

pipeline_bp = Blueprint("pipeline", __name__)


@pipeline_bp.post("/executar/<int:plano_id>")
def executar(plano_id):
    try:
        resultado = iniciar_execucao(plano_id, modo="full")
        return jsonify(resultado), 202
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 409
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@pipeline_bp.post("/atualizar/<int:plano_id>")
def atualizar(plano_id):
    try:
        resultado = iniciar_execucao(plano_id, modo="update")
        return jsonify(resultado), 202
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 409
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@pipeline_bp.post("/parar/<int:plano_id>")
def parar(plano_id):
    ok = solicitar_parada(plano_id)
    if not ok:
        return jsonify({"error": "Este plano não está em execução."}), 409
    return jsonify({"parando": True})


@pipeline_bp.get("/logs/<int:plano_id>")
def logs(plano_id):
    desde = request.args.get("desde", default=0, type=int)
    resultado = obter_logs(plano_id, desde)
    resultado["rodando"] = esta_rodando(plano_id)
    return jsonify(resultado)


@pipeline_bp.get("/status/<int:plano_id>")
def status(plano_id):
    return jsonify({"rodando": esta_rodando(plano_id)})