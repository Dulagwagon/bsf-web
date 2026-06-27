"""
Camada de regras de negócio para o recurso Fontes de Dados.

Responsável por:
- Varrer os arquivos RAIS (por região/ano) e CAGED (por ano/mês) esperados,
  reportando se existe .txt, se existe .parquet, e metadados de cada um.
- Converter .txt -> .parquet preservando todas as colunas (a conversão não
  filtra nada — só troca o formato de armazenamento para leitura mais
  rápida e seletiva por coluna).
- Receber uploads em chunks (usado principalmente para o CAGED mensal).
- Excluir o .txt original após conversão, quando solicitado explicitamente.

A conversão roda em thread separada (mesmo padrão do orquestrador), já que
arquivos de 5-30GB podem levar minutos. Logs e progresso são consultáveis
via cursor, igual ao pipeline.
"""
import csv
import os
import threading
import time
import traceback

import pandas as pd

RAIS_BASE = os.environ.get("BSF_RAIS_BASE", "E:/NMN/DATA/RAIS")
CAGED_PATH = os.environ.get("BSF_CAGED_PATH", "E:/NMN/DATA/CAGED")

REGIOES_RAIS = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul", "SP"]
ANOS_RAIS = [2021, 2022, 2023, 2024]
ANOS_CAGED = [2025, 2026]
MESES_CAGED = list(range(1, 13))

# Encoding original dos .txt — RAIS e CAGED usam encodings diferentes
# (confirmado em steps/step_1.py e steps/step_2.py).
ENCODING_RAIS = "latin1"
ENCODING_CAGED = "cp1252"


class FonteError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


# =========================
# CAMINHOS
# =========================
def caminho_rais(regiao: str, ano: int, ext: str = "txt") -> str:
    nome = f"rais_{ano}.{ext}"
    return f"{RAIS_BASE}/{regiao}/{ano}/{nome}"


def caminho_caged(ano: int, mes: int, ext: str = "txt") -> str:
    nome = f"caged_{ano}_{mes:02d}.{ext}"
    return f"{CAGED_PATH}/{ano}/{nome}"


def _info_arquivo(path: str):
    if not os.path.isfile(path):
        return None
    stat = os.stat(path)
    return {"tamanho": stat.st_size, "modificadoEm": stat.st_mtime}


# =========================
# LISTAGEM
# =========================
def listar_fontes_rais() -> list:
    """
    Lista todos os arquivos RAIS esperados (região x ano), com informação
    de existência e tamanho do .txt e do .parquet correspondente.
    """
    resultado = []
    for regiao in REGIOES_RAIS:
        for ano in ANOS_RAIS:
            txt_path = caminho_rais(regiao, ano, "txt")
            parquet_path = caminho_rais(regiao, ano, "parquet")
            resultado.append({
                "tipo": "rais",
                "regiao": regiao,
                "ano": ano,
                "label": f"RAIS {ano} — {regiao}",
                "txt": _info_arquivo(txt_path),
                "parquet": _info_arquivo(parquet_path),
            })
    return resultado


def listar_fontes_caged() -> list:
    """
    Lista todos os arquivos CAGED esperados (ano x mês), com informação
    de existência e tamanho do .txt e do .parquet correspondente.
    """
    resultado = []
    for ano in ANOS_CAGED:
        for mes in MESES_CAGED:
            txt_path = caminho_caged(ano, mes, "txt")
            parquet_path = caminho_caged(ano, mes, "parquet")
            resultado.append({
                "tipo": "caged",
                "ano": ano,
                "mes": mes,
                "label": f"CAGED {ano}-{mes:02d}",
                "txt": _info_arquivo(txt_path),
                "parquet": _info_arquivo(parquet_path),
            })
    return resultado


def listar_fontes() -> dict:
    return {"rais": listar_fontes_rais(), "caged": listar_fontes_caged()}


def caged_mais_recente_disponivel():
    """
    Retorna (ano, mes) do arquivo CAGED mais recente que existe em disco
    (.txt ou .parquet), varrendo ANOS_CAGED x MESES_CAGED em ordem
    decrescente. Usado para exibir "Atualização dos Dados" nos Painéis —
    representa até onde a fonte de dados está alimentada, independente
    de qual plano está sendo visualizado.

    Retorna None se nenhum arquivo CAGED existir ainda.
    """
    for ano in sorted(ANOS_CAGED, reverse=True):
        for mes in sorted(MESES_CAGED, reverse=True):
            if os.path.isfile(caminho_caged(ano, mes, "txt")) or os.path.isfile(caminho_caged(ano, mes, "parquet")):
                return {"ano": ano, "mes": mes}
    return None


