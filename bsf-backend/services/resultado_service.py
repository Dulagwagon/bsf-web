"""
Camada de regras de negócio para o recurso Resultados.

Quando o orquestrador (pipeline) executa um Plano, ele grava os arquivos
de saída em:

    outputs/<slug-do-nome-do-plano>/rais_caged.csv
    outputs/<slug-do-nome-do-plano>/rais_caged_t.csv

Além desses, o arquivo dados_setor.csv (uma linha por CNPJ, com os
atributos do setor — situação, capital social, CNAE, natureza jurídica
etc.) pode ser enviado manualmente por upload, na mesma pasta. No
futuro, quando houver conexão com banco de dados externo, ele passa a
ser gerado automaticamente pelo próprio pipeline, sem mudar onde mora.

Este serviço localiza, lista, serve e recebe (upload) esses arquivos —
ele não executa o pipeline (isso é responsabilidade do orquestrador).
"""
import os
import re
import unicodedata

OUTPUTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")

# Arquivos que o orquestrador está previsto a gerar por execução de Plano,
# mais o dados_setor.csv (hoje enviado por upload manual).
ARQUIVOS_ESPERADOS = ["rais_caged.csv", "rais_caged_t.csv", "dados_setor.csv"]

# Arquivos que podem ser recebidos via upload manual pela interface
# (os demais só são gerados pelo orquestrador, nunca por upload).
ARQUIVOS_UPLOAD_PERMITIDO = {"dados_setor.csv"}


class ResultadoError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


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
                "uploadManual": filename in ARQUIVOS_UPLOAD_PERMITIDO,
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


def salvar_upload(nome_plano: str, filename: str, file_storage) -> dict:
    """
    Salva um arquivo enviado por upload (ex: dados_setor.csv) na pasta de
    resultados do plano. Só aceita nomes presentes em
    ARQUIVOS_UPLOAD_PERMITIDO — os demais (rais_caged.csv etc.) só podem
    ser gerados pelo orquestrador, nunca sobrescritos via upload manual.
    """
    if filename not in ARQUIVOS_UPLOAD_PERMITIDO:
        raise ResultadoError(f"Upload não permitido para '{filename}'.")

    plano_dir = _plano_dir(nome_plano)
    os.makedirs(plano_dir, exist_ok=True)
    destino = os.path.join(plano_dir, filename)

    file_storage.save(destino)

    stat = os.stat(destino)
    return {"nome": filename, "tamanho": stat.st_size, "modificadoEm": stat.st_mtime}