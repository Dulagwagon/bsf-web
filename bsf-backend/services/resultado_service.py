"""
Camada de regras de negócio para o recurso Resultados.

Quando o orquestrador (pipeline) executa um Plano, ele grava os arquivos
de saída em:

    outputs/<slug-do-nome-do-plano>/rais_caged.csv
    outputs/<slug-do-nome-do-plano>/rais_caged_t.csv

Este serviço apenas localiza, lista e serve esses arquivos — ele não
executa o pipeline (isso é responsabilidade do orquestrador, que ainda
será conectado).
"""
import os
import re
import unicodedata

OUTPUTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")

# Arquivos que o orquestrador está previsto a gerar por execução de Plano.
# Mantido como lista para facilitar adicionar novos arquivos no futuro.
ARQUIVOS_ESPERADOS = ["rais_caged.csv", "rais_caged_t.csv"]


def slugify(nome: str) -> str:
    """
    Converte o nome de um plano em um nome de pasta seguro.
    Ex: "SP — Tecnologia" -> "sp-tecnologia"
    """
    nome = unicodedata.normalize("NFKD", nome or "")
    nome = nome.encode("ascii", "ignore").decode("ascii")
    nome = nome.lower().strip()
    nome = re.sub(r"[^a-z0-9]+", "-", nome)
    nome = re.sub(r"-+", "-", nome).strip("-")
    return nome or "plano"


def _plano_dir(nome_plano: str) -> str:
    return os.path.join(OUTPUTS_DIR, slugify(nome_plano))


def list_resultados(nome_plano: str) -> list:
    """
    Lista os arquivos de resultado disponíveis para um plano.
    Retorna uma lista de dicts com nome, tamanho (bytes) e data de
    modificação para cada arquivo ESPERADO que já existe em disco.
    Arquivos esperados que ainda não foram gerados não aparecem na lista
    (a ausência indica que o pipeline ainda não rodou ou está rodando).
    """
    plano_dir = _plano_dir(nome_plano)
    resultados = []

    for filename in ARQUIVOS_ESPERADOS:
        filepath = os.path.join(plano_dir, filename)
        if os.path.isfile(filepath):
            stat = os.stat(filepath)
            resultados.append({
                "nome": filename,
                "tamanho": stat.st_size,
                "modificadoEm": stat.st_mtime,
            })

    return resultados


def get_resultado_path(nome_plano: str, filename: str):
    """
    Retorna o caminho absoluto de um arquivo de resultado, validando que:
    - o nome do arquivo está na lista de arquivos esperados (evita path
      traversal e acesso a arquivos arbitrários do servidor)
    - o arquivo de fato existe em disco

    Retorna None se qualquer validação falhar.
    """
    if filename not in ARQUIVOS_ESPERADOS:
        return None

    plano_dir = _plano_dir(nome_plano)
    filepath = os.path.join(plano_dir, filename)

    if not os.path.isfile(filepath):
        return None

    return filepath