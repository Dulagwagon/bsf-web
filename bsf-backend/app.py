"""
Business Syndicate Framework — Backend API
Servidor Flask responsável por persistir dados (CNAEs, Planos, Municípios)
e executar o pipeline de filtragem (orquestrador).
"""
from flask import Flask
from flask_cors import CORS

from routes.cnaes import cnaes_bp
from routes.planos import planos_bp
from routes.municipios import municipios_bp
from routes.resultados import resultados_bp
from routes.pipeline import pipeline_bp
from routes.fontes import fontes_bp
from routes.paineis import paineis_bp


def create_app():
    app = Flask(__name__)

    # CORS liberado para o frontend Vite (ajuste a origem em produção)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    app.register_blueprint(cnaes_bp, url_prefix="/api/cnaes")
    app.register_blueprint(planos_bp, url_prefix="/api/planos")
    app.register_blueprint(municipios_bp, url_prefix="/api/municipios")
    app.register_blueprint(resultados_bp, url_prefix="/api/resultados")
    app.register_blueprint(pipeline_bp, url_prefix="/api/pipeline")
    app.register_blueprint(fontes_bp, url_prefix="/api/fontes")
    app.register_blueprint(paineis_bp, url_prefix="/api/paineis")

    @app.get("/api/health")
    def health():
        return {"status": "ok", "service": "bsf-backend"}

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)