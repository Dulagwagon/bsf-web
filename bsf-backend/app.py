"""
Business Syndicate Framework — Backend API
Servidor Flask responsável por persistir dados (CNAEs, Planos, Municípios)
e, futuramente, executar o pipeline de filtragem.
"""
from flask import Flask
from flask_cors import CORS

from routes.cnaes import cnaes_bp
from routes.planos import planos_bp


def create_app():
    app = Flask(__name__)

    # CORS liberado para o frontend Vite (ajuste a origem em produção)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    app.register_blueprint(cnaes_bp, url_prefix="/api/cnaes")
    app.register_blueprint(planos_bp, url_prefix="/api/planos")

    @app.get("/api/health")
    def health():
        return {"status": "ok", "service": "bsf-backend"}

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)