"""
Rotas REST para o recurso Resultados.

  GET  /api/resultados?plano=<nome_do_plano>           -> lista arquivos disponíveis
  GET  /api/resultados/download?plano=<nome>&arquivo=<x> -> baixa um arquivo específico
  POST /api/resultados/upload?plano=<nome>&arquivo=<x>   -> envia um arquivo (ex: dados_setor.csv)

O nome do plano é usado (via slug) para localizar a pasta de outputs
gerada pelo orquestrador. Veja services/resultado_service.py.
"""
from flask import Blueprint, jsonify, request, send_file

from services.resultado_service import (
    ResultadoError,
    get_resultado_path,
    list_resultados,
    salvar_upload,
)

resultados_bp = Blueprint("resultados", __name__)


@resultados_bp.get("")
def get_all():
    nome_plano = request.args.get("plano", "")
    if not nome_plano:
        return jsonify({"error": "Parâmetro 'plano' é obrigatório."}), 400
    return jsonify(list_resultados(nome_plano))


@resultados_bp.get("/download")
def download():
    nome_plano = request.args.get("plano", "")
    filename = request.args.get("arquivo", "")

    if not nome_plano or not filename:
        return jsonify({"error": "Parâmetros 'plano' e 'arquivo' são obrigatórios."}), 400

    filepath = get_resultado_path(nome_plano, filename)
    if filepath is None:
        return jsonify({"error": "Arquivo não encontrado."}), 404

    return send_file(filepath, as_attachment=True, download_name=filename)


@resultados_bp.post("/upload")
def upload():
    nome_plano = request.args.get("plano", "")
    filename = request.args.get("arquivo", "")

    if not nome_plano or not filename:
        return jsonify({"error": "Parâmetros 'plano' e 'arquivo' são obrigatórios."}), 400

    if "file" not in request.files:
        return jsonify({"error": "Nenhum arquivo enviado."}), 400

    try:
        resultado = salvar_upload(nome_plano, filename, request.files["file"])
        return jsonify(resultado), 201
    except ResultadoError as e:
        return jsonify({"error": e.message}), 400