# =========================
# CONVERSÃO .txt -> .parquet
# =========================
# Estado em memória das conversões em andamento, mesmo padrão do orquestrador.
_conversoes = {}
_lock = threading.Lock()


def _chave_conversao(tipo: str, **kwargs) -> str:
    if tipo == "rais":
        return f"rais:{kwargs['regiao']}:{kwargs['ano']}"
    return f"caged:{kwargs['ano']}:{kwargs['mes']:02d}"


def _get_conversao(chave: str) -> dict:
    with _lock:
        if chave not in _conversoes:
            _conversoes[chave] = {"logs": [], "rodando": False, "erro": None, "thread": None}
        return _conversoes[chave]


def _log(chave: str, msg: str):
    conversao = _get_conversao(chave)
    print(msg)
    conversao["logs"].append({"ts": time.time(), "msg": msg})


def obter_logs_conversao(chave: str, desde: int = 0) -> dict:
    conversao = _get_conversao(chave)
    logs = conversao["logs"]
    return {"logs": logs[desde:], "total": len(logs), "rodando": conversao["rodando"], "erro": conversao["erro"]}


def esta_convertendo(chave: str) -> bool:
    conversao = _get_conversao(chave)
    thread = conversao["thread"]
    return thread is not None and thread.is_alive()


def _detectar_separador_e_encoding(txt_path: str, encoding: str) -> str:
    """RAIS/CAGED usam ';' como separador, conforme já confirmado nos steps."""
    return ";"


def _converter_arquivo(txt_path: str, parquet_path: str, encoding: str, chave: str, apagar_original: bool):
    """
    Lê o .txt inteiro em chunks (preservando TODAS as colunas, sem filtrar
    nada) e escreve um único .parquet equivalente. Usa dtype=str para
    manter o mesmo comportamento de leitura usado pelos steps hoje —
    a conversão não reinterpreta tipos, só muda o formato de armazenamento.
    """
    conversao = _get_conversao(chave)
    conversao["rodando"] = True
    conversao["erro"] = None
    conversao["logs"] = []

    try:
        if not os.path.isfile(txt_path):
            raise FonteError(f"Arquivo não encontrado: {txt_path}")

        _log(chave, f"📄 Convertendo: {txt_path}")
        _log(chave, f"📦 Destino: {parquet_path}")

        sep = _detectar_separador_e_encoding(txt_path, encoding)

        os.makedirs(os.path.dirname(parquet_path), exist_ok=True)

        chunksize = 500_000
        primeiro_chunk = True
        total_linhas = 0

        import pyarrow as pa
        import pyarrow.parquet as pq

        writer = None
        try:
            for chunk in pd.read_csv(
                txt_path, sep=sep, dtype=str, encoding=encoding,
                chunksize=chunksize, low_memory=False,
            ):
                total_linhas += len(chunk)
                table = pa.Table.from_pandas(chunk, preserve_index=False)

                if writer is None:
                    writer = pq.ParquetWriter(parquet_path, table.schema, compression="snappy")
                writer.write_table(table)

                _log(chave, f"📦 Processado: {total_linhas:,} linhas")
                primeiro_chunk = False
        finally:
            if writer is not None:
                writer.close()

        if primeiro_chunk:
            raise FonteError("Arquivo está vazio — nenhuma linha foi lida.")

        tamanho_txt = os.path.getsize(txt_path)
        tamanho_parquet = os.path.getsize(parquet_path)
        reducao = (1 - tamanho_parquet / tamanho_txt) * 100 if tamanho_txt else 0

        _log(chave, f"✅ Conversão concluída: {total_linhas:,} linhas")
        _log(chave, f"📉 Tamanho: {tamanho_txt / 1e6:.1f}MB → {tamanho_parquet / 1e6:.1f}MB ({reducao:.0f}% menor)")

        if apagar_original:
            os.remove(txt_path)
            _log(chave, f"🗑️ Arquivo original removido: {txt_path}")

        _log(chave, "✅ FINALIZADO COM SUCESSO")

    except Exception as e:
        conversao["erro"] = str(e)
        _log(chave, f"❌ ERRO: {e}")
        _log(chave, traceback.format_exc())
    finally:
        conversao["rodando"] = False


