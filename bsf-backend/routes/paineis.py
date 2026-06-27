"""
Rotas REST para o recurso Painéis.

  GET /api/paineis/<plano_id>              -> dados estruturados (série
                                                temporal + tabela CNAE)
                                                para o dashboard do plano
  GET /api/paineis/<plano_id>/dados-setor  -> widgets de "Dados do Setor"
                                                (uma linha por CNPJ),
                                                aceita filtros via querystring
  GET /api/paineis/<plano_id>/lista-cnpj   -> lista CNPJ x razão social x
                                                empregados x sócios x
                                                município, sem agregação
  GET /api/paineis/<plano_id>/porte        -> contagem de empresas por
                                                faixa de porte
"""
from flask import Blueprint, jsonify, request

from services.painel_service import obter_painel
from services.setor_service import FILTROS_SUPORTADOS, obter_dados_setor, obter_lista_cnpj, obter_porte
from services.plano_service import get_plano

paineis_bp = Blueprint("paineis", __name__)


@paineis_bp.get("/<int:plano_id>")
def get_painel(plano_id):
    plano = get_plano(plano_id)
    if plano is None:
        return jsonify({"error": "Plano não encontrado."}), 404

    dados = obter_painel(plano["nome"])
    dados["plano"] = {"id": plano["id"], "nome": plano["nome"], "estado": plano.get("estado"), "regiao": plano.get("regiao")}
    return jsonify(dados)


@paineis_bp.get("/<int:plano_id>/dados-setor")
def get_dados_setor(plano_id):
    plano = get_plano(plano_id)
    if plano is None:
        return jsonify({"error": "Plano não encontrado."}), 404

    filtros = {chave: request.args.get(chave, "") for chave in FILTROS_SUPORTADOS}
    dados = obter_dados_setor(plano["nome"], filtros)
    return jsonify(dados)


@paineis_bp.get("/<int:plano_id>/lista-cnpj")
def get_lista_cnpj(plano_id):
    plano = get_plano(plano_id)
    if plano is None:
        return jsonify({"error": "Plano não encontrado."}), 404

    filtros = {chave: request.args.get(chave, "") for chave in FILTROS_SUPORTADOS}
    dados = obter_lista_cnpj(plano["nome"], filtros)
    return jsonify(dados)


@paineis_bp.get("/<int:plano_id>/porte")
def get_porte(plano_id):
    plano = get_plano(plano_id)
    if plano is None:
        return jsonify({"error": "Plano não encontrado."}), 404

    filtros = {chave: request.args.get(chave, "") for chave in FILTROS_SUPORTADOS}
    dados = obter_porte(plano["nome"], filtros)
    return jsonify(dados)