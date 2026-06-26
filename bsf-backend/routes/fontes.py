"""
Rotas REST para o recurso Fontes de Dados (arquivos RAIS/CAGED).

  GET  /api/fontes                                  -> lista RAIS + CAGED esperados
  POST /api/fontes/rais/<regiao>/<ano>/converter     -> inicia conversão txt->parquet
  POST /api/fontes/caged/<ano>/<mes>/converter       -> idem para CAGED
  GET  /api/fontes/conversao/<chave>/logs?desde=N    -> logs da conversão (cursor)
  DELETE /api/fontes/rais/<regiao>/<ano>/txt         -> exclui o .txt original
  DELETE /api/fontes/caged/<ano>/<mes>/txt           -> idem para CAGED

  Upload em chunks (usado principalmente para o CAGED mensal):
  POST /api/fontes/upload/iniciar       -> cria um upload, retorna upload_id
  POST /api/fontes/upload/<id>/chunk    -> envia um pedaço do arquivo
  POST /api/fontes/upload/<id>/finalizar -> move o arquivo para o destino final
  POST /api/fontes/upload/<id>/cancelar  -> descarta o upload em andamento
"""
from flask import Blueprint, jsonify, request

from services.fonte_service import (
    FonteError,
    cancelar_upload,
    caminho_caged,
    caminho_rais,
    enviar_chunk,
    excluir_txt_caged,
    excluir_txt_rais,
    finalizar_upload,
    iniciar_conversao_caged,
    iniciar_conversao_rais,
    iniciar_upload,
    listar_fontes,
    obter_logs_conversao,
)

fontes_bp = Blueprint("fontes", __name__)


@fontes_bp.get("")
def get_all():
    return jsonify(listar_fontes())


@fontes_bp.post("/rais/<regiao>/<int:ano>/converter")
def converter_rais(regiao, ano):
    payload = request.get_json(silent=True) or {}
    apagar_original = bool(payload.get("apagar_original", False))
    try:
        resultado = iniciar_conversao_rais(regiao, ano, apagar_original)
        return jsonify(resultado), 202
    except FonteError as e:
        return jsonify({"error": e.message}), 400


@fontes_bp.post("/caged/<int:ano>/<int:mes>/converter")
def converter_caged(ano, mes):
    payload = request.get_json(silent=True) or {}
    apagar_original = bool(payload.get("apagar_original", False))
    try:
        resultado = iniciar_conversao_caged(ano, mes, apagar_original)
        return jsonify(resultado), 202
    except FonteError as e:
        return jsonify({"error": e.message}), 400


@fontes_bp.get("/conversao/<chave>/logs")
def conversao_logs(chave):
    desde = request.args.get("desde", default=0, type=int)
    return jsonify(obter_logs_conversao(chave, desde))


@fontes_bp.delete("/rais/<regiao>/<int:ano>/txt")
def deletar_rais_txt(regiao, ano):
    ok = excluir_txt_rais(regiao, ano)
    if not ok:
        return jsonify({"error": "Arquivo .txt não encontrado."}), 404
    return jsonify({"deletado": True})


@fontes_bp.delete("/caged/<int:ano>/<int:mes>/txt")
def deletar_caged_txt(ano, mes):
    ok = excluir_txt_caged(ano, mes)
    if not ok:
        return jsonify({"error": "Arquivo .txt não encontrado."}), 404
    return jsonify({"deletado": True})


# =========================
# UPLOAD EM CHUNKS
# =========================
@fontes_bp.post("/upload/iniciar")
def upload_iniciar():
    payload = request.get_json(silent=True) or {}
    tipo = payload.get("tipo")

    try:
        if tipo == "caged":
            ano = int(payload["ano"])
            mes = int(payload["mes"])
            destino = caminho_caged(ano, mes, "txt")
        elif tipo == "rais":
            regiao = payload["regiao"]
            ano = int(payload["ano"])
            destino = caminho_rais(regiao, ano, "txt")
        else:
            return jsonify({"error": "Campo 'tipo' deve ser 'rais' ou 'caged'."}), 400
    except (KeyError, ValueError):
        return jsonify({"error": "Parâmetros inválidos para iniciar upload."}), 400

    upload_id = iniciar_upload(destino)
    return jsonify({"upload_id": upload_id, "destino": destino}), 201


@fontes_bp.post("/upload/<upload_id>/chunk")
def upload_chunk(upload_id):
    chunk = request.get_data()
    try:
        resultado = enviar_chunk(upload_id, chunk)
        return jsonify(resultado)
    except FonteError as e:
        return jsonify({"error": e.message}), 404


@fontes_bp.post("/upload/<upload_id>/finalizar")
def upload_finalizar(upload_id):
    try:
        resultado = finalizar_upload(upload_id)
        return jsonify(resultado)
    except FonteError as e:
        return jsonify({"error": e.message}), 404


@fontes_bp.post("/upload/<upload_id>/cancelar")
def upload_cancelar(upload_id):
    cancelar_upload(upload_id)
    return jsonify({"cancelado": True})