def iniciar_conversao_rais(regiao: str, ano: int, apagar_original: bool = False) -> dict:
    if regiao not in REGIOES_RAIS:
        raise FonteError(f"Região '{regiao}' inválida.")
    if ano not in ANOS_RAIS:
        raise FonteError(f"Ano '{ano}' inválido para RAIS.")

    chave = _chave_conversao("rais", regiao=regiao, ano=ano)
    if esta_convertendo(chave):
        raise FonteError("Esta conversão já está em andamento.")

    txt_path = caminho_rais(regiao, ano, "txt")
    parquet_path = caminho_rais(regiao, ano, "parquet")

    conversao = _get_conversao(chave)
    thread = threading.Thread(
        target=_converter_arquivo,
        args=(txt_path, parquet_path, ENCODING_RAIS, chave, apagar_original),
        daemon=True,
    )
    conversao["thread"] = thread
    thread.start()
    return {"chave": chave, "iniciado": True}


def iniciar_conversao_caged(ano: int, mes: int, apagar_original: bool = False) -> dict:
    if ano not in ANOS_CAGED:
        raise FonteError(f"Ano '{ano}' inválido para CAGED.")
    if mes not in MESES_CAGED:
        raise FonteError(f"Mês '{mes}' inválido.")

    chave = _chave_conversao("caged", ano=ano, mes=mes)
    if esta_convertendo(chave):
        raise FonteError("Esta conversão já está em andamento.")

    txt_path = caminho_caged(ano, mes, "txt")
    parquet_path = caminho_caged(ano, mes, "parquet")

    conversao = _get_conversao(chave)
    thread = threading.Thread(
        target=_converter_arquivo,
        args=(txt_path, parquet_path, ENCODING_CAGED, chave, apagar_original),
        daemon=True,
    )
    conversao["thread"] = thread
    thread.start()
    return {"chave": chave, "iniciado": True}


# =========================
# EXCLUSÃO MANUAL DO .txt
# =========================
def excluir_txt_rais(regiao: str, ano: int) -> bool:
    path = caminho_rais(regiao, ano, "txt")
    if not os.path.isfile(path):
        return False
    os.remove(path)
    return True


def excluir_txt_caged(ano: int, mes: int) -> bool:
    path = caminho_caged(ano, mes, "txt")
    if not os.path.isfile(path):
        return False
    os.remove(path)
    return True


# =========================
# UPLOAD EM CHUNKS
# =========================
# Estado dos uploads em andamento: upload_id -> caminho temporário + handle
_uploads = {}


def iniciar_upload(destino_path: str) -> str:
    """Cria um arquivo temporário para receber os chunks do upload."""
    import uuid
    upload_id = str(uuid.uuid4())
    tmp_path = destino_path + ".uploading"
    os.makedirs(os.path.dirname(destino_path), exist_ok=True)
    _uploads[upload_id] = {"tmp_path": tmp_path, "destino": destino_path, "recebido": 0}
    # garante arquivo vazio no início
    with open(tmp_path, "wb"):
        pass
    return upload_id


def enviar_chunk(upload_id: str, chunk: bytes) -> dict:
    if upload_id not in _uploads:
        raise FonteError("Upload não encontrado ou já finalizado.")
    info = _uploads[upload_id]
    with open(info["tmp_path"], "ab") as f:
        f.write(chunk)
    info["recebido"] += len(chunk)
    return {"recebido": info["recebido"]}


def finalizar_upload(upload_id: str) -> dict:
    if upload_id not in _uploads:
        raise FonteError("Upload não encontrado ou já finalizado.")
    info = _uploads.pop(upload_id)
    os.replace(info["tmp_path"], info["destino"])
    return {"destino": info["destino"], "tamanho": os.path.getsize(info["destino"])}


def cancelar_upload(upload_id: str):
    info = _uploads.pop(upload_id, None)
    if info and os.path.isfile(info["tmp_path"]):
        os.remove(info["tmp_path"])