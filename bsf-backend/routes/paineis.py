"""
Rotas REST para o recurso Painéis.

  GET /api/paineis/<plano_id> -> dados estruturados (série temporal +
                                   tabela CNAE) para montar o dashboard
                                   do plano, a partir dos CSVs gerados
                                   pelo pipeline.
"""
from flask import Blueprint, jsonify

from services.painel_service import obter_painel
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